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
  });

  it('archived change route path follows the same namespacing', () => {
    expect(archivedChangeRoutePath(buildRepoContent(), 'foo')).toBe(
      '/lhx-space/yjs-docs/changes/foo'
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
  it('omits Design/Tasks sections when absent, includes them when present', () => {
    const withoutExtras = renderArchivedChangePage(
      buildRepoContent(),
      buildArchivedChange({designMarkdown: undefined, tasksMarkdown: undefined})
    );
    expect(withoutExtras.content).not.toContain('## Design');
    expect(withoutExtras.content).not.toContain('## Tasks');

    const withExtras = renderArchivedChangePage(
      buildRepoContent(),
      buildArchivedChange({
        designMarkdown: 'Unique design text.',
        tasksMarkdown: 'Unique tasks text.'
      })
    );
    expect(withExtras.content).toContain('Unique design text.');
    expect(withExtras.content).toContain('Unique tasks text.');
  });
});
