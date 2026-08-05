import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['src/game/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'ゲームコアはUI非依存に保つ（docs/06 §2）' },
            { name: 'react-dom', message: 'ゲームコアはUI非依存に保つ（docs/06 §2）' },
          ],
          patterns: ['react/*', 'react-dom/*', '*.css'],
        },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'sessionStorage'],
    },
  },
  {
    files: ['src/store/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'store層はReact非依存に保つ（docs/24 §1）' },
            { name: 'react-dom', message: 'store層はReact非依存に保つ（docs/24 §1）' },
          ],
          patterns: ['react/*', 'react-dom/*', '*.css'],
        },
      ],
    },
  },
  {
    files: ['src/scene/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'シーン層はReact非依存に保つ（docs/22 §3.2）' },
            { name: 'react-dom', message: 'シーン層はReact非依存に保つ（docs/22 §3.2）' },
          ],
          patterns: ['react/*', 'react-dom/*', '*.css'],
        },
      ],
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'phaser', message: 'テストはPhaserをimportしない（docs/24 §1-5）' }],
          patterns: [
            'phaser/*',
            '../src/scene/scenes/*',
            '../src/scene/ui/*',
            '../src/scene/game',
            '../src/scene/main',
            '../src/scene/art/assets',
          ],
        },
      ],
    },
  },
)
