import eslint from '@eslint/js';
import eslintCommentPlugin from '@eslint-community/eslint-plugin-eslint-comments/configs';
import stylisticPlugin from '@stylistic/eslint-plugin';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import-x';
import jsdoc from 'eslint-plugin-jsdoc';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';

const stylisticConfig = stylisticPlugin.configs.customize({
  indent: 2,
  quotes: 'single',
  semi: true,
  commaDangle: 'never',
  braceStyle: '1tbs'
});

const ecmaVersion = 2018;

export default [
  // https://eslint.org/docs/rules/
  eslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.commonjs,
        ...globals.jest
      }
    },
    rules: {
      'require-atomic-updates': 'off', // This rule is widely controversial and causes false positives
      'no-console': 'off',
      'prefer-const': ['error', {
        destructuring: 'all' // Only error if all destructured variables can be const
      }],
      'no-var': 'error',
      // TODO: 'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^ignore' }],
      'one-var': ['error', 'never'],
      'curly': ['error', 'all'], // Always require curly braces
      // https://evanhahn.com/using-eslint-to-help-avoid-non-deterministic-randomness/
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use a seeded random.'
        }
      ]
    }
  },

  // https://eslint-community.github.io/eslint-plugin-eslint-comments/rules/
  eslintCommentPlugin.recommended,
  {
    rules: {
      '@eslint-community/eslint-comments/disable-enable-pair': ['error', { allowWholeFile: true }],
      '@eslint-community/eslint-comments/require-description': 'error'
    }
  },

  // https://typescript-eslint.io/rules/
  // (tseslint.configs.recommended: unused)

  // https://eslint.style/rules
  stylisticConfig,
  {
    rules: {
      '@stylistic/no-extra-semi': 'error',
      '@stylistic/yield-star-spacing': ['error', 'after'],
      '@stylistic/operator-linebreak': ['error', 'after', { overrides: { '?': 'before', ':': 'before' } }],
      '@stylistic/curly-newline': ['error', {
        multiline: true,
        consistent: true
      }],
      '@stylistic/object-curly-newline': ['error', {
        multiline: true,
        consistent: true
      }],
      '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: false }],
      '@stylistic/indent': ['error', 2, {
        SwitchCase: 1,
        ignoredNodes: ['Program > ExpressionStatement > CallExpression > :last-child > *']
      }],
      '@stylistic/max-len': ['warn', {
        code: 100,
        comments: 120,
        ignoreUrls: true, // Ignore long URLs
        ignoreStrings: true, // Ignore long strings
        ignoreTemplateLiterals: true, // Ignore long template literals
        ignoreRegExpLiterals: true, // Ignore regex
        ignoreTrailingComments: false, // Enforce trailing comment length
        ignoreComments: false // Enforce all comment lines
      }]
    }
  },

  // https://www.npmjs.com/package/eslint-plugin-import
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.warnings,
  {
    rules: {
      'import-x/order': ['warn', {
        'groups': ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
        'newlines-between': 'never'
      }],
      'import-x/first': 'error',
      'import-x/consistent-type-specifier-style': ['error', 'prefer-top-level']
    },
    languageOptions: {
      ecmaVersion // Default sets this to 2018???, so let's reset this to the default
    }
  },

  // https://www.npmjs.com/package/eslint-plugin-import - but specifically for TypeScript
  // (importPlugin.flatConfigs.typescript: unused)

  // https://www.npmjs.com/package/eslint-plugin-unicorn
  eslintPluginUnicorn.configs.unopinionated,
  {
    rules: {
      // Not a fan of the numeric separators, since I don't think those are a thing in C/C++.
      'unicorn/numeric-separators-style': 'off',
      // The below enforces that hex is always uppercase.
      'unicorn/number-literal-case': 'off',
      // 'unicorn/no-static-only-class': 'off',
      'unicorn/prefer-string-replace-all': 'off', // ES2021 only
      'unicorn/no-array-sort': 'off', // ES2023 only
      'unicorn/prefer-code-point': 'off', // Nullability does not match
      // TODO: Transitional
      'unicorn/prefer-module': 'off'
    }
  },

  // https://www.npmjs.com/package/eslint-plugin-jsdoc
  jsdoc.configs['flat/recommended'],
  {
    settings: {
      jsdoc: {
        mode: 'typescript', // For templates and type "&" syntax.
        // Use `Object` for single and `Object<>` for multiple. That works in TS and Closure.
        preferredTypes: { 'object': 'Object', 'object.<>': 'Object<>', 'Object.<>': 'Object<>', 'object<>': 'Object<>' }
      }
    },
    rules: {
      // Lots of structs don't need detailed descriptions.
      'jsdoc/require-property-description': 'off',

      // Rules not enabled in recommended:
      'jsdoc/sort-tags': 'warn',
      'jsdoc/require-throws': 'warn',
      'jsdoc/require-template': 'warn',
      'jsdoc/check-template-names': 'warn',
      // Require hyphen before param descriptions but not before return description.
      'jsdoc/require-hyphen-before-param-description': ['warn', 'always', { tags: { returns: 'never' } }],
      'jsdoc/require-asterisk-prefix': 'warn',
      'jsdoc/check-syntax': 'warn',
      'jsdoc/check-line-alignment': 'warn',
      'jsdoc/check-indentation': 'warn',
      'jsdoc/convert-to-jsdoc-comments': 'warn',
      'jsdoc/multiline-blocks': ['warn', {
        noMultilineBlocks: true,
        minimumLengthForMultiline: 80,
        multilineTags: []
      }]

    }
  },

  {
    ignores: [
      '**/vendor-js/',
      '**/kaitai-structs/',
      // Defaults
      '**/dist/', // Common build output directory
      '**/*.min.js' // Minified JavaScript files
    ]
  }
];
