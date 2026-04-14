// @ts-check
import { babel } from '@rollup/plugin-babel';

const babelPlugin = babel({
  babelHelpers: 'bundled',
  // exclude core-js itself, and .cjs vendor files (babel injects ESM imports
  // into them which rolldown then rejects since .cjs implies CommonJS)
  exclude: [/\/core-js\//, /\.cjs$/],
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          safari: '15',
          chrome: '61'
        },
        useBuiltIns: 'usage',
        corejs: 3,
        bugfixes: true
      }
    ]
  ]
});

/** @type {import('rolldown').RolldownOptions} */
export default {
  input: 'assets/js/bundle.js',
  platform: 'browser',

  // zlib/iconv-lite are kaitai deps unused in browser
  external: ['zlib', 'iconv-lite'],

  plugins: [babelPlugin],

  output: {
    file: 'assets/js-bundle.min.js',
    format: 'iife',
    minify: true,
    sourcemap: true
  }
};
