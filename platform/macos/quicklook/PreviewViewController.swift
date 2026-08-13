import AppKit
import Quartz
import WebKit

@MainActor
final class PreviewViewController: NSViewController, QLPreviewingController, WKNavigationDelegate {
    enum PreviewFailure: Error { case unsupportedEncoding, missingRenderer, rendererTimeout }

    private(set) var webView: WKWebView!

    override func loadView() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 900, height: 900), configuration: configuration)
        webView.navigationDelegate = self
        webView.underPageBackgroundColor = .clear
        view = webView
        preferredContentSize = NSSize(width: 900, height: 900)
    }

    func preparePreviewOfFile(at url: URL) async throws {
        let values = try url.resourceValues(forKeys: [.fileSizeKey])
        if let fileSize = values.fileSize, fileSize > 32 * 1024 * 1024 {
            throw PreviewFailure.unsupportedEncoding
        }
        let data = try Data(contentsOf: url, options: [.mappedIfSafe])
        guard data.count <= 32 * 1024 * 1024, let source = String(data: data, encoding: .utf8) else { throw PreviewFailure.unsupportedEncoding }
        let bundle = Bundle(for: PreviewViewController.self)
        guard let renderer = bundle.url(forResource: "preview", withExtension: "html", subdirectory: "dist"),
              let directory = renderer.deletingLastPathComponent() as URL? else { throw PreviewFailure.missingRenderer }
        _ = view
        webView.loadFileURL(renderer, allowingReadAccessTo: directory)
        try await waitUntilReady()
        let preferences = PreviewAssets.preferences()
        let request: [String: Any] = [
            "source": source,
            "locale": preferences.locale,
            "appearance": preferences.appearance,
            "assets": PreviewAssets.inlineAssets(in: source, relativeTo: url),
        ]
        let requestData = try JSONSerialization.data(withJSONObject: request)
        guard let requestJSON = String(data: requestData, encoding: .utf8) else { throw PreviewFailure.unsupportedEncoding }
        _ = try await webView.callAsyncJavaScript(
            "return await window.TextMarkPreview.render(JSON.parse(requestJSON));",
            arguments: ["requestJSON": requestJSON],
            in: nil,
            contentWorld: .page
        )
    }

    private func waitUntilReady() async throws {
        for _ in 0..<80 {
            if let ready = try? await webView.evaluateJavaScript("typeof window.TextMarkPreview?.render === 'function'") as? Bool, ready { return }
            try await Task.sleep(nanoseconds: 25_000_000)
        }
        throw PreviewFailure.rendererTimeout
    }

    func renderedSnapshotForTesting() async throws -> String {
        try await webView.evaluateJavaScript("document.querySelector('#preview')?.outerHTML || ''") as? String ?? ""
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let url = navigationAction.request.url
        let allowed = navigationAction.navigationType == .other && (url?.isFileURL == true || url?.scheme == "about")
        decisionHandler(allowed ? .allow : .cancel)
    }
}
