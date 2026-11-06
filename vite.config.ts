import { defineConfig } from "vite";
import { resolve } from "node:path";
import { readdirSync } from "node:fs";

// Every *.html file in the project root is a separate window/page.
const pages = Object.fromEntries(
  readdirSync(__dirname)
    .filter((f) => f.endsWith(".html"))
    .map((f) => [f.replace(/\.html$/, ""), resolve(__dirname, f)]),
);

export default defineConfig({
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: { target: "safari16", rollupOptions: { input: pages } },
});
