/**
 * `@luhanxin/spec-hub-rspress-plugin` — thin adapter that turns already-synced registry results
 * (`RegistrySyncResult[]` from `@luhanxin/spec-hub-core`'s `syncRegistry`/`loadAndSyncRegistry`)
 * into rspress routes.
 *
 * Per `docs-site-plugins` spec.md Requirement 1, this plugin never talks to a remote repo or
 * the network itself — it only consumes content that has already been synced (see design.md
 * Decision 1: static precompilation, not runtime fetching). Fetching/syncing is entirely
 * `@luhanxin/spec-hub-core`'s job (`loadAndSyncRegistry(configPath)`), called by the consumer's
 * own `rspress.config.ts` before this plugin is even constructed.
 *
 * Uses two rspress plugin hooks:
 * - `addPages` (`RspressPlugin.addPages`, returns `AdditionalPage[]`) — the only hook rspress
 *   exposes for injecting pages that don't correspond to a file on disk.
 * - `config` (`RspressPlugin.config`) — merges every registered repo's sidebar
 *   (`repoSidebarEntries`) into `themeConfig.sidebar`. Without this, rspress has no idea the
 *   pages `addPages` injected relate to each other at all: no persistent nav while browsing a
 *   repo's specs/changes, and no prev/next (rspress computes both purely from
 *   `themeConfig.sidebar`'s item order).
 *
 *   This hook ALSO removes rspress's own `auto-nav-sidebar` plugin (`utils.removePlugin
 *   ('auto-nav-sidebar')`) — rspress auto-registers that plugin whenever the *original*
 *   `rspress.config.ts` (before any plugin's `config` hook runs) has no `themeConfig.nav`/
 *   `sidebar` set, which is exactly our case (we only add `sidebar` from *inside* a `config`
 *   hook, too late for that check). Left un-removed, `auto-nav-sidebar`'s own `config` hook runs
 *   after ours (it's appended to the plugin list after every user-supplied plugin) and does
 *   `config.themeConfig = {...config.themeConfig, ...scannedFromDisk}` — an unconditional
 *   replace, not a deep merge, so it silently overwrites `themeConfig.sidebar` with whatever it
 *   scanned from the real `docs/` directory (empty, since every page here is a synthetic
 *   `addPages` route, not a real file) — no sidebar, no prev/next, exactly the symptom this
 *   works around.
 */
import type {RegistrySyncResult} from '@luhanxin/spec-hub-core';
import type {AdditionalPage, RspressPlugin} from '@rspress/shared';
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

export interface SpecHubRspressPluginOptions {
  /** One entry per registered repo whose content has already been synced (typically via
   * `loadAndSyncRegistry('spec-hub.config.yaml')`). Namespacing (`/<org>/<repo>/...`) means
   * repos with same-named capabilities never collide — see `docs-site-plugins` spec.md
   * Requirement 2. */
  repos: RegistrySyncResult[];
}

export function specHubRspressPlugin(options: SpecHubRspressPluginOptions): RspressPlugin {
  return {
    name: 'spec-hub-rspress-plugin',
    config(config, utils) {
      // Must happen unconditionally, before rspress ever gets a chance to run
      // `auto-nav-sidebar`'s own `config` hook — see this file's header comment.
      utils.removePlugin('auto-nav-sidebar');
      const sidebar = Object.assign(
        {},
        config.themeConfig?.sidebar,
        ...options.repos.map(repoSidebarEntries)
      );
      return {...config, themeConfig: {...config.themeConfig, sidebar}};
    },
    async addPages(): Promise<AdditionalPage[]> {
      const pages: AdditionalPage[] = [renderHomePage(options.repos)];
      for (const result of options.repos) {
        pages.push(renderRepoIndexPage(result));
        for (const capability of result.content.capabilities) {
          pages.push(renderCapabilityPage(result.identity, capability));
        }
        for (const change of result.content.archivedChanges) {
          // proposal.md/design.md/tasks.md/each touched capability's delta are each their own
          // page — see render.ts's header comment for why they're not concatenated into one.
          pages.push(renderArchivedChangePage(result.identity, change));
          const design = renderArchivedChangeDesignPage(result.identity, change);
          if (design) pages.push(design);
          const tasks = renderArchivedChangeTasksPage(result.identity, change);
          if (tasks) pages.push(tasks);
          for (const delta of change.specDeltas) {
            pages.push(renderArchivedChangeDeltaPage(result.identity, change, delta));
          }
        }
      }
      return pages;
    }
  };
}
