#include <Windows.h>
#include <ShObjIdl.h>

#include <filesystem>
#include <iostream>

// {7D5DF7F4-1BD8-4A2D-9CE8-BE7F554D1A07}
const CLSID CLSID_TextMarkPreviewHandler = {0x7d5df7f4, 0x1bd8, 0x4a2d, {0x9c, 0xe8, 0xbe, 0x7f, 0x55, 0x4d, 0x1a, 0x07}};
using GetClassObject = HRESULT(__stdcall*)(REFCLSID, REFIID, void**);

int wmain(int argc, wchar_t** argv) {
  if (argc != 3) return 2;
  if (FAILED(CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED))) return 3;
  const HMODULE module = LoadLibraryW(argv[1]);
  if (!module) return 4;
  const auto getClassObject = reinterpret_cast<GetClassObject>(GetProcAddress(module, "DllGetClassObject"));
  IClassFactory* factory = nullptr;
  IPreviewHandler* preview = nullptr;
  IInitializeWithFile* initialize = nullptr;
  HWND parent = nullptr;
  int result = 5;
  if (getClassObject && SUCCEEDED(getClassObject(CLSID_TextMarkPreviewHandler, IID_PPV_ARGS(&factory))) && SUCCEEDED(factory->CreateInstance(nullptr, IID_PPV_ARGS(&preview))) && SUCCEEDED(preview->QueryInterface(IID_PPV_ARGS(&initialize))) && SUCCEEDED(initialize->Initialize(argv[2], STGM_READ))) {
    parent = CreateWindowExW(0, L"STATIC", L"TextMarkSmokeHost", WS_OVERLAPPEDWINDOW, 0, 0, 900, 700, nullptr, nullptr, GetModuleHandleW(nullptr), nullptr);
    RECT bounds{0, 0, 900, 700};
    if (parent && SUCCEEDED(preview->SetWindow(parent, &bounds)) && SUCCEEDED(preview->DoPreview())) {
      const auto deadline = GetTickCount64() + 30000;
      MSG message{};
      while (GetTickCount64() < deadline) {
        while (PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE)) { TranslateMessage(&message); DispatchMessageW(&message); }
        if (FindWindowExW(parent, nullptr, nullptr, L"TextMarkPreviewReady")) { result = 0; break; }
        if (FindWindowExW(parent, nullptr, nullptr, L"TextMarkPreviewFailed")) { result = 6; break; }
        Sleep(20);
      }
    }
  }
  if (preview) preview->Unload();
  if (initialize) initialize->Release();
  if (preview) preview->Release();
  if (factory) factory->Release();
  if (parent) DestroyWindow(parent);
  if (module) FreeLibrary(module);
  CoUninitialize();
  if (result) std::wcerr << L"Explorer preview host smoke failed: " << result << L"\n";
  return result;
}
