import js from '@eslint/js'
import babelParser from '@babel/eslint-parser'
import eslintConfigPrettier from 'eslint-config-prettier'

// The repository pins TypeScript 7 (native compiler), which no longer exposes
// the compiler API that @typescript-eslint/parser requires. TS sources are
// therefore parsed for linting with @babel/eslint-parser (syntax-level, via
// the typescript/jsx parser plugins), while type checking stays with
// `tsc --noEmit` (which also enforces `noUnusedLocals`/`noUnusedParameters`).
// Because the Babel scope manager does not count TypeScript type references,
// type-only rules are intentionally not enabled; the set below is curated to
// structural and style rules that are accurate on the parsed AST.
//
// Deliberately disabled because tsc already owns the check or the rule
// produces noise on this codebase: no-undef, no-unused-vars,
// no-useless-assignment, no-useless-escape, no-redeclare, no-cond-assign,
// no-prototype-builtins, no-fallthrough, no-irregular-whitespace,
// no-sparse-arrays, no-control-regex.

const nodeGlobals = {
  console: 'readonly',
  process: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  require: 'readonly',
  module: 'readonly',
  fetch: 'readonly',
  WebSocket: 'readonly',
  URL: 'readonly',
}

const wdioGlobals = {
  browser: 'readonly',
  $: 'readonly',
  $$: 'readonly',
  describe: 'readonly',
  it: 'readonly',
  expect: 'readonly',
  before: 'readonly',
  after: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
  // Globals referenced inside `browser.execute(() => { ... })` callbacks,
  // which run in the webview (browser) context.
  document: 'readonly',
  window: 'readonly',
  Event: 'readonly',
  MouseEvent: 'readonly',
  getComputedStyle: 'readonly',
}

const curatedRules = {
  'no-dupe-args': 'error',
  'no-dupe-keys': 'error',
  'no-duplicate-case': 'error',
  'no-empty': ['error', { allowEmptyCatch: true }],
  'no-extra-semi': 'error',
  'no-func-assign': 'error',
  'no-import-assign': 'error',
  'no-unreachable': 'error',
  'no-unreachable-loop': 'error',
  'no-unused-labels': 'error',
  'no-useless-catch': 'error',
  'no-useless-return': 'error',
  'no-var': 'error',
  'prefer-const': 'error',
}

export default [
  { ignores: ['dist/**', 'node_modules/**', 'src-tauri/**', 'platform/**', 'coverage/**', '**/*.d.ts'] },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          parserOpts: { plugins: ['typescript', 'jsx'] },
          babelrc: false,
          configFile: false,
        },
      },
    },
    rules: {
      ...curatedRules,
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-useless-assignment': 'off',
      'no-useless-escape': 'off',
      'no-redeclare': 'off',
      'no-cond-assign': 'off',
      'no-prototype-builtins': 'off',
      'no-fallthrough': 'off',
      'no-irregular-whitespace': 'off',
      'no-sparse-arrays': 'off',
      'no-control-regex': 'off',
    },
  },
  {
    files: ['*.{js,mjs}', 'scripts/**/*.{js,mjs}'],
    languageOptions: { globals: { ...nodeGlobals } },
    rules: curatedRules,
  },
  {
    files: ['e2e/**/*.mjs'],
    languageOptions: { globals: { ...nodeGlobals, ...wdioGlobals } },
    rules: curatedRules,
  },
  eslintConfigPrettier,
]
