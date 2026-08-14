## Context

Each OpenSpec-adopting repo (e.g. `yjs-docs`) already produces `openspec/specs/**/spec.md`
(current capability contracts), `openspec/changes/**` (in-flight proposals), and
`openspec/changes/archive/**` (historical decisions, largest volume). These have very different
lifecycles:

```
specs/<capability>/spec.md   -- "live" contract, continuously updated by merged changes
changes/<name>/*.md          -- short-lived, may be deleted/archived within days
changes/archive/<date>-*/**  -- effectively immutable, high volume (yjs-docs has 112 files)
```

The upstream `openspec` CLI (Fission-AI/OpenSpec) has **no plugin/hook system** for `init` or any
other command (confirmed via its docs — `init` is a fixed pipeline: create directories, generate
AI-tool skill/command files, handle legacy cleanup). Any "auto-register on init" idea must be our
own wrapper command, not an extension point of the upstream tool.

## Goals / Non-Goals

**Goals:**

- Aggregate `openspec/` content from many independently-owned repos into one browsable,
  searchable site.
- Support both rspress and vitepress as the rendering framework (consumer's choice).
- Keep registration self-service (repo owner opts in once) rather than a centrally-maintained
  registry file that someone has to hand-edit per new repo.
- Support both public repos and private repos (via some access-key mechanism, protocol TBD).

**Non-Goals (this round):**

- Not a replacement for the `openspec` CLI or its workflow — read-only consumer of its output.
- Not a real-time/dynamic content service — see Decision 1 below.
- Not designing the exact registration protocol, push-trigger payload, or private-repo token
  storage yet — those are Open Questions, deliberately deferred past this proposal.
- `changes/` (active, in-flight, not yet archived) is explicitly **not** synced or shown in v1 —
  see Decision 6.

## Decisions

### Decision 1: Static pre-build pipeline, not a runtime/dynamic-fetch service

**Chosen:** on registration/push, pull each repo's `openspec/` subtree, normalize it, feed it into
an rspress/vitepress **build**, then deploy the static output.

**Alternative considered:** a runtime service that fetches repo content live per request (e.g. via
GitHub's raw-content API) and renders on the fly.

**Why static wins:** rspress and vitepress are SSG-first — dynamic runtime content sourcing is not
an officially supported extension point for either. Building a live-fetch renderer would mean
writing a custom content layer largely from scratch (closer to building a small Backstage clone
than to writing a docs-site plugin). Static pre-build reuses each framework's own build pipeline,
its search index generation, and its deploy story, at the cost of a rebuild-triggered feel instead
of instant freshness (mitigated by a fast, targeted trigger — see Decision 3).

### Decision 2: Own wrapper CLI + global profile, not an `openspec init` plugin

**Chosen:** a separate command (name TBD, e.g. `spec-hub register`) that a repo owner runs once. It
reads a global profile (`{platformUrl, apiKey}`) and calls the central platform's registration API
with the repo's git remote URL.

**Why:** confirmed upstream `openspec` has no hook system (see Context). Wrapping it is the only
option; we are not forking or patching the upstream tool.

### Decision 3: CI workflow as the push-trigger, not a client git hook or a GitHub App (for MVP)

**Chosen (leaning, not fully settled):** the registration step scaffolds a
`.github/workflows/*.yml` into the target repo (`on: push, paths: ['openspec/**']`) that calls the
central platform's ingest endpoint.

**Alternatives considered:**

| Option | Reliability | Setup cost | Private-repo auth |
|---|---|---|---|
| Client git hook | Low — only fires from the machine that has it installed | None | N/A (local) |
| **CI workflow** | Good — fires regardless of which machine pushed | One committed file + one repo secret | Manual secret |
| GitHub App | Best — works even without any repo file changes | Building/maintaining an App | Installation token (no per-repo secret) |

CI workflow is the pragmatic MVP choice: much less to build than a GitHub App, far more reliable
than a client-side hook (this same monorepo already uses the analogous pattern — `husky` +
`lint-staged` — for local git hooks, which validates the "commit tooling as a scaffolded file"
approach, but push-time reliability specifically needs CI, not a local hook). GitHub App is the
natural upgrade path if/when this becomes a broader SaaS.

### Decision 4: Shared framework-agnostic core + two thin plugin adapters

**Chosen:** `@luhanxin/spec-hub-core` owns pulling/normalizing content into a namespaced tree;
`rspress`/`vitepress` plugin packages are thin adapters translating that tree into each
framework's own routing/sidebar APIs.

**Why:** rspress and vitepress have different plugin shapes (rspress: `RspressPlugin` object with
route/page hooks; vitepress: Vite-plugin conventions + `createContentLoader`-style data loading).
Sharing the core avoids duplicating the sync/normalization logic. (Whether a tool like `unplugin`
can further reduce the two adapters' boilerplate is unverified — flagged as an open question, not
assumed.)

### Decision 5: Multi-repo namespacing to avoid capability name collisions

**Chosen:** routes are namespaced `/<org>/<repo>/specs/<capability>`, never flattened to
`/specs/<capability>` — two different repos can both have a capability named `auth`.

### Decision 6: Content model — only `specs/` (live) + `changes/archive/` (historical), never active `changes/`

**Chosen:** `spec-sync-engine`'s output per repo is exactly two collections:

```
CapabilitySpec[]     -- one per specs/<capability>/spec.md, verbatim markdown +
                         an ordered list of archived-change references that touched it
                         (derived by checking which archived changes have a
                         specs/<capability>/ delta folder — no NLP, purely structural)
ArchivedChange[]      -- one per changes/archive/<date>-<name>/, verbatim proposal/design/
                         tasks markdown + the list of capability slugs it touched
```

Routes: `/<org>/<repo>/specs/<capability>` (capability contract + "history" links) and
`/<org>/<repo>/changes/<slug>` (why a past decision was made), plus index/list pages for each.

**Why exclude active `changes/`:** it's the one content layer whose lifecycle doesn't fit "full
re-read and replace, no diffing" (Decision 6b below) — an active change gets archived or deleted
within days, so syncing it adds exactly the staleness/deletion-tracking complexity the
"re-pull-everything" strategy was chosen to avoid, for a payoff (seeing in-flight work) that's
lower value than the two layers we do keep. Revisit if this project itself accumulates enough
users who want "what's currently being worked on" visibility.

**Verified against real data:** checked `yjs-docs`' actual `openspec/specs/error-monitor/spec.md`
and an archived change's `specs/**` delta — both are plain headings (`### Requirement:` /
`#### Scenario:`) + `WHEN`/`THEN` bullet lists, no exotic formatting. This downgrades the earlier
"may read poorly rendered as plain markdown" risk (see Risks below) — headings map cleanly onto
both frameworks' native in-page TOC/sidebar generation. Try rendering the raw markdown first; only
add a presentation transform in `docs-site-plugins` if it actually looks bad in practice.

### Decision 6b: Full re-sync, no incremental diffing

**Chosen:** every sync operation re-reads a registered repo's entire `specs/` +
`changes/archive/` subtree and replaces the previous normalized tree wholesale.

**Why:** given the volume involved (`yjs-docs` has 24 specs + ~20 archived changes, well within
"fits in memory, cheap to re-read" territory), diffing buys nothing but risk (stale entries left
behind when a spec file is deleted upstream). The one thing this strategy must still guarantee:
a failed sync leaves the previously-synced content tree untouched rather than clearing it —
"sync failed" must never mean "content briefly disappears".

## Risks / Trade-offs

- [Risk] Static rebuild means new/changed content isn't visible until the next build completes →
  [Mitigation] scope the CI trigger to `paths: ['openspec/**']` so rebuilds are targeted, not
  triggered by unrelated pushes; revisit GitHub App if latency becomes a real complaint.
- [Risk] Centralizing many repos' access tokens is a real security surface (encryption at rest,
  rotation, least privilege) → [Mitigation] not solved by this proposal; explicitly an Open
  Question below, must be resolved before any private-repo support ships.
- [Risk] `spec.md`'s Given/When/Then scenario format is written for AI/agent consumption, may read
  poorly rendered as plain markdown → [Mitigation] downgraded after checking real examples (see
  Decision 6) — headings/lists render cleanly; only add a presentation transform in
  `docs-site-plugins` if actual rendering looks bad, keep `spec-sync-engine`'s tree format-agnostic
  either way.
- [Risk] Excluding active `changes/` means the site never shows "what's currently in flight" →
  [Mitigation] accepted trade-off (see Decision 6); revisit only if users actually ask for it.

## Open Questions

- Exact registration protocol/payload (repo URL, branch, subpath, returned token shape).
- Exact push-trigger payload/ingest API shape.
- Private-repo access-key storage/rotation model.
- Whether `unplugin` (or similar) can meaningfully share code between the rspress and vitepress
  adapters, given their differing plugin APIs.
- Central platform's own deployment target (not chosen yet).
