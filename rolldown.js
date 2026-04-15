// @ts-check
import { readFileSync, writeFileSync } from 'node:fs';
import { transformSync } from '@babel/core';
import { babel } from '@rollup/plugin-babel';
import { rolldown } from 'rolldown';
import { minify } from 'terser';

const babelTargets = {
  safari: '15',
  chrome: '67'
};

// Normal files: polyfill injection.
const babelPlugin = babel({
  babelHelpers: 'bundled',
  // exclude core-js itself, and .cjs vendor files (babel injects ESM imports
  // into them which rolldown then rejects since .cjs implies CommonJS)
  exclude: [/\/core-js\//, /\.cjs$/],
  presets: [
    ['@babel/preset-env', {
      targets: babelTargets,
      useBuiltIns: 'usage',
      corejs: 3,
      bugfixes: true
    }]
  ]
});

// core-js and .cjs vendor files: syntax transforms only, no polyfill import injection.
const babelPluginVendor = babel({
  babelHelpers: 'bundled',
  include: [/\/core-js\//, /\.cjs$/],
  presets: [
    ['@babel/preset-env', {
      targets: babelTargets,
      useBuiltIns: false,
      bugfixes: true
    }]
  ]
});

const outFile = 'assets/js-bundle.min.js';
const outMapFile = outFile + '.map';

const bundle = await rolldown({
  input: 'assets/js/bundle.js',
  platform: 'browser',

  // zlib/iconv-lite are kaitai deps unused in browser
  external: ['zlib', 'iconv-lite'],

  plugins: [babelPlugin, babelPluginVendor]
});

await bundle.write({
  file: outFile,
  format: 'iife',
  minify: true,
  sourcemap: true
});

// rolldown's own minifier emits optional catch binding (ES2019) which breaks
// Chrome <66. Run babel then terser on the final file, chaining sourcemaps.
const code = readFileSync(outFile, 'utf8');
const inputMap = readFileSync(outMapFile, 'utf8');

const transformed = transformSync(code, {
  sourceType: 'script',
  sourceMaps: true,
  inputSourceMap: JSON.parse(inputMap),
  presets: [
    ['@babel/preset-env', {
      targets: babelTargets,
      useBuiltIns: false,
      bugfixes: true
    }]
  ]
});

const result = await minify(transformed.code, {
  ecma: 2017,
  format: { comments: false },
  sourceMap: {
    content: JSON.stringify(transformed.map),
    url: 'js-bundle.min.js.map'
  }
});

writeFileSync(outFile, result.code);
writeFileSync(outMapFile, result.map);
