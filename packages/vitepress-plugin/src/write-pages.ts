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
 *   const {sidebar} = await writeSpecHubVitepressPages({repos, docsRoot: __dirname + '/..'});
 *   return {title: 'Spec Hub', themeConfig: {sidebar}};
 * })();
 * ```
 */
import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import type {RepoContent} from '@luhanxin/spec-hub-core';
import type {DefaultTheme} from 'vitepress';
import {renderArchivedChangePage, renderCapabilityPage} from './render';

export interface WriteSpecHubVitepressPagesOptions {
  /** One entry per registered repo whose content has already been synced by
   * `@luhanxin/spec-hub-core` — this function never talks to a remote repo or the network
   * itself (docs-site-plugins spec.md Requirement 1). */
  repos: RepoContent[];
  /** VitePress's `srcDir` (the directory containing `.vitepress/`, or whatever `srcDir` is set
   * to in config) — generated `.md` files are written under here, namespaced
   * `<org>/<repo>/specs/<slug>.md` / `<org>/<repo>/changes/<slug>.md`, matching the route
   * namespacing `docs-site-plugins` spec.md requires. */
  docsRoot: string;
}

export interface WriteSpecHubVitepressPagesResult {
  /** Multi-sidebar config, keyed by `/<org>/<repo>/specs/` and `/<org>/<repo>/changes/` — spread
   * this into `themeConfig.sidebar` in `.vitepress/config.ts`. */
  sidebar: Record<string, DefaultTheme.SidebarItem[]>;
  /** `routePath -> absolute file path written`, mostly useful for tests/debugging. */
  writtenFiles: Record<string, string>;
}

export async function writeSpecHubVitepressPages(
  options: WriteSpecHubVitepressPagesOptions
): Promise<WriteSpecHubVitepressPagesResult> {
  const sidebar: Record<string, DefaultTheme.SidebarItem[]> = {};
  const writtenFiles: Record<string, string> = {};

  for (const repoContent of options.repos) {
    const specItems: DefaultTheme.SidebarItem[] = [];
    const changeItems: DefaultTheme.SidebarItem[] = [];

    for (const capability of repoContent.capabilities) {
      const page = renderCapabilityPage(repoContent, capability);
      writtenFiles[page.routePath] = await writePage(
        options.docsRoot,
        page.routePath,
        page.content
      );
      specItems.push({text: capability.slug, link: page.routePath});
    }

    for (const change of repoContent.archivedChanges) {
      const page = renderArchivedChangePage(repoContent, change);
      writtenFiles[page.routePath] = await writePage(
        options.docsRoot,
        page.routePath,
        page.content
      );
      changeItems.push({text: change.slug, link: page.routePath});
    }

    sidebar[`/${repoContent.org}/${repoContent.repo}/specs/`] = specItems;
    sidebar[`/${repoContent.org}/${repoContent.repo}/changes/`] = changeItems;
  }

  return {sidebar, writtenFiles};
}

async function writePage(docsRoot: string, routePath: string, content: string): Promise<string> {
  const relativePath = `${routePath.replace(/^\//, '')}.md`;
  const filePath = join(docsRoot, relativePath);
  await mkdir(dirname(filePath), {recursive: true});
  await writeFile(filePath, content, 'utf-8');
  return filePath;
}
