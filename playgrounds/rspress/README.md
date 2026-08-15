# lhx-spec-hub playground (rspress)

Runnable example of [`@luhanxin/spec-hub-rspress-plugin`](../../packages/rspress-plugin), config
driven by [`spec-hub.config.yaml`](./spec-hub.config.yaml) — every repo listed there is synced
straight from GitHub, entirely in memory (`GitHubApiContentSource`, no `git` clone, no temp
directory), then rendered into a homepage (one card per repo) + per-repo index pages +
capability/archived-change pages.

`docs/` has no real content on purpose — every page, including the homepage at `/`, is generated
at build/dev time by the plugin's `addPages` hook.

## Run it

```bash
pnpm dev    # from this directory, or: pnpm --filter @luhanxin/spec-hub-playground-rspress dev
```

`predev`/`prebuild` rebuild `@luhanxin/spec-hub-core` and `@luhanxin/spec-hub-rspress-plugin`
first, automatically — no manual steps needed. First load hits the real GitHub API (one "get
tree" call per repo, then one `raw.githubusercontent.com` fetch per file actually read) — no
token configured by default, so it's subject to GitHub's ~60/hour/IP unauthenticated rate limit;
add a `token`/`tokenEnv` to an entry in `spec-hub.config.yaml` if you hit it.
