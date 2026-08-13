!define TEXTMARK_PREVIEW_CLSID "{7D5DF7F4-1BD8-4A2D-9CE8-BE7F554D1A07}"
!define TEXTMARK_PREVIEW_SHELLEX "{8895B1C6-B41F-4C1C-A562-0D564250836F}"
!define TEXTMARK_PREVHOST_APPID "{6D2B5079-2F0B-48DD-AB7F-97CEC514D30B}"

!macro TEXTMARK_REGISTER_EXTENSION EXTENSION
  WriteRegStr HKLM "Software\Classes\${EXTENSION}\shellex\${TEXTMARK_PREVIEW_SHELLEX}" "" "${TEXTMARK_PREVIEW_CLSID}"
!macroend

!macro TEXTMARK_UNREGISTER_EXTENSION EXTENSION
  DeleteRegKey HKLM "Software\Classes\${EXTENSION}\shellex\${TEXTMARK_PREVIEW_SHELLEX}"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  SetRegView 64
  WriteRegStr HKLM "Software\Classes\CLSID\${TEXTMARK_PREVIEW_CLSID}" "" "TextMark Markdown Preview Handler"
  WriteRegStr HKLM "Software\Classes\CLSID\${TEXTMARK_PREVIEW_CLSID}" "AppID" "${TEXTMARK_PREVHOST_APPID}"
  WriteRegStr HKLM "Software\Classes\CLSID\${TEXTMARK_PREVIEW_CLSID}\InprocServer32" "" "$INSTDIR\TextMarkPreview\TextMarkPreviewHandler.dll"
  WriteRegStr HKLM "Software\Classes\CLSID\${TEXTMARK_PREVIEW_CLSID}\InprocServer32" "ThreadingModel" "Apartment"
  WriteRegStr HKLM "Software\Classes\CLSID\${TEXTMARK_PREVIEW_CLSID}\InprocServer32" "ProgID" "TextMark.Markdown"
  WriteRegStr HKLM "Software\Classes\CLSID\${TEXTMARK_PREVIEW_CLSID}\InprocServer32" "VersionIndependentProgID" "TextMark.Markdown"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\PreviewHandlers" "${TEXTMARK_PREVIEW_CLSID}" "TextMark Markdown Preview Handler"
  WriteRegStr HKLM "Software\Classes\TextMark.Markdown\shellex\${TEXTMARK_PREVIEW_SHELLEX}" "" "${TEXTMARK_PREVIEW_CLSID}"
  !insertmacro TEXTMARK_REGISTER_EXTENSION ".md"
  !insertmacro TEXTMARK_REGISTER_EXTENSION ".markdown"
  !insertmacro TEXTMARK_REGISTER_EXTENSION ".mdown"
  !insertmacro TEXTMARK_REGISTER_EXTENSION ".mkd"
  !insertmacro TEXTMARK_REGISTER_EXTENSION ".mkdn"
  !insertmacro TEXTMARK_REGISTER_EXTENSION ".mdwn"
  !insertmacro TEXTMARK_REGISTER_EXTENSION ".mdtxt"
  !insertmacro TEXTMARK_REGISTER_EXTENSION ".mdtext"
  !insertmacro TEXTMARK_REGISTER_EXTENSION ".rmd"
  !insertmacro TEXTMARK_REGISTER_EXTENSION ".txt"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  SetRegView 64
  !insertmacro TEXTMARK_UNREGISTER_EXTENSION ".md"
  !insertmacro TEXTMARK_UNREGISTER_EXTENSION ".markdown"
  !insertmacro TEXTMARK_UNREGISTER_EXTENSION ".mdown"
  !insertmacro TEXTMARK_UNREGISTER_EXTENSION ".mkd"
  !insertmacro TEXTMARK_UNREGISTER_EXTENSION ".mkdn"
  !insertmacro TEXTMARK_UNREGISTER_EXTENSION ".mdwn"
  !insertmacro TEXTMARK_UNREGISTER_EXTENSION ".mdtxt"
  !insertmacro TEXTMARK_UNREGISTER_EXTENSION ".mdtext"
  !insertmacro TEXTMARK_UNREGISTER_EXTENSION ".rmd"
  !insertmacro TEXTMARK_UNREGISTER_EXTENSION ".txt"
  DeleteRegKey HKLM "Software\Classes\TextMark.Markdown\shellex\${TEXTMARK_PREVIEW_SHELLEX}"
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\PreviewHandlers" "${TEXTMARK_PREVIEW_CLSID}"
  DeleteRegKey HKLM "Software\Classes\CLSID\${TEXTMARK_PREVIEW_CLSID}"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
