# @luhanxin/spec-hub-rspress-plugin

> rspress plugin that renders every repo registered in a `spec-hub.config.yaml`
> ([`@luhanxin/spec-hub-core`](../core)'s `RegistrySyncResult[]`) into a docs site — part of
> [lhx-spec-hub](../../README.md).

Consumes already-synced `RegistrySyncResult[]` (typically from `loadAndSyncRegistry
('spec-hub.config.yaml')`) and turns it into a real rspress site:

- **Homepage** — rspress's actual home-page layout (`pageType: 'home'` frontmatter, `hero` +
  `features`, rendered through rspress's built-in `HomeLayout`/`HomeHero`/`HomeFeature`
  components — not a hand-rolled bullet list). One feature card per registered repo, titled/
  described from `entry.name`/`entry.description` in `spec-hub.config.yaml`, falling back to
  `{org}/{repo}` and a one-line summary of that repo's `README.md`. Clicking a card goes to that
  repo's own page.
- **Per-repo page ("Introduction")** — that repo's `README.md` (or `README.zh-CN.md`), verbatim.
- **Capability pages** (`/<org>/<repo>/specs/<slug>`) — the capability's `spec.md`, verbatim,
  plus a "History" section linking every archived change that touched it.
- **Archived-change pages** (`/<org>/<repo>/changes/<slug>`) — `proposal.md`, `design.md`,
  `tasks.md` (when present), **and** a "Spec Deltas" section with the actual ADDED/MODIFIED/
  REMOVED Requirements content from `changes/archive/<dir>/specs/<slug>/spec.md` for every
  capability the change touched, linking each one back to its current capability page.
- **Sidebar + prev/next** — every repo gets a real sidebar (merged into `themeConfig.sidebar` via
  this plugin's `config` hook): "Introduction" + a "Specs" group + a "Changes" group (newest
  first). rspress computes prev/next entirely from sidebar item order, so this is what makes
  prev/next work — there's no separate "prev/next" API to call.

It never talks to a remote repo or the network itself — "how the content got synced" is entirely
`@luhanxin/spec-hub-core`'s job (see the root `openspec/` design docs for the full architecture).

Routes are namespaced `/<org>/<repo>/specs/<capability>` and `/<org>/<repo>/changes/<slug>`, so
two different repos can each have a same-named capability without colliding.

## Why no "write pages" step, unlike the vitepress plugin?

rspress exposes an `addPages` plugin hook specifically for injecting pages that don't correspond
to a file on disk — the whole site (homepage, repo pages, capability pages, change pages) is
built from that one hook, entirely in memory, at build/dev-server time. Nothing is ever written
to `docs/` on disk. VitePress has no equivalent hook (its routing is purely file-based), which is
why `@luhanxin/spec-hub-vitepress-plugin` needs an explicit `writeSpecHubVitepressPages` step that
actually writes `.md` files before VitePress starts. This is a real, load-bearing difference
between the two frameworks, not an oversight in this package.

## Install

```bash
pnpm add @luhanxin/spec-hub-rspress-plugin @luhanxin/spec-hub-core rspress
```

## Usage

```ts
// rspress.config.ts
import {defineConfig} from 'rspress/config';
import {loadAndSyncRegistry} from '@luhanxin/spec-hub-core';
import {specHubRspressPlugin} from '@luhanxin/spec-hub-rspress-plugin';

// spec-hub.config.yaml lists the repos this site aggregates — see @luhanxin/spec-hub-core's
// README for its format (gitRepoUrl/path, name, description, ...).
const repos = await loadAndSyncRegistry(new URL('./spec-hub.config.yaml', import.meta.url).pathname);

export default defineConfig({
  root: 'docs',
  plugins: [specHubRspressPlugin({repos})]
});
```

rspress's config loader accepts a `Promise<UserConfig>` default export, so the top-level `await`
above is fine.

## Scripts

```bash
pnpm build         # build dist/ via tsup
pnpm dev           # watch-rebuild
pnpm typecheck     # tsc --noEmit
pnpm test          # vitest run
pnpm verify:build  # requires a sibling ../../../yjs-docs checkout — runs a real
                   # `rspress build` against its real openspec/ content
```

## Not done yet

- Top-level `nav` entries per repo (repos are only reachable via the homepage cards + sidebar,
  not a persistent top nav)
- Presentation transform for the raw `spec.md`/`proposal.md` markdown (deferred until it
  actually looks bad rendered as-is — see `openspec/changes/cross-repo-spec-aggregation/design.md`
  Decision 6)

## License

[MIT](./LICENSE) © luhanxin
