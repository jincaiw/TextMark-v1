import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

if (import.meta.env.VITE_WDIO) void import("@wdio/tauri-plugin");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
