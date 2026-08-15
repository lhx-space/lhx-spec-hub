# @luhanxin/spec-hub-vitepress-plugin

> Build-time helper that renders every repo registered in a `spec-hub.config.yaml`
> ([`@luhanxin/spec-hub-core`](../core)'s `RegistrySyncResult[]`) into a real VitePress docs
> site — part of [lhx-spec-hub](../../README.md).

Unlike rspress, VitePress has no plugin hook for injecting synthetic pages — routing is purely
file-based. So this package is a plain async function, `writeSpecHubVitepressPages`, meant to be
awaited inside your own `.vitepress/config.ts` *before* VitePress reads `srcDir`. Given already-
synced `RegistrySyncResult[]` (typically from `loadAndSyncRegistry('spec-hub.config.yaml')`), it
writes:

- **Homepage** (`index.md`) — VitePress's actual home-page layout (`layout: 'home'` frontmatter,
  `hero` + `features`, rendered through VitePress's built-in home-layout theme components — not
  a hand-rolled bullet list). One feature card per registered repo, titled/described from
  `entry.name`/`entry.description` in `spec-hub.config.yaml`, falling back to `{org}/{repo}` and
  a one-line summary of that repo's `README.md`. Clicking a card goes to that repo's own page.
- **Per-repo page ("Introduction")** — that repo's `README.md` (or `README.zh-CN.md`), verbatim.
- **Capability pages** (`/<org>/<repo>/specs/<slug>.md`) — the capability's `spec.md`, verbatim,
  plus a "History" section linking every archived change that touched it.
- **Archived-change pages** (`/<org>/<repo>/changes/<slug>.md`) — `proposal.md`, `design.md`,
  `tasks.md` (when present), **and** a "Spec Deltas" section with the actual ADDED/MODIFIED/
  REMOVED Requirements content from `changes/archive/<dir>/specs/<slug>/spec.md` for every
  capability the change touched, linking each one back to its current capability page.

It also returns a ready-to-use `themeConfig.sidebar` fragment — one entry per repo: an
"Introduction" item + a "Specs" group + a "Changes" group (newest first). VitePress computes
prev/next entirely from sidebar item order, so this `sidebar` return value is what makes prev/
next work — there's no separate "prev/next" API to call.

## Install

```bash
pnpm add @luhanxin/spec-hub-vitepress-plugin @luhanxin/spec-hub-core vitepress
```

## Usage

```ts
// docs/.vitepress/config.ts
import {loadAndSyncRegistry} from '@luhanxin/spec-hub-core';
import {writeSpecHubVitepressPages} from '@luhanxin/spec-hub-vitepress-plugin';

export default (async () => {
  // spec-hub.config.yaml lists the repos this site aggregates — see @luhanxin/spec-hub-core's
  // README for its format (gitRepoUrl/path, name, description, ...).
  const repos = await loadAndSyncRegistry(new URL('../../spec-hub.config.yaml', import.meta.url).pathname);
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

- Top-level `nav` entries per repo (only `themeConfig.sidebar`, not a persistent top nav)
- Presentation transform for the raw `spec.md`/`proposal.md` markdown (deferred, see
  `openspec/changes/cross-repo-spec-aggregation/design.md` Decision 6)
- Cleaning up previously-written `.md` files that no longer correspond to synced content (this
  function only ever writes/overwrites, never deletes)

## License

[MIT](./LICENSE) © luhanxin
