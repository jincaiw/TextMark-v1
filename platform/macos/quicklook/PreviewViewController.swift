import AppKit
import Quartz
@preconcurrency import WebKit

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


private final class CursorRegionMessageProxy: NSObject, WKScriptMessageHandler {
    weak var owner: QuickLookWebView?

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.frameInfo.isMainFrame else { return }
        owner?.updateCursorRegions(from: message.body)
    }
}

private final class QuickLookWebView: WKWebView {
    private struct CursorRegion {
        let rect: NSRect
        let cursor: NSCursor
    }

    private static let cursorRegionMessageName = "mdPreviewCursorRegions"
    private static let maximumVisibleCursorRegions = 4_096
    private var cursorRegions: [CursorRegion] = []

    override var acceptsFirstResponder: Bool { true }

    /// Quick Look hosts the preview in a remote ViewBridge hierarchy, where
    /// WebKit does not reliably receive command-key equivalents. Claim only
    /// bare Command-A/C (Caps Lock is harmless); Finder navigation keys remain
    /// untouched.
    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        guard event.type == .keyDown else { return super.performKeyEquivalent(with: event) }
        let modifiers = event.modifierFlags
            .intersection(.deviceIndependentFlagsMask)
            .subtracting(.capsLock)
        guard modifiers == .command else { return super.performKeyEquivalent(with: event) }
        switch event.charactersIgnoringModifiers?.lowercased() {
        case "a":
            evaluateJavaScript("(() => { const preview = document.querySelector('#preview'); const selection = getSelection(); if (!preview || !selection) return false; const range = document.createRange(); range.selectNodeContents(preview); selection.removeAllRanges(); selection.addRange(range); return true; })()")
            return true
        case "c":
            evaluateJavaScript("getSelection()?.toString() || ''") { value, _ in
                guard let text = value as? String, !text.isEmpty else { return }
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(text, forType: .string)
            }
            return true
        default:
            return super.performKeyEquivalent(with: event)
        }
    }

    override init(frame: CGRect, configuration: WKWebViewConfiguration) {
        let messageProxy = CursorRegionMessageProxy()
        configuration.userContentController.add(
            messageProxy,
            name: Self.cursorRegionMessageName
        )
        configuration.userContentController.addUserScript(WKUserScript(
            source: Self.cursorRegionReportingScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        super.init(frame: frame, configuration: configuration)
        messageProxy.owner = self
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func resetCursorRects() {
        super.resetCursorRects()
        for region in cursorRegions {
            let rect = region.rect.intersection(visibleRect)
            guard !rect.isNull, !rect.isEmpty else { continue }
            addCursorRect(rect, cursor: region.cursor)
        }
    }

    fileprivate func updateCursorRegions(from body: Any) {
        guard let rows = body as? [Any] else { return }

        cursorRegions = rows.prefix(Self.maximumVisibleCursorRegions).compactMap { row in
            guard let values = row as? [Any],
                  values.count == 5,
                  let kind = values[0] as? String,
                  let x = (values[1] as? NSNumber)?.doubleValue,
                  let y = (values[2] as? NSNumber)?.doubleValue,
                  let width = (values[3] as? NSNumber)?.doubleValue,
                  let height = (values[4] as? NSNumber)?.doubleValue,
                  [x, y, width, height].allSatisfy(\.isFinite),
                  width > 0,
                  height > 0 else { return nil }

            let localX = bounds.minX + x
            let localY = isFlipped ? bounds.minY + y : bounds.maxY - y - height
            let rect = NSRect(x: localX, y: localY, width: width, height: height)
                .intersection(bounds)
            guard !rect.isNull, !rect.isEmpty else { return nil }

            let cursor: NSCursor
            switch kind {
            case "text":
                cursor = .iBeam
            case "pointer":
                cursor = .pointingHand
            default:
                return nil
            }
            return CursorRegion(rect: rect, cursor: cursor)
        }

        window?.invalidateCursorRects(for: self)
    }

    fileprivate func clearCursorRegions() {
        cursorRegions = []
        window?.invalidateCursorRects(for: self)
    }

    // A Quick Look preview is hosted through ViewBridge. WebKit's direct
    // cursor update is not forwarded reliably across that remote-window
    // boundary, while AppKit cursor rects are. Cache DOM layout rectangles
    // when layout changes, then only project that cache while scrolling; no
    // mouse-move listener or per-hover DOM hit testing is involved.
    private static let cursorRegionReportingScript = """
    (() => {
        const handler = window.webkit?.messageHandlers?.mdPreviewCursorRegions;
        if (!handler) return;

        const pointerSelector = [
            'a[href]',
            'button:not([disabled])',
            'summary',
            '[role="button"]',
            'input[type="checkbox"]:not([disabled])',
            'input[type="radio"]:not([disabled])',
            '.md-code-copy'
        ].join(',');
        const textExclusionSelector = [
            'a', 'button', 'input', 'select', 'textarea', 'summary',
            '[role="button"]', '.md-code-copy', '.mermaid'
        ].join(',');

        let cachedRegions = [];
        let layoutFrame = null;
        let viewportFrame = null;
        let resizeObserver = null;
        let observedArticle = null;
        const maximumVisibleRegions = 4096;

        const isRenderable = (element) => {
            const style = getComputedStyle(element);
            return style.display !== 'none'
                && style.visibility !== 'hidden'
                && style.pointerEvents !== 'none';
        };

        const documentRect = (rect, scrollX, scrollY) => [
            rect.left + scrollX,
            rect.top + scrollY,
            rect.width,
            rect.height
        ];

        const clipsOverflow = (value) => [
            'auto', 'scroll', 'hidden', 'clip', 'overlay'
        ].includes(value);

        const clipToAncestors = (rect, startElement, article) => {
            let left = rect.left;
            let top = rect.top;
            let right = rect.right;
            let bottom = rect.bottom;

            for (let element = startElement; element; element = element.parentElement) {
                const style = getComputedStyle(element);
                const clipsX = clipsOverflow(style.overflowX);
                const clipsY = clipsOverflow(style.overflowY);
                if (clipsX || clipsY) {
                    const bounds = element.getBoundingClientRect();
                    const clipLeft = bounds.left + element.clientLeft;
                    const clipTop = bounds.top + element.clientTop;
                    const clipRight = clipLeft + element.clientWidth;
                    const clipBottom = clipTop + element.clientHeight;
                    if (clipsX) {
                        left = Math.max(left, clipLeft);
                        right = Math.min(right, clipRight);
                    }
                    if (clipsY) {
                        top = Math.max(top, clipTop);
                        bottom = Math.min(bottom, clipBottom);
                    }
                    if (right <= left || bottom <= top) return null;
                }
                if (element === article) break;
            }

            return {
                left,
                top,
                right,
                bottom,
                width: right - left,
                height: bottom - top
            };
        };

        const subtractRect = (rect, cut) => {
            const rectRight = rect[0] + rect[2];
            const rectBottom = rect[1] + rect[3];
            const cutRight = cut[0] + cut[2];
            const cutBottom = cut[1] + cut[3];
            const overlapLeft = Math.max(rect[0], cut[0]);
            const overlapTop = Math.max(rect[1], cut[1]);
            const overlapRight = Math.min(rectRight, cutRight);
            const overlapBottom = Math.min(rectBottom, cutBottom);
            if (overlapRight <= overlapLeft || overlapBottom <= overlapTop) {
                return [rect];
            }

            const pieces = [];
            if (overlapTop > rect[1]) {
                pieces.push([rect[0], rect[1], rect[2], overlapTop - rect[1]]);
            }
            if (overlapBottom < rectBottom) {
                pieces.push([rect[0], overlapBottom, rect[2], rectBottom - overlapBottom]);
            }
            if (overlapLeft > rect[0]) {
                pieces.push([
                    rect[0], overlapTop,
                    overlapLeft - rect[0], overlapBottom - overlapTop
                ]);
            }
            if (overlapRight < rectRight) {
                pieces.push([
                    overlapRight, overlapTop,
                    rectRight - overlapRight, overlapBottom - overlapTop
                ]);
            }
            return pieces;
        };

        const subtractRects = (rect, cuts) => {
            let pieces = [rect];
            for (const cut of cuts) {
                pieces = pieces.flatMap((piece) => subtractRect(piece, cut));
                if (pieces.length === 0) break;
            }
            return pieces;
        };

        const postVisibleRegions = () => {
            viewportFrame = null;
            const scrollX = window.scrollX;
            const scrollY = window.scrollY;
            const viewportWidth = document.documentElement.clientWidth;
            const viewportHeight = document.documentElement.clientHeight;
            const visiblePointerRects = [];
            const visibleTextRects = [];

            for (const [kind, documentX, documentY, width, height] of cachedRegions) {
                const x = documentX - scrollX;
                const y = documentY - scrollY;
                if (x + width <= 0 || y + height <= 0
                    || x >= viewportWidth || y >= viewportHeight) continue;

                const rect = [x, y, width, height];
                if (kind === 'pointer') {
                    visiblePointerRects.push(...subtractRects(rect, visiblePointerRects));
                } else {
                    visibleTextRects.push(rect);
                }
            }

            const visible = visiblePointerRects
                .slice(0, maximumVisibleRegions)
                .map((rect) => ['pointer', ...rect]);
            textRegions: for (const rect of visibleTextRects) {
                for (const piece of subtractRects(rect, visiblePointerRects)) {
                    if (visible.length >= maximumVisibleRegions) break textRegions;
                    visible.push(['text', ...piece]);
                }
            }
            handler.postMessage(visible);
        };

        const scheduleViewportProjection = () => {
            if (viewportFrame !== null) return;
            viewportFrame = requestAnimationFrame(postVisibleRegions);
        };

        const rebuildLayoutCache = () => {
            layoutFrame = null;
            if (viewportFrame !== null) {
                cancelAnimationFrame(viewportFrame);
                viewportFrame = null;
            }
            const article = document.querySelector('article.markdown-body');
            cachedRegions = [];
            if (!article) {
                handler.postMessage([]);
                return;
            }

            if (observedArticle !== article && window.ResizeObserver) {
                resizeObserver?.disconnect();
                resizeObserver = new ResizeObserver(scheduleLayoutRebuild);
                resizeObserver.observe(article);
                observedArticle = article;
            }

            const scrollX = window.scrollX;
            const scrollY = window.scrollY;

            for (const element of article.querySelectorAll(pointerSelector)) {
                if (!isRenderable(element) || element.getAttribute('aria-disabled') === 'true') {
                    continue;
                }
                for (const rect of element.getClientRects()) {
                    const clipped = clipToAncestors(rect, element.parentElement, article);
                    if (!clipped) continue;
                    cachedRegions.push([
                        'pointer',
                        ...documentRect(clipped, scrollX, scrollY)
                    ]);
                }
            }

            const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
                if (!node.nodeValue || !node.nodeValue.trim()) continue;
                const parent = node.parentElement;
                if (!parent || parent.closest(textExclusionSelector) || !isRenderable(parent)) {
                    continue;
                }

                const style = getComputedStyle(parent);
                if (style.userSelect === 'none' || style.webkitUserSelect === 'none') continue;

                const range = document.createRange();
                range.selectNodeContents(node);
                for (const rect of range.getClientRects()) {
                    const clipped = clipToAncestors(rect, parent, article);
                    if (!clipped) continue;
                    cachedRegions.push([
                        'text',
                        ...documentRect(clipped, scrollX, scrollY)
                    ]);
                }
            }

            postVisibleRegions();
        };

        function scheduleLayoutRebuild() {
            if (layoutFrame !== null) return;
            layoutFrame = requestAnimationFrame(rebuildLayoutCache);
        }

        const handleScroll = (event) => {
            const target = event.target;
            const rootScroll = target === window
                || target === document
                || target === document.scrollingElement
                || target === document.documentElement
                || target === document.body;
            if (rootScroll) {
                scheduleViewportProjection();
            } else {
                scheduleLayoutRebuild();
            }
        };

        addEventListener('scroll', handleScroll, true);
        addEventListener('resize', scheduleLayoutRebuild);
        document.addEventListener('DOMContentLoaded', scheduleLayoutRebuild, { once: true });
        document.addEventListener('load', scheduleLayoutRebuild, true);
        document.addEventListener('error', scheduleLayoutRebuild, true);
        document.addEventListener('toggle', scheduleLayoutRebuild, true);
        for (const eventName of [
            'md-preview-math-rendered',
            'md-preview-hljs-rendered',
            'md-preview-mermaid-rendered'
        ]) {
            addEventListener(eventName, scheduleLayoutRebuild);
        }
        document.fonts?.ready.then(scheduleLayoutRebuild);
        scheduleLayoutRebuild();
    })();
    """
}


@MainActor
final class PreviewViewController: NSViewController, QLPreviewingController, WKNavigationDelegate {
    enum PreviewFailure: Error { case unsupportedEncoding, missingRenderer, rendererTimeout }

    private var webView: QuickLookWebView!
    private var resourceHandler: PreviewResourceSchemeHandler?
    private var rendererDirectory: URL?
    private let copyButton = NSButton(title: "Copy Markdown", target: nil, action: nil)
    private var sourceForCopy = ""

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
        webView = QuickLookWebView(frame: NSRect(x: 0, y: 0, width: 900, height: 900), configuration: configuration)
        webView.navigationDelegate = self
        webView.underPageBackgroundColor = .clear
        let container = NSView(frame: webView.frame)
        webView.autoresizingMask = [.width, .height]
        container.addSubview(webView)
        copyButton.bezelStyle = .rounded
        copyButton.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        copyButton.target = self
        copyButton.action = #selector(copySource)
        copyButton.isHidden = true
        copyButton.frame = NSRect(x: 780, y: 12, width: 108, height: 28)
        copyButton.autoresizingMask = [.minXMargin, .maxYMargin]
        container.addSubview(copyButton)
        view = container
        preferredContentSize = NSSize(width: 900, height: 900)
    }

    func preparePreviewOfFile(at url: URL) async throws {
        let values = try url.resourceValues(forKeys: [.fileSizeKey])
        if let fileSize = values.fileSize, fileSize > 32 * 1024 * 1024 {
            throw PreviewFailure.unsupportedEncoding
        }
        let data = try Data(contentsOf: url, options: [.mappedIfSafe])
        guard data.count <= 32 * 1024 * 1024, let source = String(data: data, encoding: .utf8) else { throw PreviewFailure.unsupportedEncoding }
        sourceForCopy = source
        copyButton.isHidden = true
        _ = view
        webView.clearCursorRegions()
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
        copyButton.isHidden = false
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.view.window?.makeFirstResponder(self.webView)
        }
    }

    @objc private func copySource() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(sourceForCopy, forType: .string)
        copyButton.title = "Copied"
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { [weak self] in
            self?.copyButton.title = "Copy Markdown"
        }
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
