import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  base: "./",
  plugins: [react()],
  build: {
    // Mermaid and CodeMirror are offline, user-triggered chunks. The preview
    // bootstrap remains below the 300 kB gzip budget and never preloads them.
    chunkSizeWarningLimit: 3200,
    modulePreload: {
      resolveDependencies(_filename, dependencies) {
        return dependencies.filter((dependency) => !dependency.includes("optional-sentry"));
      },
    },
    // Keep preview bootstrap small; Mermaid and editor vendors are only fetched
    // after their feature is activated.
    rolldownOptions: {
      input: { main: "index.html", mermaid: "mermaid.html", preview: "preview.html" },
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/node_modules\/(?:react|react-dom)\//.test(id)) return "vendor-react";
          if (id.includes("node_modules/@sentry/")) return "optional-sentry";
          if (id.includes("node_modules/dompurify/")) return "vendor-sanitize";
          if (id.includes("node_modules/highlight.js/")) return "optional-highlight";
          if (id.includes("node_modules/katex/")) return "optional-katex";
          if (id.includes("node_modules/markdown-it")) return "vendor-markdown-core";
        },
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
