import AVFAudio
import Combine
import Speech
import SwiftUI
import UIKit
import WebKit

@MainActor
final class KasaBrowserModel: NSObject, ObservableObject {
    @Published private(set) var currentURL: URL?
    @Published private(set) var isLoading = true
    @Published private(set) var estimatedProgress = 0.0
    @Published private(set) var canGoBack = false
    @Published var lastError: String?
    @Published var isMicrophonePermissionBlocked = false

    let webView: WKWebView

    private var observations: [NSKeyValueObservation] = []
    private let audioEngine = AVAudioEngine()
    private var speechRecognizer: SFSpeechRecognizer?
    private var speechRequest: SFSpeechAudioBufferRecognitionRequest?
    private var speechTask: SFSpeechRecognitionTask?
    private var speechRestartTask: Task<Void, Never>?
    private var requestedSpeechLanguage = "en-US"
    private var nativeTranscriptionRequested = false
    private var didRequestInitialPermissions = false
    private var hasSpeechAudioTap = false

    override init() {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.websiteDataStore = .default()
        configuration.preferences.isElementFullscreenEnabled = true

        let contentController = WKUserContentController()
        contentController.addUserScript(
            WKUserScript(
                source: Self.nativeEnvironmentScript,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )
        configuration.userContentController = contentController

        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()

        contentController.add(self, name: "kasaNative")

        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.keyboardDismissMode = .interactive
        webView.customUserAgent = "KasaMobile/1.0 iOS"

        observeWebView()
        load(path: "/dashboard")
    }

    func load(path: String) {
        load(url: AppConfiguration.url(for: path))
    }

    func load(url: URL) {
        guard AppConfiguration.isTrusted(url) else { return }

        lastError = nil
        let request = URLRequest(
            url: url,
            cachePolicy: .useProtocolCachePolicy,
            timeoutInterval: 30
        )
        webView.load(request)
    }

    func reload() {
        lastError = nil
        webView.reload()
    }

    func goBack() {
        guard webView.canGoBack else { return }
        webView.goBack()
    }

    func clearSession() async {
        let store = WKWebsiteDataStore.default()
        let types = WKWebsiteDataStore.allWebsiteDataTypes()
        let records = await store.dataRecords(ofTypes: types)
        await store.removeData(ofTypes: types, for: records)
        load(path: "/login")
    }

    func openAppSettings() {
        guard let settingsURL = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(settingsURL)
    }

    func requestInitialAudioPermissions() {
        guard !didRequestInitialPermissions else { return }
        didRequestInitialPermissions = true
        requestMicrophoneAccessIfNeeded()
    }

    private func requestMicrophoneAccessIfNeeded() {
        switch AVAudioApplication.shared.recordPermission {
        case .granted:
            requestSpeechRecognitionAccessIfNeeded()
        case .denied:
            isMicrophonePermissionBlocked = true
        case .undetermined:
            AVAudioApplication.requestRecordPermission { [weak self] granted in
                Task { @MainActor in
                    self?.isMicrophonePermissionBlocked = !granted
                    if granted {
                        self?.requestSpeechRecognitionAccessIfNeeded()
                    }
                }
            }
        @unknown default:
            isMicrophonePermissionBlocked = true
        }
    }

    private func requestSpeechRecognitionAccessIfNeeded() {
        switch SFSpeechRecognizer.authorizationStatus() {
        case .authorized:
            isMicrophonePermissionBlocked = false
            notifyWebViewMicrophoneGranted()
            startSpeechCaptureIfPossible()
        case .denied, .restricted:
            isMicrophonePermissionBlocked = true
        case .notDetermined:
            SFSpeechRecognizer.requestAuthorization { [weak self] status in
                Task { @MainActor in
                    guard let self else { return }
                    self.isMicrophonePermissionBlocked = status != .authorized
                    if status == .authorized {
                        self.notifyWebViewMicrophoneGranted()
                        self.startSpeechCaptureIfPossible()
                    }
                }
            }
        @unknown default:
            isMicrophonePermissionBlocked = true
        }
    }

    var shouldShowNativeNavigation: Bool {
        guard let path = currentURL?.path else { return false }
        return path.hasPrefix("/dashboard")
    }

    var selectedDestination: KasaDestination {
        guard let path = currentURL?.path else { return .home }
        if path.hasPrefix("/dashboard/sessions") { return .sessions }
        if path.hasPrefix("/dashboard/instructions") { return .settings }
        return .home
    }

    private func observeWebView() {
        observations = [
            webView.observe(\.url, options: [.initial, .new]) { [weak self] webView, _ in
                Task { @MainActor in
                    self?.currentURL = webView.url
                }
            },
            webView.observe(\.estimatedProgress, options: [.initial, .new]) { [weak self] webView, _ in
                Task { @MainActor in
                    self?.estimatedProgress = webView.estimatedProgress
                }
            },
            webView.observe(\.canGoBack, options: [.initial, .new]) { [weak self] webView, _ in
                Task { @MainActor in
                    self?.canGoBack = webView.canGoBack
                }
            },
        ]
    }

    private func configureAudioSession() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(
            .playAndRecord,
            mode: .voiceChat,
            options: [.allowBluetoothHFP]
        )
        try? session.setActive(true)
    }

    private func startNativeTranscription(language: String) {
        nativeTranscriptionRequested = true
        requestedSpeechLanguage = Self.speechLocale(for: language)

        guard AVAudioApplication.shared.recordPermission == .granted,
              SFSpeechRecognizer.authorizationStatus() == .authorized
        else {
            requestInitialAudioPermissions()
            return
        }

        startSpeechCaptureIfPossible()
    }

    private func startSpeechCaptureIfPossible() {
        guard nativeTranscriptionRequested,
              !audioEngine.isRunning,
              let recognizer = SFSpeechRecognizer(locale: Locale(identifier: requestedSpeechLanguage)),
              recognizer.isAvailable
        else { return }

        configureAudioSession()
        speechRecognizer = recognizer
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.addsPunctuation = true
        request.taskHint = .dictation
        speechRequest = request

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else {
            scheduleSpeechRestart()
            return
        }

        if hasSpeechAudioTap {
            inputNode.removeTap(onBus: 0)
            hasSpeechAudioTap = false
        }
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
        }
        hasSpeechAudioTap = true

        audioEngine.prepare()
        do {
            try audioEngine.start()
        } catch {
            inputNode.removeTap(onBus: 0)
            hasSpeechAudioTap = false
            scheduleSpeechRestart()
            return
        }

        speechTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
            Task { @MainActor in
                guard let self, self.nativeTranscriptionRequested else { return }

                if let result {
                    let text = result.bestTranscription.formattedString
                        .trimmingCharacters(in: .whitespacesAndNewlines)
                    if !text.isEmpty {
                        self.sendNativeTranscript(text, isFinal: result.isFinal)
                    }
                    if result.isFinal {
                        self.scheduleSpeechRestart()
                        return
                    }
                }

                if error != nil {
                    self.scheduleSpeechRestart()
                }
            }
        }
    }

    private func scheduleSpeechRestart() {
        tearDownSpeechCapture()
        guard nativeTranscriptionRequested else { return }

        speechRestartTask?.cancel()
        speechRestartTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(180))
            guard !Task.isCancelled else { return }
            await MainActor.run {
                self?.startSpeechCaptureIfPossible()
            }
        }
    }

    private func stopNativeTranscription() {
        nativeTranscriptionRequested = false
        speechRestartTask?.cancel()
        speechRestartTask = nil
        tearDownSpeechCapture()
    }

    private func tearDownSpeechCapture() {
        speechTask?.cancel()
        speechTask = nil
        speechRequest?.endAudio()
        speechRequest = nil
        if audioEngine.isRunning {
            audioEngine.stop()
        }
        if hasSpeechAudioTap {
            audioEngine.inputNode.removeTap(onBus: 0)
            hasSpeechAudioTap = false
        }
    }

    private func sendNativeTranscript(_ text: String, isFinal: Bool) {
        let payload: [String: Any] = ["text": text, "isFinal": isFinal]
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8)
        else { return }

        webView.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent('kasa:native-transcript',{detail:\(json)}));"
        )
    }

    private static func speechLocale(for language: String) -> String {
        switch language.lowercased() {
        case "hindi", "hinglish", "hi", "hi-in":
            return "hi-IN"
        case "en-gb", "british":
            return "en-GB"
        default:
            return "en-US"
        }
    }

    private func notifyWebViewMicrophoneGranted() {
        webView.evaluateJavaScript(
            "window.dispatchEvent(new Event('kasa:microphone-granted'));"
        )
    }

    private static let nativeEnvironmentScript = """
    (() => {
      document.documentElement.dataset.kasaNative = 'ios';
      window.__KASA_NATIVE_IOS__ = true;
    })();
    """
}

extension KasaBrowserModel: WKNavigationDelegate {
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }

        if AppConfiguration.isTrusted(url) || url.scheme == "about" {
            decisionHandler(.allow)
            return
        }

        decisionHandler(.cancel)
        UIApplication.shared.open(url)
    }

    func webView(
        _ webView: WKWebView,
        didStartProvisionalNavigation navigation: WKNavigation?
    ) {
        isLoading = true
        lastError = nil
    }

    func webView(
        _ webView: WKWebView,
        didFinish navigation: WKNavigation?
    ) {
        isLoading = false
        currentURL = webView.url
        if webView.url?.path.hasPrefix("/workspace") == true {
            requestInitialAudioPermissions()
        } else {
            stopNativeTranscription()
        }
    }

    func webView(
        _ webView: WKWebView,
        didFail navigation: WKNavigation?,
        withError error: Error
    ) {
        report(error)
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation?,
        withError error: Error
    ) {
        report(error)
    }

    private func report(_ error: Error) {
        let nsError = error as NSError
        guard nsError.code != NSURLErrorCancelled else { return }

        isLoading = false
        lastError = "Kasa couldn't connect. Check your internet and try again."
    }
}

extension KasaBrowserModel: WKScriptMessageHandler {
    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == "kasaNative",
              let body = message.body as? [String: Any],
              let action = body["action"] as? String
        else { return }

        switch action {
        case "startTranscription":
            startNativeTranscription(language: body["language"] as? String ?? "english")
        case "stopTranscription":
            stopNativeTranscription()
        default:
            break
        }
    }
}

extension KasaBrowserModel: WKUIDelegate {
    func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        let isTrustedOrigin = origin.protocol == "https" &&
            AppConfiguration.allowedHosts.contains(origin.host.lowercased())

        decisionHandler(isTrustedOrigin ? .grant : .deny)
    }
}
