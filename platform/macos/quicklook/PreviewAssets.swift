import Foundation

struct PreviewPreferences: Decodable {
    let locale: String?
    let theme: String?
}

enum PreviewAssets {
    static let perImageByteCap = 4 * 1024 * 1024
    static let cumulativeByteCap = 8 * 1024 * 1024
    private static let supportedExtensions = Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico"])

    static func preferences() -> (locale: String, appearance: String) {
        let manager = FileManager.default
        let group = manager.containerURL(forSecurityApplicationGroupIdentifier: "group.app.textmark.desktop")
        let legacy = manager.homeDirectoryForCurrentUser.appendingPathComponent("Library/Group Containers/group.app.textmark.desktop")
        let directory = group ?? legacy
        return normalizedPreferences(
            sharedData: try? Data(contentsOf: directory.appendingPathComponent("settings-v3.json")),
            legacyData: try? Data(contentsOf: directory.appendingPathComponent("settings-v2.json"))
        )
    }

    static func normalizedPreferences(sharedData: Data?, legacyData: Data? = nil) -> (locale: String, appearance: String) {
        let fallback = ("zh-CN", "system")
        guard let data = sharedData ?? legacyData,
              let value = try? JSONDecoder().decode(PreviewPreferences.self, from: data) else { return fallback }
        let locale = value.locale == "en" ? "en" : "zh-CN"
        let appearance = ["light", "dark", "system"].contains(value.theme ?? "") ? value.theme! : "system"
        return (locale, appearance)
    }

    static func resolvedAppearance(_ appearance: String, systemIsDark: Bool) -> String {
        if appearance == "light" || appearance == "dark" { return appearance }
        return systemIsDark ? "dark" : "light"
    }

    static func inlineAssets(
        in markdown: String,
        relativeTo documentURL: URL,
        perImageByteCap: Int = PreviewAssets.perImageByteCap,
        cumulativeByteCap: Int = PreviewAssets.cumulativeByteCap,
        reader: (URL) throws -> Data = { try Data(contentsOf: $0) }
    ) -> [String: String] {
        let candidates = imageSources(in: markdown)
        let base = documentURL.deletingLastPathComponent().standardizedFileURL.resolvingSymlinksInPath()
        var result: [String: String] = [:]
        var bytes = 0
        for source in candidates where result[source] == nil {
            guard let file = resolve(source, base: base), supportedExtensions.contains(file.pathExtension.lowercased()),
                  let data = try? reader(file), data.count <= perImageByteCap, bytes + data.count <= cumulativeByteCap else { continue }
            bytes += data.count
            let mime = mimeType(file.pathExtension)
            result[source] = "data:\(mime);base64,\(data.base64EncodedString())"
        }
        return result
    }

    private static func imageSources(in markdown: String) -> [String] {
        let patterns = [
            #"!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s\)]+))"#,
            #"<img\b[^>]*?\bsrc\s*=\s*[\"']([^\"']+)[\"']"#,
        ]
        var values: [String] = []
        for (patternIndex, pattern) in patterns.enumerated() {
            guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { continue }
            let string = markdown as NSString
            for match in regex.matches(in: markdown, range: NSRange(location: 0, length: string.length)) {
                let ranges = patternIndex == 0 ? [1, 2] : [1]
                if let range = ranges.map({ match.range(at: $0) }).first(where: { $0.location != NSNotFound }) {
                    values.append(string.substring(with: range))
                }
            }
        }
        return values
    }

    private static func resolve(_ source: String, base: URL) -> URL? {
        guard !source.isEmpty, !source.hasPrefix("/"), !source.hasPrefix("\\"), !source.hasPrefix("#") else { return nil }
        let decoded = source.removingPercentEncoding ?? source
        guard !decoded.isEmpty, URL(string: decoded)?.scheme == nil else { return nil }
        let candidate = URL(fileURLWithPath: decoded, relativeTo: base).standardizedFileURL.resolvingSymlinksInPath()
        let basePath = base.path.hasSuffix("/") ? base.path : base.path + "/"
        guard candidate.path == base.path || candidate.path.hasPrefix(basePath) else { return nil }
        return candidate
    }

    private static func mimeType(_ pathExtension: String) -> String {
        switch pathExtension.lowercased() {
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "gif": return "image/gif"
        case "webp": return "image/webp"
        case "bmp": return "image/bmp"
        case "ico": return "image/x-icon"
        default: return "application/octet-stream"
        }
    }
}
