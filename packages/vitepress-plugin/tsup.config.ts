import {defineConfig} from 'tsup';

/**
 * tsup build config for @luhanxin/spec-hub-vitepress-plugin.
 * - ESM-only output (matches `"type": "module"` in package.json).
 * - `dts: false` — tsup's bundled dts pipeline (`rollup-plugin-dts`) crashes under
 *   `typescript@7.x` (`Cannot read properties of undefined (reading
 *   'useCaseSensitiveFileNames')`); declarations are instead emitted by a plain
 *   `tsc -p tsconfig.build.json` step, see `package.json`'s `build` script.
 * - No minification: published tarballs should remain readable for debugging.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  sourcemap: false,
  splitting: false,
  treeshake: true,
  target: 'node18'
});
