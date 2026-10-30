import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist']),
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: {...globals.browser, ...globals.node},
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {'react-refresh/only-export-components':['error',{allowConstantExport:true}]},
  },
  {files:['**/*.{ts,tsx}'],rules:{'no-unused-vars':'off','no-undef':'off'}},
])
