# lhx-spec-hub

> Status: **design in progress**, no working code yet. Generated from `lhx-cli create --template=lib-monorepo`.

Aggregate [OpenSpec](https://github.com/Fission-AI/OpenSpec) content (`specs/`, `changes/`, `changes/archive/`) from many
registered git repositories into a single, searchable documentation site — rendered via
[rspress](https://rspress.dev) or [vitepress](https://vitepress.dev), your choice.

## Why

Each of your repos already produces good spec artifacts under `openspec/` via the OpenSpec workflow. Today those
artifacts only live inside their own repo — there's no cross-repo view, no shared search, no "browse the current
contract for capability X across every project" page. `lhx-spec-hub` is the aggregation/rendering layer on top of
that, not a replacement for OpenSpec itself.

## How (current design, not yet implemented)

```
repo (has openspec/)  ──register once──▶  central platform  ──on push──▶  pulls openspec/ subtree
                                                 │
                                                 ▼
                                   two thin plugins read the synced content
                                   and generate routes/sidebar for the site
                                        ┌─────────────┬─────────────┐
                                        │ rspress     │ vitepress   │
                                        │ plugin      │ plugin      │
                                        └─────────────┴─────────────┘
                                                 │
                                                 ▼
                                        static build → deploy
```

Design decisions still open: registration protocol, push-trigger mechanism (leaning CI workflow over client git
hooks or a GitHub App, for MVP simplicity), and the exact content model exposed by `@luhanxin/spec-hub-core` to the
two plugin adapters.

## Layout

```
./
├── packages/
│   └── core/         — @luhanxin/spec-hub-core: framework-agnostic sync/normalization engine (placeholder)
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json       — workspace root
```

`rspress`/`vitepress` plugin packages (`@luhanxin/spec-hub-rspress`, `@luhanxin/spec-hub-vitepress`) will be added
once the `core` content model is settled — scaffold with `lhx-cli add package`, same as `core` was created.

## Scripts

```bash
pnpm install            # bootstrap workspace
pnpm dev                # parallel watch across all packages
pnpm build              # sequential build of every package
pnpm typecheck           # tsc --noEmit per package
pnpm lint               # biome check the whole tree
```

## License

MIT
