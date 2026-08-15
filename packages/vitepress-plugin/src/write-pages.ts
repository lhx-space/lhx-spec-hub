/**
 * VitePress, unlike rspress, has no plugin hook for injecting synthetic pages that don't
 * correspond to a file on disk — its routing is purely file-based (real `.md` files under
 * `srcDir`, or `[param].paths.js` dynamic-route files). So this "adapter" is a plain async
 * function meant to be awaited inside the user's own `.vitepress/config.ts` *before* VitePress
 * itself reads `srcDir` — not a Vite/VitePress plugin object.
 *
 * `defineConfig()`'s TS signature (vitepress@1.6.4) only accepts a plain `UserConfig`, but a
 * config file's `export default` may itself be a `Promise<UserConfig>` (see `UserConfigExport`
 * in vitepress's own types) — so callers write:
 *
 * ```ts
 * // .vitepress/config.ts
 * export default (async () => {
 *   const repos = await loadAndSyncRegistry(resolve(__dirname, '../../spec-hub.config.yaml'));
 *   const {sidebar} = await writeSpecHubVitepressPages({repos, docsRoot: __dirname + '/..'});
 *   return {title: 'Spec Hub', themeConfig: {sidebar}};
 * })();
 * ```
 */
import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import type {RegistrySyncResult} from '@luhanxin/spec-hub-core';
import type {DefaultTheme} from 'vitepress';
import {
  renderArchivedChangeDeltaPage,
  renderArchivedChangeDesignPage,
  renderArchivedChangePage,
  renderArchivedChangeTasksPage,
  renderCapabilityPage,
  renderHomePage,
  renderRepoIndexPage,
  repoSidebarEntries
} from './render';

export interface WriteSpecHubVitepressPagesOptions {
  /** One entry per registered repo whose content has already been synced (typically via
   * `loadAndSyncRegistry('spec-hub.config.yaml')`). This function never talks to a remote repo
   * or the network itself (docs-site-plugins spec.md Requirement 1). */
  repos: RegistrySyncResult[];
  /** VitePress's `srcDir` (the directory containing `.vitepress/`, or whatever `srcDir` is set
   * to in config) — generated `.md` files are written under here: the homepage at `index.md`,
   * each repo's index at `<org>/<repo>.md`, and capabilities/changes namespaced
   * `<org>/<repo>/specs/<slug>.md` / `<org>/<repo>/changes/<slug>.md`, matching the route
   * namespacing `docs-site-plugins` spec.md requires. */
  docsRoot: string;
}

export interface WriteSpecHubVitepressPagesResult {
  /** Multi-sidebar config, one "Introduction + Specs group + Changes group" array per
   * registered repo (see `repoSidebarEntries`), each keyed by both that repo's bare identity
   * path and that path with a trailing slash. Spread this into `themeConfig.sidebar` in
   * `.vitepress/config.ts`. */
  sidebar: DefaultTheme.SidebarMulti;
  /** `routePath -> absolute file path written`, mostly useful for tests/debugging. */
  writtenFiles: Record<string, string>;
}

export async function writeSpecHubVitepressPages(
  options: WriteSpecHubVitepressPagesOptions
): Promise<WriteSpecHubVitepressPagesResult> {
  const writtenFiles: Record<string, string> = {};

  const writeGeneratedPage = async (page: {routePath: string; content: string}) => {
    writtenFiles[page.routePath] = await writePage(options.docsRoot, page.routePath, page.content);
  };

  await writeGeneratedPage(renderHomePage(options.repos));

  for (const result of options.repos) {
    const {identity, content} = result;
    await writeGeneratedPage(renderRepoIndexPage(result));

    for (const capability of content.capabilities) {
      await writeGeneratedPage(renderCapabilityPage(identity, capability));
    }
    for (const change of content.archivedChanges) {
      // proposal.md/design.md/tasks.md/each touched capability's delta are each their own
      // page/file — see render.ts's header comment for why they're not concatenated into one.
      await writeGeneratedPage(renderArchivedChangePage(identity, change));
      const design = renderArchivedChangeDesignPage(identity, change);
      if (design) await writeGeneratedPage(design);
      const tasks = renderArchivedChangeTasksPage(identity, change);
      if (tasks) await writeGeneratedPage(tasks);
      for (const delta of change.specDeltas) {
        await writeGeneratedPage(renderArchivedChangeDeltaPage(identity, change, delta));
      }
    }
  }

  const sidebar: DefaultTheme.SidebarMulti = Object.assign(
    {},
    ...options.repos.map(repoSidebarEntries)
  );

  return {sidebar, writtenFiles};
}

async function writePage(docsRoot: string, routePath: string, content: string): Promise<string> {
  const relativePath = routePath === '/' ? 'index.md' : `${routePath.replace(/^\//, '')}.md`;
  const filePath = join(docsRoot, relativePath);
  await mkdir(dirname(filePath), {recursive: true});
  await writeFile(filePath, content, 'utf-8');
  return filePath;
}
