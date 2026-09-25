//
//  ViewController.swift
//  Shared (App) — volle Reader-UI aus App-Resources (Style.css + Script.js IIFE).
//

import WebKit

#if os(iOS)
import UIKit
typealias PlatformViewController = UIViewController
#elseif os(macOS)
import Cocoa
typealias PlatformViewController = NSViewController
#endif

class ViewController: PlatformViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        self.webView.navigationDelegate = self
        self.webView.uiDelegate = self
        self.webView.configuration.userContentController.add(self, name: "openExternal")
        self.webView.configuration.userContentController.add(self, name: "themeBg")
#if os(macOS)
        self.webView.addObserver(self, forKeyPath: "title", options: [.new], context: nil)
#endif

#if os(iOS)
        self.webView.scrollView.keyboardDismissMode = .interactive
        self.webView.scrollView.contentInsetAdjustmentBehavior = .never
        self.webView.scrollView.contentInset = .zero
        self.webView.scrollView.scrollIndicatorInsets = .zero
        self.webView.isOpaque = false
        let sepia = UIColor(red: 0.953, green: 0.906, blue: 0.827, alpha: 1)
        self.webView.backgroundColor = sepia
        self.webView.scrollView.backgroundColor = sepia
        self.view.backgroundColor = sepia
#endif

        loadHostReader()
    }

    deinit {
#if os(macOS)
        webView?.removeObserver(self, forKeyPath: "title")
#endif
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "openExternal")
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "themeBg")
    }

#if os(macOS)
    override func viewDidAppear() {
        super.viewDidAppear()
        guard let window = view.window else { return }
        let size = window.contentRect(forFrameRect: window.frame).size
        // Einmalig: alte Converter-Startgröße (425×325) auf 960×1200 heben.
        if size.width < 500, size.height < 450 {
            window.setContentSize(NSSize(width: 960, height: 1200))
            window.center()
        }
        syncWindowTitle()
    }
#endif

    private func loadHostReader() {
        // Main.html liegt in Base.lproj; Style.css / Script.js eine Ebene höher in Resources/
        guard let pageURL = Bundle.main.url(forResource: "Main", withExtension: "html"),
              let resourceDir = Bundle.main.resourceURL else {
            showFallback("App-Ressourcen fehlen. Bitte in Xcode Clean + Run.")
            return
        }

        var components = URLComponents(url: pageURL, resolvingAgainstBaseURL: false)
        var items = components?.queryItems ?? []
        if !items.contains(where: { $0.name == "host" }) {
            items.append(URLQueryItem(name: "host", value: "1"))
        }
        components?.queryItems = items
        let url = components?.url ?? pageURL

        webView.loadFileURL(url, allowingReadAccessTo: resourceDir)
    }

    private func showFallback(_ message: String) {
        let html = """
        <!DOCTYPE html><html><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <body style="font-family:-apple-system,sans-serif;padding:2rem;background:#f3e7d3;color:#3f2e1e">
        <h1>lang &amp; rund</h1><p>\(message)</p></body></html>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }

    private func openExternally(_ url: URL) {
#if os(iOS)
        UIApplication.shared.open(url, options: [:], completionHandler: nil)
#elseif os(macOS)
        NSWorkspace.shared.open(url)
#endif
    }

#if os(macOS)
    private func syncWindowTitle() {
        guard let title = webView.title, !title.isEmpty else { return }
        view.window?.title = title
    }

    override func observeValue(
        forKeyPath keyPath: String?,
        of object: Any?,
        change: [NSKeyValueChangeKey: Any]?,
        context: UnsafeMutableRawPointer?
    ) {
        if keyPath == "title" {
            syncWindowTitle()
            return
        }
        super.observeValue(forKeyPath: keyPath, of: object, change: change, context: context)
    }
#endif

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        if message.name == "openExternal", let href = message.body as? String,
           let url = URL(string: href) {
            openExternally(url)
            return
        }
#if os(iOS)
        if message.name == "themeBg", let hex = message.body as? String,
           let color = Self.color(fromHex: hex) {
            webView.backgroundColor = color
            webView.scrollView.backgroundColor = color
            view.backgroundColor = color
        }
#endif
    }

#if os(iOS)
    private static func color(fromHex hex: String) -> UIColor? {
        var s = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6, let value = UInt64(s, radix: 16) else { return nil }
        let r = CGFloat((value & 0xFF0000) >> 16) / 255
        let g = CGFloat((value & 0x00FF00) >> 8) / 255
        let b = CGFloat(value & 0x0000FF) / 255
        return UIColor(red: r, green: g, blue: b, alpha: 1)
    }
#endif

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }
        let scheme = url.scheme?.lowercased() ?? ""
        if scheme == "http" || scheme == "https" || scheme == "mailto" {
            openExternally(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
#if os(macOS)
        syncWindowTitle()
#endif
    }

#if os(macOS)
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
            let scheme = url.scheme?.lowercased() ?? ""
            if scheme == "http" || scheme == "https" || scheme == "mailto" {
                openExternally(url)
            }
        }
        return nil
    }
#endif

#if os(iOS)
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
            let scheme = url.scheme?.lowercased() ?? ""
            if scheme == "http" || scheme == "https" || scheme == "mailto" {
                openExternally(url)
            }
        }
        return nil
    }
#endif
}
