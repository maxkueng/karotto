import stylistic from '@stylistic/eslint-plugin';
import importX from 'eslint-plugin-import-x';
import solid from 'eslint-plugin-solid/configs/typescript';
import tseslint from 'typescript-eslint';
import { customPlugin } from './eslint/custom/index.js';

const stylisticBase = stylistic.configs.customize({
  indent: 2,
  quotes: 'single',
  semi: true,
  jsx: true,
  arrowParens: true,
  braceStyle: '1tbs',
  commaDangle: 'always-multiline',
  quoteProps: 'as-needed',
});

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.tsbuildinfo',
      '**/drizzle/**',
      'packages/android/**',
    ],
  },
  ...tseslint.configs.recommended,
  stylisticBase,
  {
    plugins: {
      'import-x': importX,
      '@stylistic': stylistic,
      custom: customPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-definitions': [
        'error',
        'type',
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'separate-type-imports' },
      ],
      'import-x/consistent-type-specifier-style': [
        'error',
        'prefer-top-level',
      ],
      'import-x/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          pathGroups: [
            {
              pattern: '@/**',
              group: 'internal',
              position: 'before',
            },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'never',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      'custom/no-parent-relative-imports': 'error',
      curly: [
        'error',
        'all',
      ],

      '@stylistic/object-curly-newline': [
        'error',
        {
          ObjectExpression: {
            multiline: true,
            minProperties: 2,
            consistent: true,
          },
          ObjectPattern: {
            multiline: true,
            minProperties: 2,
            consistent: true,
          },
          ImportDeclaration: {
            multiline: true,
            minProperties: 2,
            consistent: true,
          },
          ExportDeclaration: {
            multiline: true,
            minProperties: 2,
            consistent: true,
          },
        },
      ],
      '@stylistic/object-property-newline': [
        'error',
        { allowAllPropertiesOnSameLine: false },
      ],
      '@stylistic/array-bracket-newline': [
        'error',
        {
          multiline: true,
          minItems: 2,
        },
      ],
      '@stylistic/array-element-newline': [
        'error',
        {
          multiline: true,
          minItems: 2,
        },
      ],
      '@stylistic/function-paren-newline': [
        'error',
        { minItems: 2 },
      ],
      '@stylistic/function-call-argument-newline': [
        'error',
        'always',
      ],
      '@stylistic/jsx-first-prop-new-line': [
        'error',
        'multiprop',
      ],
      '@stylistic/jsx-max-props-per-line': [
        'error',
        {
          maximum: 1,
          when: 'always',
        },
      ],
      '@stylistic/jsx-closing-bracket-location': [
        'error',
        'line-aligned',
      ],

      'custom/specifier-newline': 'error',
    },
  },
  {
    files: ['packages/web/src/**/*.{ts,tsx}'],
    ...solid,
  },
);
