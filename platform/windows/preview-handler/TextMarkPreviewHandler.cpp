#include "PreviewSupport.h"

#include <Windows.h>
#include <ShlObj.h>
#include <ShObjIdl.h>
#include <Shlwapi.h>
#include <WebView2.h>
#include <wrl.h>

#include <atomic>
#include <cwchar>
#include <filesystem>
#include <new>
#include <string>

using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;

// {7D5DF7F4-1BD8-4A2D-9CE8-BE7F554D1A07}
const CLSID CLSID_TextMarkPreviewHandler = {0x7d5df7f4, 0x1bd8, 0x4a2d, {0x9c, 0xe8, 0xbe, 0x7f, 0x55, 0x4d, 0x1a, 0x07}};

namespace {

HINSTANCE g_instance = nullptr;
std::atomic<long> g_objects = 0;
std::atomic<long> g_locks = 0;

std::filesystem::path ModuleDirectory() {
  std::wstring path(32768, L'\0');
  const DWORD length = GetModuleFileNameW(g_instance, path.data(), static_cast<DWORD>(path.size()));
  path.resize(length);
  return std::filesystem::path(path).parent_path();
}

std::wstring PreviewURL() {
  const auto path = (ModuleDirectory() / L"web" / L"preview.html").wstring();
  DWORD length = 32768;
  std::wstring url(length, L'\0');
  if (FAILED(UrlCreateFromPathW(path.c_str(), url.data(), &length, 0))) return {};
  url.resize(length);
  if (!url.empty() && url.back() == L'\0') url.pop_back();
  return url;
}

RECT ClientBounds(HWND window) {
  RECT bounds{};
  if (window) GetClientRect(window, &bounds);
  return bounds;
}

std::wstring UserDataDirectory() {
  PWSTR value = nullptr;
  std::filesystem::path directory;
  if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_LocalAppDataLow, KF_FLAG_CREATE, nullptr, &value))) {
    directory = std::filesystem::path(value) / L"TextMark" / L"PreviewWebView2";
    CoTaskMemFree(value);
    std::error_code error;
    std::filesystem::create_directories(directory, error);
  }
  return directory.wstring();
}

class PreviewHandler final : public IPreviewHandler, public IInitializeWithFile, public IOleWindow, public IObjectWithSite {
 public:
  PreviewHandler() { ++g_objects; }
  ~PreviewHandler() { Unload(); --g_objects; }

  IFACEMETHODIMP QueryInterface(REFIID iid, void** result) override {
    if (!result) return E_POINTER;
    *result = nullptr;
    if (iid == IID_IUnknown || iid == IID_IPreviewHandler) *result = static_cast<IPreviewHandler*>(this);
    else if (iid == IID_IInitializeWithFile) *result = static_cast<IInitializeWithFile*>(this);
    else if (iid == IID_IOleWindow) *result = static_cast<IOleWindow*>(this);
    else if (iid == IID_IObjectWithSite) *result = static_cast<IObjectWithSite*>(this);
    else return E_NOINTERFACE;
    AddRef();
    return S_OK;
  }

  IFACEMETHODIMP_(ULONG) AddRef() override { return static_cast<ULONG>(InterlockedIncrement(&references_)); }
  IFACEMETHODIMP_(ULONG) Release() override { const auto value = InterlockedDecrement(&references_); if (!value) delete this; return static_cast<ULONG>(value); }

  IFACEMETHODIMP Initialize(LPCWSTR path, DWORD) override {
    if (!path || initialized_) return initialized_ ? HRESULT_FROM_WIN32(ERROR_ALREADY_INITIALIZED) : E_INVALIDARG;
    file_ = path;
    initialized_ = true;
    return S_OK;
  }

  IFACEMETHODIMP SetWindow(HWND parent, const RECT* bounds) override {
    if (!parent || !bounds) return E_INVALIDARG;
    parent_ = parent;
    bounds_ = *bounds;
    return S_OK;
  }

  IFACEMETHODIMP SetRect(const RECT* bounds) override {
    if (!bounds) return E_INVALIDARG;
    bounds_ = *bounds;
    if (window_) SetWindowPos(window_, nullptr, bounds_.left, bounds_.top, bounds_.right - bounds_.left, bounds_.bottom - bounds_.top, SWP_NOZORDER | SWP_NOACTIVATE);
    if (controller_) {
      const RECT client = ClientBounds(window_);
      controller_->put_Bounds(client);
    }
    return S_OK;
  }

  IFACEMETHODIMP DoPreview() override {
    if (!initialized_ || !parent_) return E_UNEXPECTED;
    if (window_) return S_OK;
    std::error_code fileError;
    const auto size = std::filesystem::file_size(file_, fileError);
    if (fileError || size > 32 * 1024 * 1024) return HRESULT_FROM_WIN32(ERROR_FILE_TOO_LARGE);
    const auto markdown = textmark::ReadUtf8File(file_, 32 * 1024 * 1024);
    if (markdown.empty() && size != 0) return HRESULT_FROM_WIN32(ERROR_READ_FAULT);
    renderScript_ = textmark::Utf8ToWide(textmark::BuildRenderRequest(file_, markdown));
    window_ = CreateWindowExW(0, L"STATIC", L"TextMarkPreviewLoading", WS_CHILD | WS_VISIBLE | WS_CLIPCHILDREN | WS_CLIPSIBLINGS, bounds_.left, bounds_.top, bounds_.right - bounds_.left, bounds_.bottom - bounds_.top, parent_, nullptr, g_instance, nullptr);
    if (!window_) return HRESULT_FROM_WIN32(GetLastError());
    AddRef();
    const auto dataDirectory = UserDataDirectory();
    const HRESULT started = CreateCoreWebView2EnvironmentWithOptions(nullptr, dataDirectory.empty() ? nullptr : dataDirectory.c_str(), nullptr,
      Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>([this](HRESULT error, ICoreWebView2Environment* environment) -> HRESULT {
        if (FAILED(error) || !environment || !window_) { SetWindowTextW(window_, L"TextMarkPreviewFailed"); Release(); return S_OK; }
        AddRef();
        environment->CreateCoreWebView2Controller(window_, Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>([this](HRESULT controllerError, ICoreWebView2Controller* controller) -> HRESULT {
          if (SUCCEEDED(controllerError) && controller && window_) Configure(controller);
          else if (window_) SetWindowTextW(window_, L"TextMarkPreviewFailed");
          Release();
          return S_OK;
        }).Get());
        Release();
        return S_OK;
      }).Get());
    if (FAILED(started)) { Release(); return started; }
    return S_OK;
  }

  IFACEMETHODIMP Unload() override {
    if (webView_) {
      if (navigationStartingToken_.value) webView_->remove_NavigationStarting(navigationStartingToken_);
      if (navigationCompletedToken_.value) webView_->remove_NavigationCompleted(navigationCompletedToken_);
      if (newWindowToken_.value) webView_->remove_NewWindowRequested(newWindowToken_);
      if (webMessageToken_.value) webView_->remove_WebMessageReceived(webMessageToken_);
    }
    navigationStartingToken_ = {};
    navigationCompletedToken_ = {};
    newWindowToken_ = {};
    webMessageToken_ = {};
    if (controller_) controller_->Close();
    webView_.Reset();
    controller_.Reset();
    if (window_) DestroyWindow(window_);
    window_ = nullptr;
    renderScript_.clear();
    return S_OK;
  }

  IFACEMETHODIMP SetFocus() override { if (!window_) return S_FALSE; ::SetFocus(window_); return S_OK; }
  IFACEMETHODIMP QueryFocus(HWND* focused) override { if (!focused) return E_POINTER; *focused = GetFocus(); return *focused ? S_OK : S_FALSE; }
  IFACEMETHODIMP TranslateAccelerator(MSG*) override { return S_FALSE; }
  IFACEMETHODIMP GetWindow(HWND* window) override { if (!window) return E_POINTER; *window = window_; return window_ ? S_OK : E_FAIL; }
  IFACEMETHODIMP ContextSensitiveHelp(BOOL) override { return E_NOTIMPL; }
  IFACEMETHODIMP SetSite(IUnknown* site) override { site_ = site; return S_OK; }
  IFACEMETHODIMP GetSite(REFIID iid, void** site) override { return site_ ? site_->QueryInterface(iid, site) : E_FAIL; }

 private:
  void Configure(ICoreWebView2Controller* controller) {
    controller_ = controller;
    const RECT client = ClientBounds(window_);
    controller_->put_Bounds(client);
    if (FAILED(controller_->get_CoreWebView2(&webView_)) || !webView_) {
      SetWindowTextW(window_, L"TextMarkPreviewFailed");
      return;
    }
    ComPtr<ICoreWebView2Settings> settings;
    if (SUCCEEDED(webView_->get_Settings(&settings))) {
      settings->put_AreDevToolsEnabled(FALSE);
      settings->put_AreDefaultContextMenusEnabled(FALSE);
      settings->put_IsStatusBarEnabled(FALSE);
      settings->put_IsZoomControlEnabled(FALSE);
      settings->put_IsWebMessageEnabled(TRUE);
    }
    const auto previewUrl = PreviewURL();
    webView_->add_NavigationStarting(Callback<ICoreWebView2NavigationStartingEventHandler>([previewUrl](ICoreWebView2*, ICoreWebView2NavigationStartingEventArgs* args) -> HRESULT {
      LPWSTR uri = nullptr;
      if (SUCCEEDED(args->get_Uri(&uri)) && uri) {
        std::wstring destination(uri);
        const auto fragment = destination.find_first_of(L"?#");
        if (fragment != std::wstring::npos) destination.resize(fragment);
        if (_wcsicmp(destination.c_str(), previewUrl.c_str()) != 0) args->put_Cancel(TRUE);
      }
      CoTaskMemFree(uri);
      return S_OK;
    }).Get(), &navigationStartingToken_);
    webView_->add_NewWindowRequested(Callback<ICoreWebView2NewWindowRequestedEventHandler>([](ICoreWebView2*, ICoreWebView2NewWindowRequestedEventArgs* args) -> HRESULT { args->put_Handled(TRUE); return S_OK; }).Get(), &newWindowToken_);
    webView_->add_WebMessageReceived(Callback<ICoreWebView2WebMessageReceivedEventHandler>([this](ICoreWebView2*, ICoreWebView2WebMessageReceivedEventArgs* args) -> HRESULT {
      LPWSTR message = nullptr;
      if (SUCCEEDED(args->TryGetWebMessageAsString(&message)) && message && window_) {
        if (wcscmp(message, L"textmark-preview-ready") == 0) SetWindowTextW(window_, L"TextMarkPreviewReady");
        else if (wcscmp(message, L"textmark-preview-failed") == 0) SetWindowTextW(window_, L"TextMarkPreviewFailed");
      }
      CoTaskMemFree(message);
      return S_OK;
    }).Get(), &webMessageToken_);
    webView_->add_NavigationCompleted(Callback<ICoreWebView2NavigationCompletedEventHandler>([this](ICoreWebView2*, ICoreWebView2NavigationCompletedEventArgs* args) -> HRESULT {
      BOOL success = FALSE;
      args->get_IsSuccess(&success);
      if (!success || !webView_) { SetWindowTextW(window_, L"TextMarkPreviewFailed"); return S_OK; }
      AddRef();
      webView_->ExecuteScript(renderScript_.c_str(), Callback<ICoreWebView2ExecuteScriptCompletedHandler>([this](HRESULT error, LPCWSTR) -> HRESULT {
        if (window_ && FAILED(error)) SetWindowTextW(window_, L"TextMarkPreviewFailed");
        Release();
        return S_OK;
      }).Get());
      return S_OK;
    }).Get(), &navigationCompletedToken_);
    if (previewUrl.empty()) SetWindowTextW(window_, L"TextMarkPreviewFailed");
    else webView_->Navigate(previewUrl.c_str());
  }

  LONG references_ = 1;
  bool initialized_ = false;
  std::filesystem::path file_;
  HWND parent_ = nullptr;
  HWND window_ = nullptr;
  RECT bounds_{};
  std::wstring renderScript_;
  ComPtr<IUnknown> site_;
  ComPtr<ICoreWebView2Controller> controller_;
  ComPtr<ICoreWebView2> webView_;
  EventRegistrationToken navigationStartingToken_{};
  EventRegistrationToken navigationCompletedToken_{};
  EventRegistrationToken newWindowToken_{};
  EventRegistrationToken webMessageToken_{};
};

class ClassFactory final : public IClassFactory {
 public:
  IFACEMETHODIMP QueryInterface(REFIID iid, void** result) override { if (!result) return E_POINTER; *result = nullptr; if (iid != IID_IUnknown && iid != IID_IClassFactory) return E_NOINTERFACE; *result = this; AddRef(); return S_OK; }
  IFACEMETHODIMP_(ULONG) AddRef() override { return static_cast<ULONG>(InterlockedIncrement(&references_)); }
  IFACEMETHODIMP_(ULONG) Release() override { const auto value = InterlockedDecrement(&references_); if (!value) delete this; return static_cast<ULONG>(value); }
  IFACEMETHODIMP CreateInstance(IUnknown* outer, REFIID iid, void** result) override { if (outer) return CLASS_E_NOAGGREGATION; auto* handler = new (std::nothrow) PreviewHandler(); if (!handler) return E_OUTOFMEMORY; const auto status = handler->QueryInterface(iid, result); handler->Release(); return status; }
  IFACEMETHODIMP LockServer(BOOL lock) override { lock ? ++g_locks : --g_locks; return S_OK; }
 private:
  LONG references_ = 1;
};

}

extern "C" BOOL WINAPI DllMain(HINSTANCE instance, DWORD reason, LPVOID) {
  if (reason == DLL_PROCESS_ATTACH) { g_instance = instance; DisableThreadLibraryCalls(instance); }
  return TRUE;
}

extern "C" HRESULT __stdcall DllGetClassObject(REFCLSID clsid, REFIID iid, void** result) {
  if (clsid != CLSID_TextMarkPreviewHandler) return CLASS_E_CLASSNOTAVAILABLE;
  auto* factory = new (std::nothrow) ClassFactory();
  if (!factory) return E_OUTOFMEMORY;
  const auto status = factory->QueryInterface(iid, result);
  factory->Release();
  return status;
}

extern "C" HRESULT __stdcall DllCanUnloadNow() { return g_objects == 0 && g_locks == 0 ? S_OK : S_FALSE; }
