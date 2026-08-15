import {describe, expect, it, vi} from 'vitest';
import {specHubRspressPlugin} from '../src/index';
import {
  buildArchivedChange,
  buildCapability,
  buildRegistrySyncResult,
  buildRepoContent
} from './fixtures';

describe('specHubRspressPlugin', () => {
  it('has the expected plugin name and exposes addPages/config', () => {
    const plugin = specHubRspressPlugin({repos: []});
    expect(plugin.name).toBe('spec-hub-rspress-plugin');
    expect(typeof plugin.addPages).toBe('function');
    expect(typeof plugin.config).toBe('function');
  });

  it('addPages returns the homepage, one repo-index page per repo, one page per capability, and one page per proposal/design/tasks/delta of each archived change', async () => {
    const resultA = buildRegistrySyncResult({
      content: buildRepoContent({
        org: 'lhx-space',
        repo: 'yjs-docs',
        capabilities: [
          buildCapability({slug: 'error-monitor'}),
          buildCapability({slug: 'tiptap-editor'})
        ],
        archivedChanges: [
          buildArchivedChange({
            slug: 'change-one',
            designMarkdown: 'design',
            tasksMarkdown: 'tasks',
            specDeltas: [{slug: 'error-monitor', deltaMarkdown: 'delta'}]
          })
        ]
      })
    });
    const resultB = buildRegistrySyncResult({
      content: buildRepoContent({
        org: 'lhx-space',
        repo: 'lhx-spec-hub',
        capabilities: [buildCapability({slug: 'error-monitor'})],
        archivedChanges: []
      })
    });

    const plugin = specHubRspressPlugin({repos: [resultA, resultB]});
    // biome-ignore lint/style/noNonNullAssertion: addPages is always defined by this plugin
    const pages = await plugin.addPages!({} as never, false);

    // homepage + 2 repo-index pages + 3 capability pages + (1 proposal + 1 design + 1 tasks + 1 delta) for change-one
    expect(pages).toHaveLength(10);
    const routePaths = pages.map(page => page.routePath);
    expect(routePaths).toEqual(
      expect.arrayContaining([
        '/',
        '/lhx-space/yjs-docs',
        '/lhx-space/lhx-spec-hub',
        '/lhx-space/yjs-docs/specs/error-monitor',
        '/lhx-space/yjs-docs/specs/tiptap-editor',
        '/lhx-space/yjs-docs/changes/change-one',
        '/lhx-space/yjs-docs/changes/change-one/design',
        '/lhx-space/yjs-docs/changes/change-one/tasks',
        '/lhx-space/yjs-docs/changes/change-one/specs/error-monitor',
        '/lhx-space/lhx-spec-hub/specs/error-monitor'
      ])
    );
    // The two repos both have an `error-monitor` capability — namespacing keeps them distinct.
    expect(new Set(routePaths).size).toBe(routePaths.length);
  });

  it('omits design/tasks pages when the change has neither, and adds no delta pages when it touches no capabilities', async () => {
    const result = buildRegistrySyncResult({
      content: buildRepoContent({archivedChanges: [buildArchivedChange({slug: 'bare-change'})]})
    });

    const plugin = specHubRspressPlugin({repos: [result]});
    // biome-ignore lint/style/noNonNullAssertion: addPages is always defined by this plugin
    const pages = await plugin.addPages!({} as never, false);

    // homepage + repo-index + just the proposal page for bare-change
    expect(pages.map(page => page.routePath)).toEqual([
      '/',
      '/lhx-space/yjs-docs',
      '/lhx-space/yjs-docs/changes/bare-change'
    ]);
  });

  it('returns just an (empty-cards) homepage for an empty repo list', async () => {
    const plugin = specHubRspressPlugin({repos: []});
    // biome-ignore lint/style/noNonNullAssertion: addPages is always defined by this plugin
    const pages = await plugin.addPages!({} as never, false);
    expect(pages.map(page => page.routePath)).toEqual(['/']);
  });

  it("config removes rspress's auto-nav-sidebar plugin, so it can never later overwrite our sidebar", async () => {
    const plugin = specHubRspressPlugin({repos: [buildRegistrySyncResult()]});
    const removePlugin = vi.fn();
    // biome-ignore lint/style/noNonNullAssertion: config is always defined by this plugin
    await plugin.config!({root: 'docs'}, {addPlugin: () => {}, removePlugin}, false);

    expect(removePlugin).toHaveBeenCalledWith('auto-nav-sidebar');
  });

  it('config merges every repo sidebar into themeConfig.sidebar, preserving whatever else was there', async () => {
    const resultA = buildRegistrySyncResult({
      content: buildRepoContent({
        org: 'lhx-space',
        repo: 'yjs-docs',
        capabilities: [buildCapability({slug: 'error-monitor'})]
      })
    });
    const resultB = buildRegistrySyncResult({
      content: buildRepoContent({org: 'lhx-space', repo: 'lhx-spec-hub', capabilities: []})
    });

    const plugin = specHubRspressPlugin({repos: [resultA, resultB]});
    // biome-ignore lint/style/noNonNullAssertion: config is always defined by this plugin
    const nextConfig = await plugin.config!(
      {root: 'docs', themeConfig: {nav: [{text: 'Existing', link: '/existing'}]}},
      {addPlugin: () => {}, removePlugin: () => {}},
      false
    );

    // Untouched fields survive.
    expect(nextConfig.root).toBe('docs');
    expect(nextConfig.themeConfig?.nav).toEqual([{text: 'Existing', link: '/existing'}]);

    const sidebar = nextConfig.themeConfig?.sidebar ?? {};
    expect(sidebar['/lhx-space/yjs-docs']).toEqual([
      {text: 'Introduction', link: '/lhx-space/yjs-docs'},
      {
        text: 'Specs',
        items: [{text: 'error-monitor', link: '/lhx-space/yjs-docs/specs/error-monitor'}],
        collapsible: true,
        collapsed: false
      }
    ]);
    // A repo with no capabilities/archived changes yet still gets its Introduction entry.
    expect(sidebar['/lhx-space/lhx-spec-hub']).toEqual([
      {text: 'Introduction', link: '/lhx-space/lhx-spec-hub'}
    ]);
  });

  it('config does not blow up when the consumer config has no themeConfig at all', async () => {
    const plugin = specHubRspressPlugin({repos: [buildRegistrySyncResult()]});
    // biome-ignore lint/style/noNonNullAssertion: config is always defined by this plugin
    const nextConfig = await plugin.config!(
      {root: 'docs'},
      {addPlugin: () => {}, removePlugin: () => {}},
      false
    );

    expect(nextConfig.themeConfig?.sidebar?.['/lhx-space/yjs-docs']).toEqual([
      {text: 'Introduction', link: '/lhx-space/yjs-docs'}
    ]);
  });
});
