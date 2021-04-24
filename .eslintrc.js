module.exports = {
  parser: "@typescript-eslint/parser",
  root: true,
  plugins: ["import", "prettier"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/no-var-requires": "off",
    "no-async-promise-executor": "off",
    "import/order": [
      "error",
      {
        groups: [
          "builtin",
          "external",
          "internal",
          "parent",
          "sibling",
          "index",
        ],
        "newlines-between": "always",
      },
    ],
  },
  ignorePatterns: ["*/**/lib"],
};
