/** @fileoverview Enforces the compressed runtime budget without including React or source maps. */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import path from "node:path";

const root = fileURLToPath(new URL("../dist/", import.meta.url));
const files = await Promise.all(
  ["index.js", "styles.css"].map(async (name) => {
    const content = await readFile(path.join(root, name));
    return {
      name,
      bytes: content.length,
      gzipBytes: gzipSync(content, { level: 9 }).length,
    };
  }),
);
const totalGzipBytes = files.reduce((total, file) => total + file.gzipBytes, 0);
const budgetGzipBytes = 6144;
const report = {
  files,
  totalGzipBytes,
  budgetGzipBytes,
  excludes: ["React", "source maps", "types", "documentation", "demo"],
};
await writeFile(
  path.join(root, "size.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
if (totalGzipBytes > budgetGzipBytes)
  throw new Error("Digitloom exceeds its 6 KiB gzip runtime budget.");
