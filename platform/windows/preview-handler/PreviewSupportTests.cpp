#include "PreviewSupport.h"

#include <Windows.h>
#include <filesystem>
#include <fstream>
#include <iostream>

int wmain() {
  namespace fs = std::filesystem;
  const auto root = fs::temp_directory_path() / (L"textmark-preview-tests-" + std::to_wstring(GetCurrentProcessId()));
  fs::create_directories(root / L"images");
  const auto document = root / L"README.md";
  std::ofstream(document) << "# Test";
  std::ofstream(root / L"images" / L"local.png", std::ios::binary) << "PNG";
  if (!textmark::SafeRelativeAsset(document, "images/local.png")) return 1;
  if (!textmark::SafeRelativeAsset(document, "images%2Flocal.png")) return 2;
  if (textmark::SafeRelativeAsset(document, "../secret.png")) return 3;
  if (textmark::SafeRelativeAsset(document, "%2FWindows%2Fsecret.png")) return 4;
  const auto request = textmark::BuildRenderRequest(document, "# 中文\n\n![x](images/local.png)");
  if (request.find("waitForTextMarkPreview") == std::string::npos || request.find("window.TextMarkPreview.render") == std::string::npos || request.find("data:image/png;base64") == std::string::npos || request.find("textmark-preview-ready") == std::string::npos) return 5;
  if (textmark::JsonEscape("\"\\\n") != "\\\"\\\\\\n") return 6;
  std::error_code error;
  fs::remove_all(root, error);
  std::cout << "TextMark PreviewSupport tests passed\n";
  return 0;
}
