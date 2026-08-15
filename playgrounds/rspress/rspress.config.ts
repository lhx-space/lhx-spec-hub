import {loadAndSyncRegistry} from '@luhanxin/spec-hub-core';
import {specHubRspressPlugin} from '@luhanxin/spec-hub-rspress-plugin';
import cliProgress from 'cli-progress';
import {defineConfig} from 'rspress/config';

/**
 * Runnable example, not a published package (`"private": true`). Reads `spec-hub.config.yaml`
 * (design.md Decision 8 — this is the "config.yaml drives which repos exist" registration
 * mechanism) and syncs every repo it lists straight from GitHub, entirely in memory
 * (`GitHubApiContentSource`, no `git` clone, no temp directory) — run `pnpm dev` from this
 * directory (or `pnpm --filter @luhanxin/spec-hub-playground-rspress dev` from the repo root).
 *
 * `predev`/`prebuild` (see package.json) always rebuild `@luhanxin/spec-hub-core` and
 * `@luhanxin/spec-hub-rspress-plugin` first — `dist/` is gitignored on both, so this must not
 * depend on a human remembering to run `pnpm build` beforehand.
 *
 * rspress's config loader supports a `Promise<UserConfig>` default export, so a top-level
 * `await` here is fine.
 *
 * Shows a live `cli-progress` bar while syncing (skipped when stdout isn't a TTY) — same
 * `onProgress`-driven approach as the vitepress playground's `scripts/sync.mjs`; see that
 * file's header comment for why this lives here rather than inside `@luhanxin/spec-hub-core`
 * itself.
 */
const bar = process.stdout.isTTY
  ? new cliProgress.SingleBar(
      {
        format: 'Syncing repos |{bar}| {percentage}% | {value}/{total} | last: {repo}',
        hideCursor: true
      },
      cliProgress.Presets.shades_classic
    )
  : undefined;
let barStarted = false;

const repos = await loadAndSyncRegistry(
  new URL('./spec-hub.config.yaml', import.meta.url).pathname,
  {
    onProgress: ({identity, status, total}) => {
      if (!bar) return;
      if (!barStarted) {
        bar.start(total, 0, {repo: ''});
        barStarted = true;
      }
      if (status === 'succeeded' || status === 'failed') {
        bar.increment(1, {
          repo: `${identity.org}/${identity.repo}${status === 'failed' ? ' (failed)' : ''}`
        });
      }
    }
  }
);
bar?.stop();

export default defineConfig({
  root: 'docs',
  title: 'lhx-spec-hub playground (rspress)',
  description: `Live preview of specHubRspressPlugin rendering ${repos.length} repos synced straight from GitHub`,
  plugins: [specHubRspressPlugin({repos})]
});
