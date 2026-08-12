import AVFAudio
import Combine
import OSLog
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
    @Published private(set) var audioRouteDescription = "iPhone microphone"
    @Published private(set) var audioCaptureIssue: String?

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
    private var audioFailureRetryCount = 0
    private var lastAudioRouteFingerprint = ""
    private let logger = Logger(subsystem: "in.getkasa.mobile", category: "AudioCapture")

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
        observeAudioSession()
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

    private func observeAudioSession() {
        let center = NotificationCenter.default
        center.addObserver(
            self,
            selector: #selector(handleAudioRouteChange(_:)),
            name: AVAudioSession.routeChangeNotification,
            object: nil
        )
        center.addObserver(
            self,
            selector: #selector(handleAudioInterruption(_:)),
            name: AVAudioSession.interruptionNotification,
            object: nil
        )
        center.addObserver(
            self,
            selector: #selector(handleAudioMediaServicesReset(_:)),
            name: AVAudioSession.mediaServicesWereResetNotification,
            object: nil
        )
    }

    private func configureAudioSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(
            .playAndRecord,
            mode: .voiceChat,
            options: [.allowBluetoothHFP, .defaultToSpeaker]
        )
        try session.setActive(true, options: .notifyOthersOnDeactivation)

        // Bluetooth headphones expose their microphone as an HFP input. Selecting
        // that input explicitly prevents iOS from silently falling back to the
        // handset microphone after a route change.
        if let bluetoothInput = session.availableInputs?.first(where: {
            $0.portType == .bluetoothHFP
        }) {
            try session.setPreferredInput(bluetoothInput)
        }

        publishCurrentAudioRoute()
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

        do {
            try configureAudioSession()
            audioCaptureIssue = nil
            audioFailureRetryCount = 0
        } catch {
            reportAudioSessionFailure(error)
            scheduleAudioFailureRestart()
            return
        }
        speechRecognizer = recognizer
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.addsPunctuation = true
        request.taskHint = .dictation
        speechRequest = request

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else {
            scheduleAudioFailureRestart()
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
            reportAudioSessionFailure(error)
            scheduleAudioFailureRestart()
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

    private func scheduleSpeechRestart(after delay: Duration = .milliseconds(180)) {
        tearDownSpeechCapture()
        guard nativeTranscriptionRequested else { return }

        speechRestartTask?.cancel()
        speechRestartTask = Task { [weak self] in
            try? await Task.sleep(for: delay)
            guard !Task.isCancelled else { return }
            await MainActor.run {
                self?.startSpeechCaptureIfPossible()
            }
        }
    }

    private func scheduleAudioFailureRestart() {
        audioFailureRetryCount += 1
        let delayMilliseconds = min(5_000, 700 * audioFailureRetryCount)
        scheduleSpeechRestart(after: .milliseconds(delayMilliseconds))
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

    @objc private func handleAudioRouteChange(_ notification: Notification) {
        let reasonValue = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt
        let reason = reasonValue.flatMap(AVAudioSession.RouteChangeReason.init(rawValue:))
        logger.info("Audio route changed; reason=\(String(describing: reason), privacy: .public)")
        let didActuallyChange = publishCurrentAudioRoute()

        guard nativeTranscriptionRequested, didActuallyChange else { return }
        audioFailureRetryCount = 0
        scheduleSpeechRestart(after: .milliseconds(350))
    }

    @objc private func handleAudioInterruption(_ notification: Notification) {
        guard let rawType = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: rawType)
        else { return }

        switch type {
        case .began:
            audioCaptureIssue = "A call is using iPhone audio. Kasa will resume when iOS releases the microphone."
            logger.notice("Audio capture interrupted by another audio session")
            tearDownSpeechCapture()
        case .ended:
            audioCaptureIssue = nil
            audioFailureRetryCount = 0
            guard nativeTranscriptionRequested else { return }
            scheduleSpeechRestart(after: .milliseconds(500))
        @unknown default:
            break
        }
    }

    @objc private func handleAudioMediaServicesReset(_ notification: Notification) {
        logger.notice("iOS audio services reset; rebuilding the capture pipeline")
        guard nativeTranscriptionRequested else { return }
        scheduleSpeechRestart(after: .milliseconds(500))
    }

    @discardableResult
    private func publishCurrentAudioRoute() -> Bool {
        let session = AVAudioSession.sharedInstance()
        let inputs = session.currentRoute.inputs.map(\.portName)
        let outputs = session.currentRoute.outputs.map(\.portName)
        let inputLabel = inputs.isEmpty ? "No input" : inputs.joined(separator: ", ")
        let outputLabel = outputs.isEmpty ? "No output" : outputs.joined(separator: ", ")
        let fingerprint = "\(inputLabel)|\(outputLabel)"
        let didChange = fingerprint != lastAudioRouteFingerprint
        lastAudioRouteFingerprint = fingerprint
        audioRouteDescription = "\(inputLabel) → \(outputLabel)"

        logger.info(
            "Active route input=\(inputLabel, privacy: .public), output=\(outputLabel, privacy: .public)"
        )

        let payload: [String: Any] = [
            "input": inputLabel,
            "output": outputLabel,
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8)
        else { return didChange }
        webView.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent('kasa:native-audio-route',{detail:\(json)}));"
        )
        return didChange
    }

    private func reportAudioSessionFailure(_ error: Error) {
        let nsError = error as NSError
        logger.error(
            "Audio capture failed domain=\(nsError.domain, privacy: .public) code=\(nsError.code) message=\(nsError.localizedDescription, privacy: .public)"
        )

        if nsError.code == AVAudioSession.ErrorCode.insufficientPriority.rawValue {
            audioCaptureIssue = "The active call owns iPhone audio, so iOS is not providing its sound to Kasa."
        } else {
            audioCaptureIssue = "Audio input paused. Kasa is reconnecting automatically."
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
