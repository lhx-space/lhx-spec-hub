/**
 * `@luhanxin/spec-hub-rspress-plugin` — thin adapter that turns an already-synced
 * `RepoContent[]` (from `@luhanxin/spec-hub-core`) into rspress routes.
 *
 * Per `docs-site-plugins` spec.md Requirement 1, this plugin never talks to a remote repo or
 * the network itself — it only consumes content that has already been synced to a
 * `RepoContent` tree (see design.md Decision 1: static precompilation, not runtime fetching).
 *
 * Uses rspress's `addPages` hook (`RspressPlugin.addPages`, returns `AdditionalPage[]`) — the
 * only hook rspress exposes for injecting pages that don't correspond to a file on disk.
 */
import type {RepoContent} from '@luhanxin/spec-hub-core';
import type {AdditionalPage, RspressPlugin} from '@rspress/shared';
import {renderArchivedChangePage, renderCapabilityPage} from './render';

export type {GeneratedPage} from './render';
export {
  archivedChangeRoutePath,
  capabilityRoutePath,
  renderArchivedChangePage,
  renderCapabilityPage
} from './render';

export interface SpecHubRspressPluginOptions {
  /** One entry per registered repo whose content has already been synced. Namespacing
   * (`/<org>/<repo>/...`) means repos with same-named capabilities never collide — see
   * `docs-site-plugins` spec.md Requirement 2. */
  repos: RepoContent[];
}

export function specHubRspressPlugin(options: SpecHubRspressPluginOptions): RspressPlugin {
  return {
    name: 'spec-hub-rspress-plugin',
    async addPages(): Promise<AdditionalPage[]> {
      const pages: AdditionalPage[] = [];
      for (const repoContent of options.repos) {
        for (const capability of repoContent.capabilities) {
          pages.push(renderCapabilityPage(repoContent, capability));
        }
        for (const change of repoContent.archivedChanges) {
          pages.push(renderArchivedChangePage(repoContent, change));
        }
      }
      return pages;
    }
  };
}
