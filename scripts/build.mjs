/** @fileoverview Builds the runtime, stylesheet, and isolated public type declarations. */
import { build, context } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "dist");
await mkdir(output, { recursive: true });

const options = {
  absWorkingDir: root,
  entryPoints: { index: "src/index.ts", styles: "src/styles.css" },
  outdir: output,
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2020",
  jsx: "automatic",
  minify: true,
  // Audit this allowlist when canvas code changes. It must exclude browser and React properties.
  mangleProps:
    /^(place|pixels|stagger|host|animation|owner|typeface|ink|lineHeight|offsetX|offsetY|leftBleed|paintLeft|paintWidth|gridWidth|gridHeight|leftLimit|rightLimit|clips|opacityLayers|flexParent|textWidth|layoutChanges|refreshForLayout|x|y|to|inkTop|inkBottom|glyphs|advances|rolls|delta|users|motions|stopLayout|onScroll|destroyed|settings|immediate|previous|allowed|cells|atlas|clocks|origin|grid|stop|clock|surface|clients|bleed|ratio|baseline|spacing|prepare|start|draw|syncClocks|settle|destroy|refresh|update|context|digit|notify|visible|changed|observer|media|text)$/,
  external: ["react", "react/jsx-runtime"],
  sourcemap: "external",
  banner: { js: '"use client";' },
  plugins: [
    {
      name: "public-declarations",
      setup(builder) {
        builder.onEnd(async (result) => {
          if (result.errors.length) return;
          for (const file of [
            "index.ts",
            "RollingNumber.tsx",
            "RollingNumberGroup.tsx",
          ]) {
            const fileName = path.join(root, "src", file);
            const source = await readFile(fileName, "utf8");
            // Isolated emission does not run a project typecheck.
            const declaration = ts.transpileDeclaration(source, {
              fileName,
              compilerOptions: {
                target: ts.ScriptTarget.ES2020,
                module: ts.ModuleKind.ESNext,
                jsx: ts.JsxEmit.ReactJSX,
              },
            });
            if (declaration.diagnostics?.length) {
              throw new Error(
                ts.formatDiagnostics(declaration.diagnostics, {
                  getCanonicalFileName: (name) => name,
                  getCurrentDirectory: () => root,
                  getNewLine: () => "\n",
                }),
              );
            }
            await writeFile(
              path.join(output, file.replace(/\.tsx?$/, ".d.ts")),
              declaration.outputText,
            );
          }
        });
      },
    },
  ],
};

if (process.argv.includes("--watch")) {
  const builder = await context(options);
  await builder.watch();
  console.log("Watching Digitloom source files.");
} else {
  await build(options);
}
