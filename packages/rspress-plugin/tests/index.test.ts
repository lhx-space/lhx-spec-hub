import {describe, expect, it} from 'vitest';
import {specHubRspressPlugin} from '../src/index';
import {buildArchivedChange, buildCapability, buildRepoContent} from './fixtures';

describe('specHubRspressPlugin', () => {
  it('has the expected plugin name and exposes addPages', () => {
    const plugin = specHubRspressPlugin({repos: []});
    expect(plugin.name).toBe('spec-hub-rspress-plugin');
    expect(typeof plugin.addPages).toBe('function');
  });

  it('addPages returns one page per capability and one per archived change, across all repos', async () => {
    const repoA = buildRepoContent({
      org: 'lhx-space',
      repo: 'yjs-docs',
      capabilities: [
        buildCapability({slug: 'error-monitor'}),
        buildCapability({slug: 'tiptap-editor'})
      ],
      archivedChanges: [buildArchivedChange({slug: 'change-one'})]
    });
    const repoB = buildRepoContent({
      org: 'lhx-space',
      repo: 'lhx-spec-hub',
      capabilities: [buildCapability({slug: 'error-monitor'})],
      archivedChanges: []
    });

    const plugin = specHubRspressPlugin({repos: [repoA, repoB]});
    // biome-ignore lint/style/noNonNullAssertion: addPages is always defined by this plugin
    const pages = await plugin.addPages!({} as never, false);

    expect(pages).toHaveLength(4);
    const routePaths = pages.map(page => page.routePath);
    expect(routePaths).toEqual(
      expect.arrayContaining([
        '/lhx-space/yjs-docs/specs/error-monitor',
        '/lhx-space/yjs-docs/specs/tiptap-editor',
        '/lhx-space/yjs-docs/changes/change-one',
        '/lhx-space/lhx-spec-hub/specs/error-monitor'
      ])
    );
    // The two repos both have an `error-monitor` capability — namespacing keeps them distinct.
    expect(new Set(routePaths).size).toBe(routePaths.length);
  });

  it('returns an empty page list for an empty repo list', async () => {
    const plugin = specHubRspressPlugin({repos: []});
    // biome-ignore lint/style/noNonNullAssertion: addPages is always defined by this plugin
    const pages = await plugin.addPages!({} as never, false);
    expect(pages).toEqual([]);
  });
});
