/** @fileoverview Applies TypeScript safety rules to the library and its tests. */
import parser from "@typescript-eslint/parser";
import typescript from "@typescript-eslint/eslint-plugin";

export default [
  { ignores: ["dist/**", "demo/dist/**", "node_modules/**"] },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: { parser },
    plugins: { "@typescript-eslint": typescript },
    rules: {
      ...typescript.configs.recommended.rules,
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
];
