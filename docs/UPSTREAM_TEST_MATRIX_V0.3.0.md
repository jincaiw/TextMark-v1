# TextMark v0.8.1 upstream test traceability

Frozen reference: `pluk-inc/markdown-preview@main`, commit `53f4d35cd81b237e20c6011dc20f41d8c54aa914` (v0.0.49 plus the sidebar-selection fix).

This matrix was originally audited against every test function present in the v0.0.47 reference Swift package. The current upstream baseline contains **165** behaviors, up from 139. “Behavior” means TextMark tests the same user-visible contract in its portable implementation. “Native” means the matching macOS adapter test runs under Xcode. “Equivalent” is reserved for an AppKit/WKWebView implementation detail that does not exist in Tauri; the replacement boundary and user-visible result are tested instead. “Stricter” or “Superset” records an intentional security or capability improvement over the baseline.

## v0.0.48–v0.0.49 delta under implementation

| Upstream addition | TextMark status | Evidence / gate |
| --- | --- | --- |
| Render all Mermaid before output; temporary light print theme | Behavior | `PreviewPane` hydration signal; output actions wait before capture; `export.test.ts` + print CSS contract |
| Always on Top respects full-screen spaces | Behavior | `src/lib/alwaysOnTop.test.ts`; native Tauri full-screen E2E pending |
| Final blank in a blank run is compact | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts` |
| Larger, correctly offset list bullets | Behavior | `src/App.css`; visual golden pending |
| Quick Look immediate ⌘A/⌘C and copy source | Release gate | `PreviewViewController.swift`; Xcode Quick Look tests pending |
| Native multi-pane Settings | Behavior | dedicated Tauri Settings window; v1–v4 preference migration is covered by `useSettings.test.ts` |
| Sidebar selection only commits after navigation succeeds | Equivalent | active document state owns `Sidebar.activePath`; failure-path E2E pending |

A row is release-green only when its named local test and, where applicable, the native GitHub runner pass. The release workflow cannot publish while any native job is red.

## Suite inventory

| Upstream suite | Behaviors |
| --- | ---: |
| `CodeFenceInfoTests` | 9 |
| `URLSchemeTaskCallbackGateTests` | 3 |
| `MarkdownHTMLPrintStyleTests` | 6 |
| `MarkdownHTMLVendorPlacementTests` | 4 |
| `InitialRenderProbeTests` | 1 |
| `MarkdownFrontmatterTests` | 12 |
| `FileWatcherMoveResolutionTests` | 4 |
| `MermaidPopupSizingTests` | 8 |
| `MarkdownAssetResolutionTests` | 10 |
| `EscapingHTMLFormatterTests` | 15 |
| `MarkdownHTMLRenderTests` | 44 |
| `QuickLookAppearanceTests` | 4 |
| `MdPreviewUpdateTests` | 3 |
| `InlineLocalAssetsTests` | 16 |
| **Total** | **139** |

## One-to-one mapping

| # | Upstream behavior | Mapping | TextMark evidence |
| ---: | --- | --- | --- |
| 1 | `CodeFenceInfoTests.testBareLanguageBecomesLowercaseLanguageWithEmptyMetadata` | Behavior | `src/lib/codeFence.test.ts`; `src/lib/markdown.parity.test.ts` |
| 2 | `CodeFenceInfoTests.testFirstWhitespaceSeparatedTokenIsTheLanguage` | Behavior | `src/lib/codeFence.test.ts`; `src/lib/markdown.parity.test.ts` |
| 3 | `CodeFenceInfoTests.testTabsAlsoSeparateLanguageFromMetadata` | Behavior | `src/lib/codeFence.test.ts`; `src/lib/markdown.parity.test.ts` |
| 4 | `CodeFenceInfoTests.testMetadataPreservesInternalWhitespaceAndCasing` | Behavior | `src/lib/codeFence.test.ts`; `src/lib/markdown.parity.test.ts` |
| 5 | `CodeFenceInfoTests.testLeadingAndTrailingWhitespaceIsTrimmedBeforeSplitting` | Behavior | `src/lib/codeFence.test.ts`; `src/lib/markdown.parity.test.ts` |
| 6 | `CodeFenceInfoTests.testNilInfoStringYieldsEmptyValues` | Behavior | `src/lib/codeFence.test.ts`; `src/lib/markdown.parity.test.ts` |
| 7 | `CodeFenceInfoTests.testEmptyInfoStringYieldsEmptyValues` | Behavior | `src/lib/codeFence.test.ts`; `src/lib/markdown.parity.test.ts` |
| 8 | `CodeFenceInfoTests.testWhitespaceOnlyInfoStringYieldsEmptyValues` | Behavior | `src/lib/codeFence.test.ts`; `src/lib/markdown.parity.test.ts` |
| 9 | `CodeFenceInfoTests.testShellAliasesUseBashForReadModeHighlighting` | Behavior | `src/lib/codeFence.test.ts`; `src/lib/markdown.parity.test.ts` |
| 10 | `URLSchemeTaskCallbackGateTests.testStopPreventsLaterCallbacks` | Equivalent | `src/lib/assets.test.ts`; typed Tauri IPC + native E2E (no `WKURLSchemeTask` in this architecture) |
| 11 | `URLSchemeTaskCallbackGateTests.testStopWaitsForCurrentCallbackAndPreventsNextCallback` | Equivalent | `src/lib/assets.test.ts`; typed Tauri IPC + native E2E (no `WKURLSchemeTask` in this architecture) |
| 12 | `URLSchemeTaskCallbackGateTests.testCallbackCanStopReentrantly` | Equivalent | `src/lib/assets.test.ts`; typed Tauri IPC + native E2E (no `WKURLSchemeTask` in this architecture) |
| 13 | `MarkdownHTMLPrintStyleTests.testPrintBodyIsSizedInPointsAtTheDefault` | Behavior | `src/lib/styleContract.test.ts`; `src/lib/export.test.ts` |
| 14 | `MarkdownHTMLPrintStyleTests.testPrintForcesTheLightPaletteRegardlessOfSystemAppearance` | Behavior | `src/lib/styleContract.test.ts`; `src/lib/export.test.ts` |
| 15 | `MarkdownHTMLPrintStyleTests.testPrintAvoidsBreakingBlocksAcrossPages` | Behavior | `src/lib/styleContract.test.ts`; `src/lib/export.test.ts` |
| 16 | `MarkdownHTMLPrintStyleTests.testPrintDropsScreenOnlyAffordances` | Behavior | `src/lib/styleContract.test.ts`; `src/lib/export.test.ts` |
| 17 | `MarkdownHTMLPrintStyleTests.testPrintBlockFollowsTheScreenBodyRuleSoItWinsTheCascade` | Behavior | `src/lib/styleContract.test.ts`; `src/lib/export.test.ts` |
| 18 | `MarkdownHTMLPrintStyleTests.testPreviewFidelityExportUsesTheReadOnlyPageGeometry` | Behavior | `src/lib/styleContract.test.ts`; `src/lib/export.test.ts` |
| 19 | `MarkdownHTMLVendorPlacementTests.testInlineModeEmitsEarlyPopulateAfterTemplate` | Equivalent | `vite.config.ts`; `scripts/check-bundle-budget.mjs`; Worker/native E2E (no inline WebKit vendor bootstrap) |
| 20 | `MarkdownHTMLVendorPlacementTests.testLazyModeKeepsBodyFreeOfVendorScripts` | Equivalent | `vite.config.ts`; `scripts/check-bundle-budget.mjs`; Worker/native E2E (no inline WebKit vendor bootstrap) |
| 21 | `MarkdownHTMLVendorPlacementTests.testInlineDocumentPopulatesArticleBeforeDOMContentLoaded` | Equivalent | `vite.config.ts`; `scripts/check-bundle-budget.mjs`; Worker/native E2E (no inline WebKit vendor bootstrap) |
| 22 | `MarkdownHTMLVendorPlacementTests.testInlineWarmupDocumentStaysHiddenAfterEarlyPopulate` | Equivalent | `vite.config.ts`; `scripts/check-bundle-budget.mjs`; Worker/native E2E (no inline WebKit vendor bootstrap) |
| 23 | `InitialRenderProbeTests.testRenderScaling` | Behavior | `src/lib/performance.test.ts`; bundle budget gate |
| 24 | `MarkdownFrontmatterTests.testSplitsYamlFrontmatter` | Behavior | `src/lib/frontmatter.test.ts` |
| 25 | `MarkdownFrontmatterTests.testSplitsYamlFrontmatterWithEllipsisCloser` | Behavior | `src/lib/frontmatter.test.ts` |
| 26 | `MarkdownFrontmatterTests.testSplitsTomlFrontmatter` | Behavior | `src/lib/frontmatter.test.ts` |
| 27 | `MarkdownFrontmatterTests.testDoesNotSplitTomlFrontmatterWithYamlCloser` | Behavior | `src/lib/frontmatter.test.ts` |
| 28 | `MarkdownFrontmatterTests.testDoesNotSplitPlusSignsAwayFromDocumentStart` | Behavior | `src/lib/frontmatter.test.ts` |
| 29 | `MarkdownFrontmatterTests.testParsesYamlEntries` | Behavior | `src/lib/frontmatter.test.ts` |
| 30 | `MarkdownFrontmatterTests.testUnquotesYamlScalars` | Behavior | `src/lib/frontmatter.test.ts` |
| 31 | `MarkdownFrontmatterTests.testParsesYamlFlowSequenceAsItems` | Behavior | `src/lib/frontmatter.test.ts` |
| 32 | `MarkdownFrontmatterTests.testParsesYamlBlockSequenceItemsAtKeyIndent` | Behavior | `src/lib/frontmatter.test.ts` |
| 33 | `MarkdownFrontmatterTests.testFoldsYamlBlockScalarWithoutIndicatorLeak` | Behavior | `src/lib/frontmatter.test.ts` |
| 34 | `MarkdownFrontmatterTests.testStripsYamlTrailingCommentsAndCommentLines` | Behavior | `src/lib/frontmatter.test.ts` |
| 35 | `MarkdownFrontmatterTests.testParsesTomlEntries` | Behavior | `src/lib/frontmatter.test.ts` |
| 36 | `FileWatcherMoveResolutionTests.testReplacementAtOriginalPathWinsOverMovedInode` | Behavior | `src/lib/diskChange.test.ts`; native rename/delete E2E |
| 37 | `FileWatcherMoveResolutionTests.testRenameIsFollowedWhenOriginalPathStaysAbsent` | Behavior | `src/lib/diskChange.test.ts`; native rename/delete E2E |
| 38 | `FileWatcherMoveResolutionTests.testDeleteWithoutMovedFileRemainsUnavailable` | Behavior | `src/lib/diskChange.test.ts`; native rename/delete E2E |
| 39 | `FileWatcherMoveResolutionTests.testOriginalDescriptorPathIsNotTreatedAsRename` | Behavior | `src/lib/diskChange.test.ts`; native rename/delete E2E |
| 40 | `MermaidPopupSizingTests.testFitsLargeDiagramIntoScreen` | Behavior | `src/lib/mermaidSizing.test.ts`; diagram interaction tests |
| 41 | `MermaidPopupSizingTests.testPrefersNaturalSizeOverCappedDisplay` | Behavior | `src/lib/mermaidSizing.test.ts`; diagram interaction tests |
| 42 | `MermaidPopupSizingTests.testCappedDisplayDoesNotOverrideNaturalAspectRatio` | Behavior | `src/lib/mermaidSizing.test.ts`; diagram interaction tests |
| 43 | `MermaidPopupSizingTests.testUpscalesTinyDiagramsToReadableMinimum` | Behavior | `src/lib/mermaidSizing.test.ts`; diagram interaction tests |
| 44 | `MermaidPopupSizingTests.testFallsBackToDisplayWhenNaturalMissing` | Behavior | `src/lib/mermaidSizing.test.ts`; diagram interaction tests |
| 45 | `MermaidPopupSizingTests.testCanPresentRejectsEmptySVG` | Behavior | `src/lib/mermaidSizing.test.ts`; diagram interaction tests |
| 46 | `MermaidPopupSizingTests.testSanitizedSVGHTMLNeutralizesScriptTags` | Behavior | `src/lib/mermaidSizing.test.ts`; diagram interaction tests |
| 47 | `MermaidPopupSizingTests.testSanitizedSVGHTMLDoesNotStripEventHandlerAttributes` | Stricter | DOMPurify removes `on*` handlers in addition to CSP enforcement; sanitizer tests |
| 48 | `MarkdownAssetResolutionTests.testBaseHrefMirrorsFolderPathWithTrailingSlash` | Equivalent | `src/lib/assets.test.ts`; `src/lib/platform.test.ts`; guarded Tauri IPC replaces `file:` base URLs |
| 49 | `MarkdownAssetResolutionTests.testBaseHrefPercentEncodesSpecialCharacters` | Equivalent | `src/lib/assets.test.ts`; `src/lib/platform.test.ts`; guarded Tauri IPC replaces `file:` base URLs |
| 50 | `MarkdownAssetResolutionTests.testFileURLMapsAssetPathToAbsoluteFilePath` | Equivalent | `src/lib/assets.test.ts`; `src/lib/platform.test.ts`; Rust canonical-path boundary |
| 51 | `MarkdownAssetResolutionTests.testFileURLDecodesPercentEncoding` | Equivalent | `src/lib/assets.test.ts`; `src/lib/platform.test.ts`; Rust canonical-path boundary |
| 52 | `MarkdownAssetResolutionTests.testFileURLStandardizesTraversalSegments` | Equivalent | `src/lib/assets.test.ts`; `src/lib/platform.test.ts`; Rust canonical-path boundary |
| 53 | `MarkdownAssetResolutionTests.testFileURLRejectsRootAndEmptyPaths` | Equivalent | `src/lib/assets.test.ts`; `src/lib/platform.test.ts`; Rust canonical-path boundary |
| 54 | `MarkdownAssetResolutionTests.testFileURLRejectsNonEmptyHost` | Equivalent | `src/lib/assets.test.ts`; `src/lib/platform.test.ts`; Rust canonical-path boundary |
| 55 | `MarkdownAssetResolutionTests.testFileURLRejectsOtherSchemes` | Equivalent | `src/lib/assets.test.ts`; `src/lib/platform.test.ts`; Rust canonical-path boundary |
| 56 | `MarkdownAssetResolutionTests.testParentRelativeLinkResolvesAgainstBaseHref` | Equivalent | `src/lib/assets.test.ts`; `src/lib/platform.test.ts`; guarded sibling-path resolver |
| 57 | `MarkdownAssetResolutionTests.testSameFolderRelativeLinkResolvesAgainstBaseHref` | Equivalent | `src/lib/assets.test.ts`; `src/lib/platform.test.ts`; guarded sibling-path resolver |
| 58 | `EscapingHTMLFormatterTests.testTaskCheckboxSourceTogglesExactSourceLine` | Behavior | `src/lib/task.test.ts`; `src/lib/markdown.parity.test.ts`; sanitizer tests |
| 59 | `EscapingHTMLFormatterTests.testTaskCheckboxSourceRejectsNonTaskLine` | Behavior | `src/lib/task.test.ts`; `src/lib/markdown.parity.test.ts`; sanitizer tests |
| 60 | `EscapingHTMLFormatterTests.testTaskCheckboxSourceSupportsQuotedAndOrderedTasks` | Behavior | `src/lib/task.test.ts`; `src/lib/markdown.parity.test.ts`; sanitizer tests |
| 61 | `EscapingHTMLFormatterTests.testFencedCodeBlockSetsLanguageClassFromFirstInfoWord` | Behavior | `src/lib/task.test.ts`; `src/lib/markdown.parity.test.ts`; sanitizer tests |
| 62 | `EscapingHTMLFormatterTests.testGitHubAlertWithDefaultTitle` | Behavior | `src/lib/task.test.ts`; `src/lib/markdown.parity.test.ts`; sanitizer tests |
| 63 | `EscapingHTMLFormatterTests.testGitHubAlertWithCustomTitle` | Behavior | `src/lib/task.test.ts`; `src/lib/markdown.parity.test.ts`; sanitizer tests |
| 64 | `EscapingHTMLFormatterTests.testSoftBreakRendersAsVisibleLineBreak` | Behavior | `src/lib/task.test.ts`; `src/lib/markdown.parity.test.ts`; sanitizer tests |
| 65 | `EscapingHTMLFormatterTests.testEveryPrecedingBlankSourceLineIsRecorded` | Behavior | `src/lib/task.test.ts`; `src/lib/markdown.parity.test.ts`; sanitizer tests |
| 66 | `EscapingHTMLFormatterTests.testSourceMarkdownExcludesRemovedContentFromBlankLineCount` | Behavior | `src/lib/task.test.ts`; `src/lib/markdown.parity.test.ts`; sanitizer tests |
| 67 | `EscapingHTMLFormatterTests.testGitHubAlertTagIsCaseInsensitive` | Behavior | `src/lib/task.test.ts`; `src/lib/markdown.parity.test.ts`; sanitizer tests |
| 68 | `EscapingHTMLFormatterTests.testGitHubAlertSupportsInlineFormattingInCustomTitle` | Behavior | `src/lib/task.test.ts`; `src/lib/markdown.parity.test.ts`; sanitizer tests |
| 69 | `EscapingHTMLFormatterTests.testGitHubAlertIncludesOcticonSVG` | Behavior | `src/lib/task.test.ts`; `src/lib/markdown.parity.test.ts`; sanitizer tests |
| 70 | `EscapingHTMLFormatterTests.testUnknownAlertTagFallsBackToBlockquote` | Behavior | `src/lib/task.test.ts`; `src/lib/markdown.parity.test.ts`; sanitizer tests |
| 71 | `EscapingHTMLFormatterTests.testQuotedBlankLinesRenderAsPlainBlockquote` | Behavior | `src/lib/task.test.ts`; `src/lib/markdown.parity.test.ts`; sanitizer tests |
| 72 | `EscapingHTMLFormatterTests.testGitHubAlertEscapesPlainTextInCustomTitle` | Behavior | `src/lib/task.test.ts`; `src/lib/markdown.parity.test.ts`; sanitizer tests |
| 73 | `MarkdownHTMLRenderTests.testYamlFrontmatterRendersAsTableBeforeDocumentBody` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 74 | `MarkdownHTMLRenderTests.testFrontmatterListValuesRenderAsPillsAndScalarsUnquote` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 75 | `MarkdownHTMLRenderTests.testTomlFrontmatterRendersAsTable` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 76 | `MarkdownHTMLRenderTests.testDocumentWithoutFrontmatterDoesNotRenderFrontmatterTable` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 77 | `MarkdownHTMLRenderTests.testScrollableLongTableKeepsWebKitViewportAndScrollsDocument` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 78 | `MarkdownHTMLRenderTests.testContentWidthModesLayOutDistinctArticleGeometry` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 79 | `MarkdownHTMLRenderTests.testContentWidthModesEmitExpectedArticleOverrides` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 80 | `MarkdownHTMLRenderTests.testLongInlineCodeInHeadingStaysWithinViewport` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 81 | `MarkdownHTMLRenderTests.testReadModeLeavesSelectionPaintingToWebKit` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 82 | `MarkdownHTMLRenderTests.testBlockquoteUsesItsContentDirectionForLogicalBorder` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 83 | `MarkdownHTMLRenderTests.testRTLDirectionRecognizesHebrewAndNumericCharacterReferences` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 84 | `MarkdownHTMLRenderTests.testReadOnlyRenderingPreservesEveryBlankSourceLine` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 85 | `MarkdownHTMLRenderTests.testListsAndDecoratedCodeBlocksOwnTheirOuterSpacing` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 86 | `MarkdownHTMLRenderTests.testInlineTabsRemainVisibleInReadMode` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 87 | `MarkdownHTMLRenderTests.testInlineTabsAdvanceToTheNextReadModeTabStop` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 88 | `MarkdownHTMLRenderTests.testDeepAuthoredListIndentationRemainsVisibleInReadMode` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 89 | `MarkdownHTMLRenderTests.testStandaloneListLikeIndentedCodeRemainsCodeInReadMode` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 90 | `MarkdownHTMLRenderTests.testDeepAuthoredListIndentationHasExpectedReadModeGeometry` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 91 | `MarkdownHTMLRenderTests.testEveryReadModeListDepthUsesTheSameIndentationStep` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 92 | `MarkdownHTMLRenderTests.testEveryEditorListDepthUsesTheSameIndentationStep` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 93 | `MarkdownHTMLRenderTests.testMermaidPostProcessingAcceptsSourceMappedPreTag` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 94 | `MarkdownHTMLRenderTests.testExplicitColorSchemeIsExposedToRendererScripts` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 95 | `MarkdownHTMLRenderTests.testMermaidPopupButtonIsEmitted` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 96 | `MarkdownHTMLRenderTests.testMermaidPopupPostsMeasuredSizeMessage` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 97 | `MarkdownHTMLRenderTests.testMermaidNativeColorSchemeOverridesMatchMedia` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 98 | `MarkdownHTMLRenderTests.testMermaidWidthToggleExpandsAndRestoresDiagram` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 99 | `MarkdownHTMLRenderTests.testMermaidHUDWrapsInsideNarrowDiagram` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 100 | `MarkdownHTMLRenderTests.testCodeBlockLayoutMatchesDeferredHighlightingFromFirstPaint` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 101 | `MarkdownHTMLRenderTests.testShellFenceAliasesUseBashReadModeGrammar` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 102 | `MarkdownHTMLRenderTests.testReadModeHighlightsHCLFenceAliases` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 103 | `MarkdownHTMLRenderTests.testReadModeHighlightsShellOptionsWithoutTouchingComments` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 104 | `MarkdownHTMLRenderTests.testBlockMathKeepsValidWrapperAndSourceLine` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 105 | `MarkdownHTMLRenderTests.testLatexDelimitersRenderAsMath` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 106 | `MarkdownHTMLRenderTests.testMarkdownEscapedLatexDelimitersRenderAsMath` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 107 | `MarkdownHTMLRenderTests.testLatexDelimitersInsideCodeRemainLiteral` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 108 | `MarkdownHTMLRenderTests.testProtectedCodeTokensRestoreInOnePassWithoutChangingContent` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 109 | `MarkdownHTMLRenderTests.testReportedLatexStructuresRenderWithBundledKatex` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 110 | `MarkdownHTMLRenderTests.testFootnoteRemovalDoesNotShiftFollowingSourceLines` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 111 | `MarkdownHTMLRenderTests.testFootnoteSourceLinesIncludeFrontmatterOffset` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 112 | `MarkdownHTMLRenderTests.testMultipleFootnoteReferencesRestoreInSourceOrder` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 113 | `MarkdownHTMLRenderTests.testTablesExposeSourceRangeAndStableCellCoordinates` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 114 | `MarkdownHTMLRenderTests.testRenderedTableCellsRetainOriginalMarkdownForSourceAwareEditing` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 115 | `MarkdownHTMLRenderTests.testTableCellEditTargetsExactSourceRangeAndEscapesPipes` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 116 | `MarkdownHTMLRenderTests.testTableRowsAndColumnsCanBeInsertedAndDeleted` | Behavior | `src/lib/markdown.parity.test.ts`; `src/lib/styleContract.test.ts`; table/Mermaid/E2E suites |
| 117 | `QuickLookAppearanceTests.testMissingAndInvalidValuesDefaultToAutomatic` | Native | `platform/macos/quicklook-tests/QuickLookTests.swift` |
| 118 | `QuickLookAppearanceTests.testEveryModeRoundTripsThroughDefaults` | Native | `platform/macos/quicklook-tests/QuickLookTests.swift` |
| 119 | `QuickLookAppearanceTests.testLegacyValueMigratesOnlyWhenSharedValueIsMissing` | Native | `platform/macos/quicklook-tests/QuickLookTests.swift` |
| 120 | `QuickLookAppearanceTests.testModesResolveExpectedColorScheme` | Native | `platform/macos/quicklook-tests/QuickLookTests.swift` |
| 121 | `MdPreviewUpdateTests.testMorphdomUpdatePreservesRenderedBlocksAndDetailsState` | Behavior | `PreviewPane.tsx`; `src/lib/table.test.ts`; native details/search/table E2E |
| 122 | `MdPreviewUpdateTests.testWarmupArticleTakesInnerHTMLReplaceBeforeMorphing` | Equivalent | `PreviewPane.tsx` uses synchronous first morph before paint, then incremental updates; native E2E |
| 123 | `MdPreviewUpdateTests.testTableHeaderPlaceholderAccessibilityUsesDelegatedUpdates` | Behavior | `PreviewPane.tsx`; `src/lib/table.test.ts`; native details/search/table E2E |
| 124 | `InlineLocalAssetsTests.testRelativePathBecomesCID` | Equivalent | Quick Look embeds an offline `data:` URL rather than a MIME CID; native render test |
| 125 | `InlineLocalAssetsTests.testPercentEncodedSpacesAreDecodedBeforeReading` | Native | `platform/macos/quicklook-tests/QuickLookTests.swift`; `src/lib/assets.test.ts` |
| 126 | `InlineLocalAssetsTests.testPathExtensionIsLowercased` | Native | `platform/macos/quicklook-tests/QuickLookTests.swift`; `src/lib/assets.test.ts` |
| 127 | `InlineLocalAssetsTests.testHTTPSrcLeftAlone` | Native | `platform/macos/quicklook-tests/QuickLookTests.swift`; `src/lib/assets.test.ts` |
| 128 | `InlineLocalAssetsTests.testDataURIUntouched` | Native | `platform/macos/quicklook-tests/QuickLookTests.swift`; `src/lib/assets.test.ts` |
| 129 | `InlineLocalAssetsTests.testCIDUntouched` | Native | `platform/macos/quicklook-tests/QuickLookTests.swift`; `src/lib/assets.test.ts` |
| 130 | `InlineLocalAssetsTests.testHostAbsolutePathUntouched` | Native | `platform/macos/quicklook-tests/QuickLookTests.swift`; `src/lib/assets.test.ts` |
| 131 | `InlineLocalAssetsTests.testParentDirectoryTraversalIsLeftAlone` | Native | `platform/macos/quicklook-tests/QuickLookTests.swift`; `src/lib/assets.test.ts` |
| 132 | `InlineLocalAssetsTests.testPercentEncodedAbsolutePathIsLeftAlone` | Native | `platform/macos/quicklook-tests/QuickLookTests.swift`; `src/lib/assets.test.ts` |
| 133 | `InlineLocalAssetsTests.testPercentEncodedSchemeIsLeftAlone` | Native | `platform/macos/quicklook-tests/QuickLookTests.swift`; `src/lib/assets.test.ts` |
| 134 | `InlineLocalAssetsTests.testSingleQuotedRawHTMLImageLeftAlone` | Superset | TextMark safely supports and inlines single-quoted raw HTML images; native asset test |
| 135 | `InlineLocalAssetsTests.testReadFailureLeavesSrcAlone` | Native | `platform/macos/quicklook-tests/QuickLookTests.swift`; `src/lib/assets.test.ts` |
| 136 | `InlineLocalAssetsTests.testPerImageByteCapSkipsOversizedAsset` | Native | `platform/macos/quicklook-tests/QuickLookTests.swift`; `src/lib/assets.test.ts` |
| 137 | `InlineLocalAssetsTests.testCumulativeByteCapStopsEmbedding` | Native | `platform/macos/quicklook-tests/QuickLookTests.swift`; `src/lib/assets.test.ts` |
| 138 | `InlineLocalAssetsTests.testIdenticalSrcReusesSameCID` | Native | `platform/macos/quicklook-tests/QuickLookTests.swift`; `src/lib/assets.test.ts` |
| 139 | `InlineLocalAssetsTests.testDistinctSrcGetDistinctCIDs` | Native | `platform/macos/quicklook-tests/QuickLookTests.swift`; `src/lib/assets.test.ts` |
