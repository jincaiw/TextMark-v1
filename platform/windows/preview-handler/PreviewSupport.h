#pragma once

#include <filesystem>
#include <cstdint>
#include <optional>
#include <string>
#include <vector>

namespace textmark {

std::string ReadUtf8File(const std::filesystem::path& path, std::uintmax_t byteCap);
std::string JsonEscape(const std::string& value);
std::optional<std::filesystem::path> SafeRelativeAsset(const std::filesystem::path& document, const std::string& source);
std::string BuildRenderRequest(const std::filesystem::path& document, const std::string& markdown);
std::wstring Utf8ToWide(const std::string& value);
std::string WideToUtf8(const std::wstring& value);

}
