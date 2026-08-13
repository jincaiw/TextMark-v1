#include "PreviewSupport.h"

#include <Windows.h>
#include <ShlObj.h>
#include <wincrypt.h>

#include <algorithm>
#include <cctype>
#include <cwctype>
#include <fstream>
#include <regex>
#include <set>
#include <sstream>

namespace fs = std::filesystem;

namespace {

constexpr std::uintmax_t kPerImageCap = 4 * 1024 * 1024;
constexpr std::uintmax_t kCumulativeCap = 8 * 1024 * 1024;

std::string PercentDecode(const std::string& input) {
  std::string output;
  output.reserve(input.size());
  for (std::size_t index = 0; index < input.size(); ++index) {
    if (input[index] == '%' && index + 2 < input.size() && std::isxdigit(static_cast<unsigned char>(input[index + 1])) && std::isxdigit(static_cast<unsigned char>(input[index + 2]))) {
      output.push_back(static_cast<char>(std::stoi(input.substr(index + 1, 2), nullptr, 16)));
      index += 2;
    } else {
      output.push_back(input[index]);
    }
  }
  return output;
}

std::string Lower(std::string value) {
  std::transform(value.begin(), value.end(), value.begin(), [](unsigned char character) { return static_cast<char>(std::tolower(character)); });
  return value;
}

std::wstring Lower(std::wstring value) {
  std::transform(value.begin(), value.end(), value.begin(), [](wchar_t character) { return static_cast<wchar_t>(std::towlower(character)); });
  return value;
}

bool IsWithin(const fs::path& candidate, const fs::path& root) {
  auto candidateText = Lower(candidate.lexically_normal().wstring());
  auto rootText = Lower(root.lexically_normal().wstring());
  if (!rootText.empty() && rootText.back() != L'\\') rootText.push_back(L'\\');
  return candidateText == rootText.substr(0, rootText.size() - 1) || candidateText.rfind(rootText, 0) == 0;
}

std::string MimeFor(const fs::path& path) {
  const auto extension = Lower(path.extension().string());
  if (extension == ".png") return "image/png";
  if (extension == ".jpg" || extension == ".jpeg") return "image/jpeg";
  if (extension == ".gif") return "image/gif";
  if (extension == ".webp") return "image/webp";
  if (extension == ".bmp") return "image/bmp";
  if (extension == ".ico") return "image/x-icon";
  return {};
}

std::string Base64(const std::vector<unsigned char>& bytes) {
  DWORD length = 0;
  if (!CryptBinaryToStringA(bytes.data(), static_cast<DWORD>(bytes.size()), CRYPT_STRING_BASE64 | CRYPT_STRING_NOCRLF, nullptr, &length)) return {};
  std::string output(length, '\0');
  if (!CryptBinaryToStringA(bytes.data(), static_cast<DWORD>(bytes.size()), CRYPT_STRING_BASE64 | CRYPT_STRING_NOCRLF, output.data(), &length)) return {};
  output.resize(length ? length - 1 : 0);
  return output;
}

std::pair<std::string, std::string> Preferences() {
  PWSTR appData = nullptr;
  std::string locale = "zh-CN";
  std::string appearance = "system";
  if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_RoamingAppData, KF_FLAG_DEFAULT, nullptr, &appData))) {
    const auto settings = fs::path(appData) / L"TextMark" / L"settings-v3.json";
    CoTaskMemFree(appData);
    const auto source = textmark::ReadUtf8File(settings, 1024 * 1024);
    if (source.find("\"locale\": \"en\"") != std::string::npos || source.find("\"locale\":\"en\"") != std::string::npos) locale = "en";
    if (source.find("\"theme\": \"dark\"") != std::string::npos || source.find("\"theme\":\"dark\"") != std::string::npos) appearance = "dark";
    else if (source.find("\"theme\": \"light\"") != std::string::npos || source.find("\"theme\":\"light\"") != std::string::npos) appearance = "light";
  }
  return {locale, appearance};
}

std::vector<std::string> ImageSources(const std::string& markdown) {
  const std::regex markdownImage(R"regex(!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s\)]+)))regex", std::regex::icase);
  const std::regex htmlImage(R"regex(<img\b[^>]*?\bsrc\s*=\s*[\"']([^\"']+)[\"'])regex", std::regex::icase);
  std::vector<std::string> values;
  for (std::sregex_iterator iterator(markdown.begin(), markdown.end(), markdownImage), end; iterator != end; ++iterator) values.push_back((*iterator)[1].matched ? (*iterator)[1].str() : (*iterator)[2].str());
  for (std::sregex_iterator iterator(markdown.begin(), markdown.end(), htmlImage), end; iterator != end; ++iterator) values.push_back((*iterator)[1].str());
  return values;
}

}

namespace textmark {

std::wstring Utf8ToWide(const std::string& value) {
  if (value.empty()) return {};
  const int size = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0);
  if (size <= 0) return {};
  std::wstring output(size, L'\0');
  MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), output.data(), size);
  return output;
}

std::string WideToUtf8(const std::wstring& value) {
  if (value.empty()) return {};
  const int size = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
  if (size <= 0) return {};
  std::string output(size, '\0');
  WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), output.data(), size, nullptr, nullptr);
  return output;
}

std::string ReadUtf8File(const fs::path& path, std::uintmax_t byteCap) {
  std::error_code error;
  const auto size = fs::file_size(path, error);
  if (error || size > byteCap) return {};
  std::ifstream stream(path, std::ios::binary);
  if (!stream) return {};
  return {std::istreambuf_iterator<char>(stream), std::istreambuf_iterator<char>()};
}

std::string JsonEscape(const std::string& value) {
  std::ostringstream output;
  for (const unsigned char character : value) {
    switch (character) {
      case '"': output << "\\\""; break;
      case '\\': output << "\\\\"; break;
      case '\b': output << "\\b"; break;
      case '\f': output << "\\f"; break;
      case '\n': output << "\\n"; break;
      case '\r': output << "\\r"; break;
      case '\t': output << "\\t"; break;
      default:
        if (character < 0x20) {
          const char hex[] = "0123456789abcdef";
          output << "\\u00" << hex[character >> 4] << hex[character & 0x0f];
        } else output << character;
    }
  }
  return output.str();
}

std::optional<fs::path> SafeRelativeAsset(const fs::path& document, const std::string& source) {
  auto clean = source.substr(0, source.find_first_of("?#"));
  clean = PercentDecode(clean);
  if (clean.empty() || clean[0] == '/' || clean[0] == '\\' || std::regex_search(clean, std::regex(R"regex(^[A-Za-z][A-Za-z0-9+.-]*:)regex"))) return std::nullopt;
  const auto relative = fs::path(Utf8ToWide(clean));
  if (relative.is_absolute() || relative.has_root_name()) return std::nullopt;
  for (const auto& component : relative) if (component == L"..") return std::nullopt;
  std::error_code error;
  const auto root = fs::weakly_canonical(document.parent_path(), error);
  if (error) return std::nullopt;
  const auto candidate = fs::weakly_canonical(root / relative, error);
  if (error || !IsWithin(candidate, root) || !fs::is_regular_file(candidate, error)) return std::nullopt;
  return candidate;
}

std::string BuildRenderRequest(const fs::path& document, const std::string& markdown) {
  const auto [locale, appearance] = Preferences();
  std::ostringstream assets;
  assets << '{';
  bool first = true;
  std::uintmax_t cumulative = 0;
  std::set<std::string> seen;
  for (const auto& source : ImageSources(markdown)) {
    if (!seen.insert(source).second) continue;
    const auto path = SafeRelativeAsset(document, source);
    if (!path) continue;
    const auto mime = MimeFor(*path);
    if (mime.empty()) continue;
    std::error_code error;
    const auto size = fs::file_size(*path, error);
    if (error || size > kPerImageCap || cumulative + size > kCumulativeCap) continue;
    const auto raw = ReadUtf8File(*path, kPerImageCap);
    if (raw.size() != size) continue;
    std::vector<unsigned char> bytes(raw.begin(), raw.end());
    const auto encoded = Base64(bytes);
    if (encoded.empty()) continue;
    cumulative += size;
    if (!first) assets << ',';
    first = false;
    assets << '"' << JsonEscape(source) << "\":\"data:" << mime << ";base64," << encoded << '"';
  }
  assets << '}';
  std::ostringstream request;
  request << "(function waitForTextMarkPreview(remaining){"
          << "if(window.TextMarkPreview&&typeof window.TextMarkPreview.render==='function'){"
          << "window.TextMarkPreview.render({\"source\":\"" << JsonEscape(markdown)
          << "\",\"locale\":\"" << locale << "\",\"appearance\":\"" << appearance
          << "\",\"assets\":" << assets.str()
          << "}).then(function(){window.chrome.webview.postMessage('textmark-preview-ready');},function(){window.chrome.webview.postMessage('textmark-preview-failed');});return;}"
          << "if(remaining<=0){window.chrome.webview.postMessage('textmark-preview-failed');return;}"
          << "setTimeout(function(){waitForTextMarkPreview(remaining-1);},25);})(400);";
  return request.str();
}

}
