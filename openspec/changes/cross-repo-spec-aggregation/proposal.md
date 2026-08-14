## Why

OpenSpec-adopting repos (e.g. `yjs-docs`) each accumulate good spec artifacts under `openspec/`
(`specs/` = current capability contracts, `changes/` = in-flight work, `changes/archive/` =
historical decisions). Today those artifacts only live inside their own repo: there's no
cross-repo view, no shared search, and no single page to answer "what's the current contract for
capability X, across every project I maintain". `lhx-spec-hub` is the aggregation/rendering layer
on top of that — it does not replace or modify the OpenSpec workflow itself, only consumes its
output.

## What Changes

- New standalone project `lhx-spec-hub` (this repo), open source under `lhx-space`.
- A framework-agnostic sync/normalization engine that pulls `openspec/` content from registered
  repos and exposes it as a per-repo-namespaced content tree.
- A one-time, self-service repo registration flow (a wrapper CLI + global profile config), since
  the upstream `openspec` CLI has no plugin/hook system to piggyback on — this is a separate tool,
  not a plugin of `openspec init`.
- Two thin, framework-specific plugin adapters (rspress, vitepress) that turn the synced content
  into routes/sidebar/navigation for a static documentation site.
- Static build + deploy pipeline (approach chosen over a runtime/dynamic-fetch service — see
  design.md for the comparison).

## Capabilities

### New Capabilities

- `spec-sync-engine`: framework-agnostic engine that, given a registered repo's `openspec/`
  subtree, normalizes it into a namespaced content tree (by org/repo) consumable by any renderer.
- `repo-registration`: one-time, self-service flow for a repo owner to register their repo with a
  central platform (global profile config + wrapper CLI), independent of `openspec init`.
- `docs-site-plugins`: rspress and vitepress plugin adapters that consume the synced content tree
  from `spec-sync-engine` and generate per-repo-namespaced routes, sidebar/navigation, and search.

### Modified Capabilities

(none — greenfield project, no existing specs to modify)

## Impact

- New monorepo packages: `@luhanxin/spec-hub-core` (already scaffolded, empty), plus (not yet
  scaffolded) a CLI package and two plugin packages.
- No impact on any existing repo's `openspec/` workflow — registration/sync is opt-in and
  read-only against the source repos.
- Introduces new infrastructure to operate: a central platform (registration API + sync/ingest +
  triggered rebuilds) and its deployment target.
