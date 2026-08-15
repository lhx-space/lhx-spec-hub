/**
 * `@luhanxin/spec-hub-vitepress-plugin` — build-time helper that turns already-synced registry
 * results (`RegistrySyncResult[]` from `@luhanxin/spec-hub-core`'s `syncRegistry`/
 * `loadAndSyncRegistry`) into real VitePress pages + sidebar config.
 *
 * See `write-pages.ts` for why this is a plain async function rather than a Vite/VitePress
 * plugin object.
 */

export type {GeneratedPage} from './render';
export {
  archivedChangeDeltaRoutePath,
  archivedChangeDesignRoutePath,
  archivedChangeRoutePath,
  archivedChangeTasksRoutePath,
  capabilityRoutePath,
  renderArchivedChangeDeltaPage,
  renderArchivedChangeDesignPage,
  renderArchivedChangePage,
  renderArchivedChangeTasksPage,
  renderCapabilityPage,
  renderHomePage,
  renderRepoIndexPage,
  repoCardInfo,
  repoIndexRoutePath,
  repoSidebarEntries
} from './render';
export type {
  WriteSpecHubVitepressPagesOptions,
  WriteSpecHubVitepressPagesResult
} from './write-pages';
export {writeSpecHubVitepressPages} from './write-pages';
