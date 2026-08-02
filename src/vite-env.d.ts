/// <reference types="vite/client" />

declare module "markdown-it-texmath" {
  import type { MarkdownIt } from "markdown-it";
  const texmath: (md: MarkdownIt, options?: unknown) => void;
  export default texmath;
}

declare module "*.css";
