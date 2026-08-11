import SwiftUI
import WebKit

struct KasaWebView: UIViewRepresentable {
    @EnvironmentObject private var browser: KasaBrowserModel

    func makeUIView(context: Context) -> WKWebView {
        browser.webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}
}
