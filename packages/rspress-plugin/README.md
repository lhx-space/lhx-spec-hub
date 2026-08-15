# @luhanxin/spec-hub-rspress-plugin

> rspress plugin that renders a synced [`@luhanxin/spec-hub-core`](../core) `RepoContent` tree
> into a docs site — part of [lhx-spec-hub](../../README.md).

Consumes the `capabilities`/`archivedChanges` produced by `@luhanxin/spec-hub-core` for one or
more already-synced repos and turns them into rspress routes via the `addPages` plugin hook. It
never talks to a remote repo or the network itself — "how the content got synced" is entirely
`@luhanxin/spec-hub-core`'s job (see the root `openspec/` design docs for the full architecture).

Routes are namespaced `/<org>/<repo>/specs/<capability>` and `/<org>/<repo>/changes/<slug>`, so
two different repos can each have a same-named capability without colliding.

## Install

```bash
pnpm add @luhanxin/spec-hub-rspress-plugin @luhanxin/spec-hub-core rspress
```

## Usage

```ts
// rspress.config.ts
import {defineConfig} from 'rspress/config';
import {specHubRspressPlugin} from '@luhanxin/spec-hub-rspress-plugin';
import type {RepoContent} from '@luhanxin/spec-hub-core';

declare const repos: RepoContent[]; // however you load your already-synced content

export default defineConfig({
  plugins: [specHubRspressPlugin({repos})]
});
```

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

- Sidebar/nav generation (pages are reachable by direct URL, but not yet linked from a nav)
- Presentation transform for the raw `spec.md`/`proposal.md` markdown (deferred until it
  actually looks bad rendered as-is — see `openspec/changes/cross-repo-spec-aggregation/design.md`
  Decision 6)

## License

[MIT](./LICENSE) © luhanxin
