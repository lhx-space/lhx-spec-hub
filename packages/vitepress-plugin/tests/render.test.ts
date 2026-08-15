import type {DefaultTheme} from 'vitepress';
import {describe, expect, it} from 'vitest';
import {parse as parseYaml} from 'yaml';
import {
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
  repoSidebarEntries
} from '../src/render';
import {
  buildArchivedChange,
  buildCapability,
  buildRegistrySyncResult,
  buildRepoContent
} from './fixtures';

/** Every generated page's frontmatter is a real `---\n...\n---` YAML block (see `render.ts`'s
 * `frontmatter()`) — parsing it back, rather than substring-matching the raw text, is what
 * actually proves the YAML is well-formed. */
function parseFrontmatter(content: string): Record<string, unknown> {
  const match = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!match) throw new Error(`No frontmatter block found in:\n${content}`);
  // biome-ignore lint/style/noNonNullAssertion: capture group 1 always exists when `match` is non-null
  return parseYaml(match[1]!) as Record<string, unknown>;
}

describe('capabilityRoutePath / archivedChange*RoutePath', () => {
  it('namespaces by org and repo so same-named capabilities across repos never collide', () => {
    const repoA = buildRepoContent({org: 'lhx-space', repo: 'yjs-docs'});
    const repoB = buildRepoContent({org: 'lhx-space', repo: 'lhx-spec-hub'});

    expect(capabilityRoutePath(repoA, 'auth')).toBe('/lhx-space/yjs-docs/specs/auth');
    expect(capabilityRoutePath(repoB, 'auth')).toBe('/lhx-space/lhx-spec-hub/specs/auth');
  });

  it("design/tasks/delta route paths nest under the change's own route path, not under /specs/", () => {
    const repo = buildRepoContent();
    expect(archivedChangeRoutePath(repo, 'foo')).toBe('/lhx-space/yjs-docs/changes/foo');
    expect(archivedChangeDesignRoutePath(repo, 'foo')).toBe(
      '/lhx-space/yjs-docs/changes/foo/design'
    );
    expect(archivedChangeTasksRoutePath(repo, 'foo')).toBe('/lhx-space/yjs-docs/changes/foo/tasks');
    expect(archivedChangeDeltaRoutePath(repo, 'foo', 'error-monitor')).toBe(
      '/lhx-space/yjs-docs/changes/foo/specs/error-monitor'
    );
  });
});

describe('renderCapabilityPage', () => {
  it('embeds the verbatim specMarkdown, unmodified', () => {
    const page = renderCapabilityPage(
      buildRepoContent(),
      buildCapability({specMarkdown: '## Requirements\n\nSome *very* specific text.'})
    );

    expect(page.routePath).toBe('/lhx-space/yjs-docs/specs/error-monitor');
    expect(page.content).toContain('Some *very* specific text.');
  });

  it('says so explicitly when no archived change touches the capability', () => {
    const page = renderCapabilityPage(buildRepoContent(), buildCapability({relatedChanges: []}));
    expect(page.content).toContain('No archived changes reference this capability yet');
  });
});

describe('renderArchivedChangePage', () => {
  it('is proposal.md, verbatim, and nothing else — design.md/tasks.md/deltas are each their own page/function, not sections of this one', () => {
    const change = buildArchivedChange({
      proposalMarkdown: '## Why\n\nUnique proposal text.',
      designMarkdown: 'Unique design text, must not leak onto this page.',
      tasksMarkdown: 'Unique tasks text, must not leak onto this page.',
      specDeltas: [
        {slug: 'error-monitor', deltaMarkdown: 'Unique delta text, must not leak onto this page.'}
      ]
    });

    const page = renderArchivedChangePage(buildRepoContent(), change);

    expect(page.content).toContain('Unique proposal text.');
    expect(page.content).not.toContain('Unique design text');
    expect(page.content).not.toContain('Unique tasks text');
    expect(page.content).not.toContain('Unique delta text');
  });
});

describe('renderArchivedChangeDesignPage / renderArchivedChangeTasksPage', () => {
  it('return undefined when the change has no design.md/tasks.md', () => {
    const change = buildArchivedChange({designMarkdown: undefined, tasksMarkdown: undefined});
    expect(renderArchivedChangeDesignPage(buildRepoContent(), change)).toBeUndefined();
    expect(renderArchivedChangeTasksPage(buildRepoContent(), change)).toBeUndefined();
  });

  it('render design.md/tasks.md verbatim on their own dedicated route, each nested under the change route', () => {
    const repo = buildRepoContent();
    const change = buildArchivedChange({
      designMarkdown: 'Unique design text.',
      tasksMarkdown: 'Unique tasks text.'
    });

    const designPage = renderArchivedChangeDesignPage(repo, change);
    expect(designPage?.routePath).toBe(
      '/lhx-space/yjs-docs/changes/error-monitor-network-support/design'
    );
    expect(designPage?.content).toContain('Unique design text.');

    const tasksPage = renderArchivedChangeTasksPage(repo, change);
    expect(tasksPage?.routePath).toBe(
      '/lhx-space/yjs-docs/changes/error-monitor-network-support/tasks'
    );
    expect(tasksPage?.content).toContain('Unique tasks text.');
  });
});

describe('renderArchivedChangeDeltaPage', () => {
  it('renders one page per touched capability, the delta markdown verbatim, and a link onward to its current spec page', () => {
    const page = renderArchivedChangeDeltaPage(buildRepoContent(), buildArchivedChange(), {
      slug: 'error-monitor',
      deltaMarkdown: '## ADDED Requirements\n\nUnique delta text.'
    });

    expect(page.routePath).toBe(
      '/lhx-space/yjs-docs/changes/error-monitor-network-support/specs/error-monitor'
    );
    expect(page.content).toContain('## ADDED Requirements');
    expect(page.content).toContain('Unique delta text.');
    expect(page.content).toContain('[error-monitor](/lhx-space/yjs-docs/specs/error-monitor)');
  });
});

describe('repoCardInfo', () => {
  it('entry.name/entry.description win over what would be derived from content', () => {
    const result = buildRegistrySyncResult({
      entry: {
        gitRepoUrl: 'https://github.com/lhx-space/yjs-docs',
        name: 'Yjs Docs',
        description: 'Custom blurb.'
      },
      content: buildRepoContent({readme: '# Ignored\n\nThis should not be used.'})
    });

    expect(repoCardInfo(result)).toEqual({
      title: 'Yjs Docs',
      description: 'Custom blurb.',
      link: '/lhx-space/yjs-docs'
    });
  });

  it('falls back to {org}/{repo} and a README summary when entry has no overrides', () => {
    const result = buildRegistrySyncResult({
      content: buildRepoContent({readme: '# Title\n\nDerived from README.'})
    });

    expect(repoCardInfo(result)).toEqual({
      title: 'lhx-space/yjs-docs',
      description: 'Derived from README.',
      link: '/lhx-space/yjs-docs'
    });
  });
});

describe('renderHomePage', () => {
  it('uses vitepress real home-page frontmatter (layout: home + hero + features)', () => {
    const resultA = buildRegistrySyncResult({
      entry: {
        gitRepoUrl: 'https://github.com/lhx-space/yjs-docs',
        name: 'Yjs Docs',
        description: 'Docs about Yjs.'
      },
      content: buildRepoContent({org: 'lhx-space', repo: 'yjs-docs'})
    });
    const resultB = buildRegistrySyncResult({
      entry: {gitRepoUrl: 'https://github.com/lhx-space/lhx-spec-hub', name: 'Spec Hub'},
      content: buildRepoContent({org: 'lhx-space', repo: 'lhx-spec-hub'})
    });

    const page = renderHomePage([resultA, resultB]);
    const parsed = parseFrontmatter(page.content);

    expect(page.routePath).toBe('/');
    expect(parsed['layout']).toBe('home');
    expect(parsed['hero']).toMatchObject({
      actions: [{text: 'Browse Yjs Docs', link: '/lhx-space/yjs-docs', theme: 'brand'}]
    });
    expect(parsed['features']).toEqual([
      {icon: '📘', title: 'Yjs Docs', details: 'Docs about Yjs.', link: '/lhx-space/yjs-docs'},
      {
        icon: '📘',
        title: 'Spec Hub',
        details: 'No description available.',
        link: '/lhx-space/lhx-spec-hub'
      }
    ]);
  });

  it('renders an empty (no-actions) hero for an empty repo list', () => {
    const page = renderHomePage([]);
    const parsed = parseFrontmatter(page.content);

    expect(parsed['layout']).toBe('home');
    expect((parsed['hero'] as {actions: unknown[]}).actions).toEqual([]);
    expect(parsed['features']).toEqual([]);
  });
});

describe('renderRepoIndexPage', () => {
  it('is the README, verbatim, and nothing else', () => {
    const result = buildRegistrySyncResult({
      content: buildRepoContent({
        readme: '# Yjs Docs\n\nUnique README text.',
        capabilities: [buildCapability({slug: 'error-monitor'})],
        archivedChanges: [buildArchivedChange({slug: 'network-support'})]
      })
    });

    const page = renderRepoIndexPage(result);

    expect(page.routePath).toBe('/lhx-space/yjs-docs');
    expect(page.content).toContain('Unique README text.');
    expect(page.content).not.toContain('error-monitor');
    expect(page.content).not.toContain('network-support');
  });

  it('falls back to readmeZhCN when readme is absent, and says so when neither exists', () => {
    const withZhReadme = renderRepoIndexPage(
      buildRegistrySyncResult({content: buildRepoContent({readmeZhCN: '中文说明。'})})
    );
    expect(withZhReadme.content).toContain('中文说明。');

    const withoutEither = renderRepoIndexPage(buildRegistrySyncResult());
    expect(withoutEither.content).toContain('No README synced');
  });
});

describe('repoSidebarEntries', () => {
  it('always includes an Introduction item pointing at the repo index route', () => {
    const sidebar = repoSidebarEntries(buildRegistrySyncResult());

    expect(sidebar['/lhx-space/yjs-docs']).toEqual([
      {text: 'Introduction', link: '/lhx-space/yjs-docs'}
    ]);
    expect(sidebar['/lhx-space/yjs-docs/']).toBe(sidebar['/lhx-space/yjs-docs']);
  });

  it('adds a Specs group and a Changes group (newest first) only when non-empty', () => {
    const result = buildRegistrySyncResult({
      content: buildRepoContent({
        capabilities: [
          buildCapability({slug: 'error-monitor'}),
          buildCapability({slug: 'tiptap-editor'})
        ],
        archivedChanges: [
          buildArchivedChange({slug: 'first-change', archivedDate: '2026-01-01'}),
          buildArchivedChange({slug: 'second-change', archivedDate: '2026-06-01'})
        ]
      })
    });

    // `repoSidebarEntries` only ever produces plain arrays (never `DefaultTheme.SidebarMulti`'s
    // `{items, base}` shorthand form), so this cast is safe.
    const items = repoSidebarEntries(result)['/lhx-space/yjs-docs'] as DefaultTheme.SidebarItem[];
    const [intro, specs, changes] = items;

    expect(intro).toEqual({text: 'Introduction', link: '/lhx-space/yjs-docs'});
    expect(specs).toMatchObject({
      text: 'Specs',
      items: [
        {text: 'error-monitor', link: '/lhx-space/yjs-docs/specs/error-monitor'},
        {text: 'tiptap-editor', link: '/lhx-space/yjs-docs/specs/tiptap-editor'}
      ]
    });
    // Since neither change here has a design/tasks/delta, each is a plain link, not a group.
    expect(changes).toMatchObject({
      text: 'Changes',
      items: [
        {text: '2026-06-01 · second-change', link: '/lhx-space/yjs-docs/changes/second-change'},
        {text: '2026-01-01 · first-change', link: '/lhx-space/yjs-docs/changes/first-change'}
      ]
    });
  });

  it('nests a change as a group (still itself linking to Proposal) once it has a design doc, a tasks list, or any touched capability', () => {
    const result = buildRegistrySyncResult({
      content: buildRepoContent({
        archivedChanges: [
          buildArchivedChange({
            slug: 'full-change',
            designMarkdown: 'design',
            tasksMarkdown: 'tasks',
            specDeltas: [{slug: 'error-monitor', deltaMarkdown: 'delta'}]
          })
        ]
      })
    });

    const items = repoSidebarEntries(result)['/lhx-space/yjs-docs'] as DefaultTheme.SidebarItem[];
    const [, changesGroup] = items;

    expect(changesGroup).toMatchObject({
      text: 'Changes',
      items: [
        {
          text: '2026-08-15 · full-change',
          link: '/lhx-space/yjs-docs/changes/full-change',
          collapsed: true,
          items: [
            {text: 'Design', link: '/lhx-space/yjs-docs/changes/full-change/design'},
            {text: 'Tasks', link: '/lhx-space/yjs-docs/changes/full-change/tasks'},
            {
              text: 'error-monitor',
              link: '/lhx-space/yjs-docs/changes/full-change/specs/error-monitor'
            }
          ]
        }
      ]
    });
  });

  it('omits the Specs/Changes groups entirely when there is nothing in them yet', () => {
    const sidebar = repoSidebarEntries(buildRegistrySyncResult())['/lhx-space/yjs-docs'];
    expect(sidebar).toHaveLength(1);
  });
});
