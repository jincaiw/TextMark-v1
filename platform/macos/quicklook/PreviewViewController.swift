import AppKit
import Quartz
import WebKit

private final class PreviewResourceSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "textmark-preview"
    private let root: URL

    init(root: URL) {
        self.root = root.resolvingSymlinksInPath().standardizedFileURL
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let requestURL = urlSchemeTask.request.url,
              requestURL.scheme == Self.scheme,
              requestURL.host == "bundle",
              let decodedPath = requestURL.path.removingPercentEncoding else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }
        let components = decodedPath.split(separator: "/", omittingEmptySubsequences: true)
        guard !components.isEmpty, !components.contains(where: { $0 == "." || $0 == ".." }) else {
            urlSchemeTask.didFailWithError(URLError(.noPermissionsToReadFile))
            return
        }
        let candidate = components.reduce(root) { partial, component in
            partial.appendingPathComponent(String(component), isDirectory: false)
        }.resolvingSymlinksInPath().standardizedFileURL
        let rootPath = root.path.hasSuffix("/") ? root.path : root.path + "/"
        guard candidate.path.hasPrefix(rootPath),
              (try? candidate.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) == true else {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
            return
        }
        do {
            let data = try Data(contentsOf: candidate, options: [.mappedIfSafe])
            let response = URLResponse(
                url: requestURL,
                mimeType: Self.mimeType(for: candidate.pathExtension),
                expectedContentLength: data.count,
                textEncodingName: Self.isText(candidate.pathExtension) ? "utf-8" : nil
            )
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(data)
            urlSchemeTask.didFinish()
        } catch {
            urlSchemeTask.didFailWithError(error)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private static func isText(_ pathExtension: String) -> Bool {
        ["html", "js", "css", "json", "map", "svg"].contains(pathExtension.lowercased())
    }

    private static func mimeType(for pathExtension: String) -> String {
        switch pathExtension.lowercased() {
        case "html": return "text/html"
        case "js", "mjs": return "text/javascript"
        case "css": return "text/css"
        case "json", "map": return "application/json"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "gif": return "image/gif"
        case "webp": return "image/webp"
        case "woff": return "font/woff"
        case "woff2": return "font/woff2"
        case "ttf": return "font/ttf"
        default: return "application/octet-stream"
        }
    }
}

@MainActor
final class PreviewViewController: NSViewController, QLPreviewingController, WKNavigationDelegate {
    enum PreviewFailure: Error { case unsupportedEncoding, missingRenderer, rendererTimeout }

    private(set) var webView: WKWebView!
    private var resourceHandler: PreviewResourceSchemeHandler?
    private var rendererDirectory: URL?

    override func loadView() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        let bundle = Bundle(for: PreviewViewController.self)
        if let renderer = bundle.url(forResource: "preview", withExtension: "html", subdirectory: "dist") {
            let directory = renderer.deletingLastPathComponent()
            let handler = PreviewResourceSchemeHandler(root: directory)
            configuration.setURLSchemeHandler(handler, forURLScheme: PreviewResourceSchemeHandler.scheme)
            rendererDirectory = directory
            resourceHandler = handler
        }
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
        _ = view
        guard rendererDirectory != nil,
              let renderer = URL(string: "\(PreviewResourceSchemeHandler.scheme)://bundle/preview.html") else {
            throw PreviewFailure.missingRenderer
        }
        webView.load(URLRequest(url: renderer))
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
        let allowed = navigationAction.navigationType == .other && (url?.scheme == PreviewResourceSchemeHandler.scheme || url?.scheme == "about")
        decisionHandler(allowed ? .allow : .cancel)
    }
}
