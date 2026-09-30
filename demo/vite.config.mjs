/** @fileoverview Highlights fixed examples without adding a browser parser. */
import { readFile } from "node:fs/promises";
import { defineConfig } from "vite";
import Prism from "prismjs";
import "prismjs/components/prism-jsx.js";
import "prismjs/components/prism-typescript.js";
import "prismjs/components/prism-tsx.js";

export default defineConfig({
  plugins: [
    {
      name: "documentation-syntax",
      enforce: "pre",
      async load(id) {
        if (!id.endsWith("?highlight")) return;
        const file = id.slice(0, -"?highlight".length);
        this.addWatchFile(file);
        const language = file.endsWith(".tsx.txt") ? "tsx" : "css";
        const source = await readFile(file, "utf8");
        const html = Prism.highlight(
          source,
          Prism.languages[language],
          language,
        );
        return `export default ${JSON.stringify(html)};`;
      },
    },
  ],
});
