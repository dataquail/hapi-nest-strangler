// ViewModel and View tests run against jsdom with React's automatic JSX
// runtime. The setup file mounts jest-dom, installs MSW for the whole suite and
// points the API transport at the base URL MSW intercepts.
import * as path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic", target: "es2020" },
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: path.join(import.meta.dirname, "./$1") },
      {
        find: /^@org\/components\/(.*)$/,
        replacement: path.join(import.meta.dirname, "../components/$1"),
      },
      {
        find: /^@org\/contracts$/,
        replacement: path.join(import.meta.dirname, "../contracts/src/index.ts"),
      },
      {
        find: /^@org\/contracts\/(.*)$/,
        replacement: path.join(import.meta.dirname, "../contracts/src/$1.ts"),
      },
      {
        find: /^@org\/test-drivers\/(.*)$/,
        replacement: path.join(import.meta.dirname, "../test-drivers/src/$1.ts"),
      },
    ],
  },
  test: {
    name: "@org/web",
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    globals: true,
    include: [
      "features/**/*.test.{ts,tsx}",
      "services/**/*.test.{ts,tsx}",
      "test/**/*.test.{ts,tsx}",
    ],
    passWithNoTests: true,
  },
});
