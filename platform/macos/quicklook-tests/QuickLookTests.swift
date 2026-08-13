import AppKit
import XCTest

final class QuickLookTests: XCTestCase {
    private func preferencesData(locale: String? = nil, theme: String? = nil) throws -> Data {
        var value: [String: String] = [:]
        if let locale { value["locale"] = locale }
        if let theme { value["theme"] = theme }
        return try JSONSerialization.data(withJSONObject: value)
    }

    func testAppearanceDefaultsRoundTripsAndResolvesSystemMode() throws {
        XCTAssertEqual(PreviewAssets.normalizedPreferences(sharedData: nil).locale, "zh-CN")
        XCTAssertEqual(PreviewAssets.normalizedPreferences(sharedData: try preferencesData(theme: "sepia")).appearance, "system")
        for appearance in ["system", "light", "dark"] {
            XCTAssertEqual(PreviewAssets.normalizedPreferences(sharedData: try preferencesData(locale: "en", theme: appearance)).appearance, appearance)
        }
        XCTAssertEqual(PreviewAssets.resolvedAppearance("light", systemIsDark: true), "light")
        XCTAssertEqual(PreviewAssets.resolvedAppearance("dark", systemIsDark: false), "dark")
        XCTAssertEqual(PreviewAssets.resolvedAppearance("system", systemIsDark: true), "dark")
        XCTAssertEqual(PreviewAssets.resolvedAppearance("system", systemIsDark: false), "light")
    }

    func testLegacyPreferencesAreReadOnlyWhenSharedSettingsAreMissing() throws {
        let legacy = try preferencesData(locale: "en", theme: "light")
        let shared = try preferencesData(locale: "zh-CN", theme: "dark")
        XCTAssertEqual(PreviewAssets.normalizedPreferences(sharedData: nil, legacyData: legacy).appearance, "light")
        XCTAssertEqual(PreviewAssets.normalizedPreferences(sharedData: shared, legacyData: legacy).appearance, "dark")
    }

    func testRelativeAssetInliningRejectsTraversalAndHonorsTheBudget() throws {
        let base = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: base) }
        let document = base.appendingPathComponent("README.md")
        let image = base.appendingPathComponent("local.png")
        try Data([0x89, 0x50, 0x4e, 0x47]).write(to: image)
        let assets = PreviewAssets.inlineAssets(in: "![ok](local.png) ![no](../secret.png)", relativeTo: document)
        XCTAssertTrue(assets["local.png"]?.hasPrefix("data:image/png;base64,") == true)
        XCTAssertNil(assets["../secret.png"])
    }

    func testAssetInliningDecodesPathsNormalizesMimeAndDeduplicates() throws {
        let base = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: base.appendingPathComponent("images dir"), withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: base) }
        let document = base.appendingPathComponent("README.md")
        try Data([1, 2, 3]).write(to: base.appendingPathComponent("images dir/two words.png"))
        try Data([4, 5]).write(to: base.appendingPathComponent("UPPER.JPG"))
        let markdown = "![a](images%20dir/two%20words.png) ![again](images%20dir/two%20words.png) <img src='UPPER.JPG'>"
        let assets = PreviewAssets.inlineAssets(in: markdown, relativeTo: document)
        XCTAssertEqual(assets.count, 2)
        XCTAssertTrue(assets["images%20dir/two%20words.png"]?.hasPrefix("data:image/png;base64,") == true)
        XCTAssertTrue(assets["UPPER.JPG"]?.hasPrefix("data:image/jpeg;base64,") == true)
    }

    func testAssetInliningLeavesRemoteAbsoluteEncodedAndUnsupportedSourcesAlone() throws {
        let document = FileManager.default.temporaryDirectory.appendingPathComponent("README.md")
        let sources = [
            "https://example.com/a.png", "data:image/png;base64,AAAA", "cid:already", "/etc/passwd",
            "../secret.png", "%2Fetc%2Fpasswd", "file%3A%2F%2F%2Fetc%2Fpasswd", "payload.svg",
        ]
        let markdown = sources.map { "![x](\($0))" }.joined(separator: " ")
        let assets = PreviewAssets.inlineAssets(in: markdown, relativeTo: document) { _ in
            XCTFail("unsafe sources must not reach the file reader")
            return Data()
        }
        XCTAssertTrue(assets.isEmpty)
    }

    func testAssetInliningToleratesReadFailureAndEnforcesBothBudgets() throws {
        let base = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: base) }
        let document = base.appendingPathComponent("README.md")
        let markdown = "![missing](missing.png) ![a](a.png) ![b](b.png) ![large](large.png)"
        let values = ["a.png": Data(repeating: 1, count: 3), "b.png": Data(repeating: 2, count: 3), "large.png": Data(repeating: 3, count: 8)]
        let assets = PreviewAssets.inlineAssets(in: markdown, relativeTo: document, perImageByteCap: 5, cumulativeByteCap: 5) { url in
            guard let data = values[url.lastPathComponent] else { throw CocoaError(.fileReadNoSuchFile) }
            return data
        }
        XCTAssertEqual(Set(assets.keys), Set(["a.png"]))
    }

    @MainActor
    func testNativeHostRendersChineseMarkdownAndLocalImage() async throws {
        _ = NSApplication.shared
        let base = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: base) }
        let document = base.appendingPathComponent("README.md")
        let png = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")!
        try png.write(to: base.appendingPathComponent("local.png"))
        try "# 本地预览\n\n![图片](local.png)".write(to: document, atomically: true, encoding: .utf8)
        let controller = PreviewViewController()
        _ = controller.view
        try await controller.preparePreviewOfFile(at: document)
        let snapshot = try await controller.renderedSnapshotForTesting()
        XCTAssertTrue(snapshot.contains("本地预览"))
        XCTAssertTrue(snapshot.contains("data:image/png;base64"))
    }
}
