/** @fileoverview Measures component-only demo bundles with the same build and gzip settings. */
import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const definitions = {
  digitloom: {
    entry: 'export { RollingNumber } from "./dist/index.js";',
    metadata: "package.json",
    css: "dist/styles.css",
  },
  numberflow: {
    entry: 'export { default, NumberFlowGroup } from "@number-flow/react";',
    metadata: "node_modules/@number-flow/react/package.json",
  },
  countup: {
    entry: 'export { useCountUp } from "react-countup";',
    metadata: "node_modules/react-countup/package.json",
  },
};
const libraries = {};
for (const [name, definition] of Object.entries(definitions)) {
  const result = await build({
    absWorkingDir: root,
    stdin: { contents: definition.entry, resolveDir: root },
    bundle: true,
    write: false,
    minify: true,
    format: "esm",
    platform: "browser",
    target: "es2020",
    external: ["react", "react/jsx-runtime", "react-dom"],
    legalComments: "none",
  });
  const code = result.outputFiles[0].contents;
  const css = definition.css
    ? await readFile(path.join(root, definition.css))
    : null;
  const metadata = JSON.parse(
    await readFile(path.join(root, definition.metadata), "utf8"),
  );
  libraries[name] = {
    version: metadata.version,
    bytes: code.length + (css?.length ?? 0),
    gzipBytes:
      gzipSync(code, { level: 9 }).length +
      (css ? gzipSync(css, { level: 9 }).length : 0),
  };
}
await writeFile(
  path.join(root, "demo/library-sizes.json"),
  JSON.stringify(
    {
      method:
        "ES2020 minified component bundles. React excluded. Digitloom CSS included. Separate assets gzipped at level 9.",
      libraries,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify(libraries, null, 2));
