# @luhanxin/spec-hub-vitepress-plugin

> VitePress build-time helper that renders a synced [`@luhanxin/spec-hub-core`](../core)
> `RepoContent` tree into a docs site — part of [lhx-spec-hub](../../README.md).

Unlike rspress, VitePress has no plugin hook for injecting synthetic pages — routing is purely
file-based. So this package is a plain async function, `writeSpecHubVitepressPages`, meant to be
awaited inside your own `.vitepress/config.ts` *before* VitePress reads `srcDir`: it writes real
`.md` files under `<org>/<repo>/specs/<slug>.md` / `<org>/<repo>/changes/<slug>.md`, and returns a
ready-to-use `themeConfig.sidebar` fragment.

## Install

```bash
pnpm add @luhanxin/spec-hub-vitepress-plugin @luhanxin/spec-hub-core vitepress
```

## Usage

```ts
// docs/.vitepress/config.ts
import {writeSpecHubVitepressPages} from '@luhanxin/spec-hub-vitepress-plugin';
import type {RepoContent} from '@luhanxin/spec-hub-core';

declare const repos: RepoContent[]; // however you load your already-synced content

export default (async () => {
  const {sidebar} = await writeSpecHubVitepressPages({repos, docsRoot: __dirname + '/..'});

  return {
    title: 'Spec Hub',
    themeConfig: {sidebar}
  };
})();
```

VitePress's `defineConfig()` type helper only accepts a plain `UserConfig` object (not a
`Promise`), so this example intentionally skips it and exports the async IIFE's result directly —
VitePress's config loader accepts `UserConfig | Promise<UserConfig>` either way.

## Scripts

```bash
pnpm build         # build dist/ via tsup
pnpm dev           # watch-rebuild
pnpm typecheck     # tsc --noEmit
pnpm test          # vitest run
pnpm verify:build  # requires a sibling ../../../yjs-docs checkout — runs a real
                   # `vitepress build` against its real openspec/ content
```

## Not done yet

- Nav generation (only `themeConfig.sidebar`, not top-level nav entries)
- Presentation transform for the raw `spec.md`/`proposal.md` markdown (deferred, see
  `openspec/changes/cross-repo-spec-aggregation/design.md` Decision 6)
- Cleaning up previously-written `.md` files that no longer correspond to synced content (this
  function only ever writes/overwrites, never deletes)

## License

[MIT](./LICENSE) © luhanxin
