/**
 * `@luhanxin/spec-hub-vitepress-plugin` — build-time helper that turns an already-synced
 * `RepoContent[]` (from `@luhanxin/spec-hub-core`) into real VitePress pages + sidebar config.
 *
 * See `write-pages.ts` for why this is a plain async function rather than a Vite/VitePress
 * plugin object.
 */

export type {GeneratedPage} from './render';
export {
  archivedChangeRoutePath,
  capabilityRoutePath,
  renderArchivedChangePage,
  renderCapabilityPage
} from './render';
export type {
  WriteSpecHubVitepressPagesOptions,
  WriteSpecHubVitepressPagesResult
} from './write-pages';
export {writeSpecHubVitepressPages} from './write-pages';
