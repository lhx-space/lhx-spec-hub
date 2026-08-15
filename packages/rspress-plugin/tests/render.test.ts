import {describe, expect, it} from 'vitest';
import {
  archivedChangeRoutePath,
  capabilityRoutePath,
  renderArchivedChangePage,
  renderCapabilityPage
} from '../src/render';
import {buildArchivedChange, buildCapability, buildRepoContent} from './fixtures';

describe('capabilityRoutePath / archivedChangeRoutePath', () => {
  it('namespaces by org and repo so same-named capabilities across repos never collide', () => {
    const repoA = buildRepoContent({org: 'lhx-space', repo: 'yjs-docs'});
    const repoB = buildRepoContent({org: 'lhx-space', repo: 'lhx-spec-hub'});

    expect(capabilityRoutePath(repoA, 'auth')).toBe('/lhx-space/yjs-docs/specs/auth');
    expect(capabilityRoutePath(repoB, 'auth')).toBe('/lhx-space/lhx-spec-hub/specs/auth');
    expect(capabilityRoutePath(repoA, 'auth')).not.toBe(capabilityRoutePath(repoB, 'auth'));
  });

  it('archived change route path follows the same namespacing', () => {
    const repo = buildRepoContent();
    expect(archivedChangeRoutePath(repo, 'foo')).toBe('/lhx-space/yjs-docs/changes/foo');
  });
});

describe('renderCapabilityPage', () => {
  it('embeds the verbatim specMarkdown, unmodified', () => {
    const repo = buildRepoContent();
    const capability = buildCapability({
      specMarkdown: '## Requirements\n\nSome *very* specific text.'
    });

    const page = renderCapabilityPage(repo, capability);

    expect(page.routePath).toBe('/lhx-space/yjs-docs/specs/error-monitor');
    expect(page.content).toContain('Some *very* specific text.');
  });

  it('lists related archived changes, oldest first, linking to their route path', () => {
    const repo = buildRepoContent();
    const capability = buildCapability({
      relatedChanges: [
        {slug: 'first-change', archivedDate: '2026-01-01'},
        {slug: 'second-change', archivedDate: '2026-06-01'}
      ]
    });

    const page = renderCapabilityPage(repo, capability);

    expect(page.content).toContain('[first-change](/lhx-space/yjs-docs/changes/first-change)');
    expect(page.content).toContain('[second-change](/lhx-space/yjs-docs/changes/second-change)');
    expect(page.content.indexOf('first-change')).toBeLessThan(
      page.content.indexOf('second-change')
    );
  });

  it('says so explicitly when no archived change touches the capability', () => {
    const repo = buildRepoContent();
    const capability = buildCapability({relatedChanges: []});

    const page = renderCapabilityPage(repo, capability);

    expect(page.content).toContain('No archived changes reference this capability yet');
  });
});

describe('renderArchivedChangePage', () => {
  it('embeds the verbatim proposalMarkdown, and omits Design/Tasks sections when absent', () => {
    const repo = buildRepoContent();
    const change = buildArchivedChange({
      proposalMarkdown: '# Why\n\nUnique proposal text.',
      designMarkdown: undefined,
      tasksMarkdown: undefined
    });

    const page = renderArchivedChangePage(repo, change);

    expect(page.routePath).toBe('/lhx-space/yjs-docs/changes/error-monitor-network-support');
    expect(page.content).toContain('Unique proposal text.');
    expect(page.content).not.toContain('## Design');
    expect(page.content).not.toContain('## Tasks');
  });

  it('includes Design/Tasks sections verbatim when present', () => {
    const repo = buildRepoContent();
    const change = buildArchivedChange({
      designMarkdown: 'Unique design text.',
      tasksMarkdown: 'Unique tasks text.'
    });

    const page = renderArchivedChangePage(repo, change);

    expect(page.content).toContain('## Design');
    expect(page.content).toContain('Unique design text.');
    expect(page.content).toContain('## Tasks');
    expect(page.content).toContain('Unique tasks text.');
  });
});
