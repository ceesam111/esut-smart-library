import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

const eslintConfig = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "error",
      "no-duplicate-imports": "error",
      "prefer-const": "error",
      "no-var": "error",
    },
  },
  {
    // Type-aware parsing and rules apply only to TypeScript files that belong to a
    // tsconfig project. `projectService` resolves the nearest project; Supabase edge
    // functions (Deno runtime, excluded from the root tsconfig) have their own
    // `supabase/functions/tsconfig.json`. Plain JS files are linted by the default
    // parser with the non-type-aware rules above.
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      // checksVoidReturn.attributes disabled: React event attributes ignore return
      // values by design (documented typescript-eslint option for React). All other
      // positions (arguments/properties/returns/variables) remain enforced as errors.
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    // Node CLI scripts (package entrypoints, e2e/seed/migrate helpers): real globals.
    files: ["scripts/**/*.mjs", "check-health.cjs", "**/*.cjs"],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // .cjs files are CommonJS by definition; require() is their module system.
      "@typescript-eslint/no-require-imports": "off",
      // Console output is the interface of CLI scripts (seed, migrate, verify, smoke).
      "no-console": "off",
    },
  },
  {
    // Console output is the interface of CLI scripts (seed, migrate, verify, smoke).
    files: ["scripts/**"],
    rules: { "no-console": "off" },
  },
  {
    // Service worker: browser + worker globals.
    files: ["public/sw.js"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.serviceworker },
    },
  },
  {
    ignores: [
      "node_modules/",
      ".next/",
      "out/",
      "build/",
      "dist/",
      "*.config.js",
      "*.config.mjs",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
