import Combine
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

    let webView: WKWebView

    private var observations: [NSKeyValueObservation] = []

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
