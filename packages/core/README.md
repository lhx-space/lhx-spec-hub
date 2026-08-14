# @luhanxin/spec-hub-core

Framework-agnostic sync/normalization engine for [lhx-spec-hub](../../README.md).
Not implemented yet — see the root README for the current design status.

## Install

```bash
pnpm add @luhanxin/spec-hub-core
```

## Scripts

```bash
pnpm build       # build dist/ via rslib
pnpm dev         # watch-rebuild
pnpm typecheck   # tsc --noEmit
```

## Output formats

`esm + cjs + umd`. Configured in `rslib.config.ts`.
