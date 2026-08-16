import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { applyUpstreamDocumentTokens } from './lib/designTokens'

if (import.meta.env.VITE_WDIO) {
  localStorage.clear()
  void import('@wdio/tauri-plugin')
}
applyUpstreamDocumentTokens()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
