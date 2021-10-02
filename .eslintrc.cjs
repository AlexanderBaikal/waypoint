/* eslint-env node */
module.exports = {
  root: true,
  env: { browser: true, es2021: true },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
    project: ["./tsconfig.app.json", "./tsconfig.node.json"],
    tsconfigRootDir: __dirname,
  },
  plugins: ["@typescript-eslint", "react-hooks", "jsx-a11y"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
  ],
  ignorePatterns: ["dist", "coverage", "playwright-report", "test-results"],
  rules: {
    "@typescript-eslint/consistent-type-imports": "error",
    // A leading underscore is the usual way to say "destructured to drop it".
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
    ],
  },
  overrides: [
    {
      files: ["src/**/*.test.{ts,tsx}", "src/test/**/*.ts"],
      env: { jest: true },
      rules: {
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/unbound-method": "off",
        // Test doubles for browser APIs are legitimately empty.
        "@typescript-eslint/no-empty-function": "off",
      },
    },
    {
      files: ["*.config.ts", "*.config.js", "*.config.cjs", "scripts/**/*.mjs"],
      env: { node: true },
      parserOptions: { project: null },
      extends: ["plugin:@typescript-eslint/disable-type-checked"],
    },
  ],
};
