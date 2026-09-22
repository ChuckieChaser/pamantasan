import { defineConfig, globalIgnores } from 'eslint/config';

import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default defineConfig([
    globalIgnores(['dist', 'node_modules', '.venv']),
    {
        files: ['src/**/*.{js,jsx}'],
        extends: [js.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
        languageOptions: {
            globals: globals.browser,
            parserOptions: { ecmaFeatures: { jsx: true } },
        },
    },
    {
        files: ['functions/**/*.{js,cjs}', 'scripts/**/*.js'],
        extends: [js.configs.recommended],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.es2021,
            },
        },
    },
]);
