import {defineConfig} from '@rslib/core';

/**
 * rslib config for `@luhanxin/spec-hub-core`.
 *
 * This package is Node-only (reads the local filesystem via `node:fs`/`node:path` — see
 * `src/read-specs.ts`/`src/read-archive.ts`), consumed by build-time tooling
 * (`docs-site-plugins`), never shipped to a browser. Deviates from the `lib-monorepo` scaffold
 * default in two ways accordingly:
 *   - `output.target: 'node'` instead of `'web'` — the default `'web'` target treats `node:*`
 *     imports as needing a browser polyfill and refuses to bundle them at all.
 *   - No `umd` format — UMD exists for script-tag/browser consumption, which this package will
 *     never have.
 */
export default defineConfig({
  source: {
    entry: {index: './src/index.ts'}
  },
  lib: [
    {format: 'esm', dts: true, output: {distPath: {root: './dist'}}},
    {format: 'cjs', output: {distPath: {root: './dist'}}}
  ],
  output: {
    target: 'node',
    sourceMap: true
  }
});
