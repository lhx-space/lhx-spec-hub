import {createDiskContentSource, readRepoContentOnce} from '@luhanxin/spec-hub-core';
import {defineConfig} from 'rspress/config';
import {specHubRspressPlugin} from '../src/index';

/**
 * Playground docs site — not published, exists purely to show what `specHubRspressPlugin`
 * actually renders. Points at a sibling `yjs-docs` checkout's real `openspec/` content (same
 * fixture `scripts/verify-build.mjs` and `@luhanxin/spec-hub-core`'s own
 * `scripts/verify-against-yjs-docs.ts` use) — run `pnpm playground:dev` from this package.
 *
 * rspress's config loader supports a `Promise<UserConfig>` default export, so a top-level
 * `await` here is fine.
 */
const yjsDocsOpenspecDir = new URL('../../../../yjs-docs/openspec', import.meta.url);
const source = createDiskContentSource(new URL(yjsDocsOpenspecDir).pathname);
const repoContent = await readRepoContentOnce(source, {org: 'lhx-space', repo: 'yjs-docs'});

export default defineConfig({
  root: 'docs',
  title: 'lhx-spec-hub playground (rspress)',
  description: `Live preview of specHubRspressPlugin rendering ${repoContent.capabilities.length} capabilities from yjs-docs`,
  plugins: [specHubRspressPlugin({repos: [repoContent]})]
});
