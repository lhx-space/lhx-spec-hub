import {existsSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {writeSpecHubVitepressPages} from '../src/write-pages';
import {
  buildArchivedChange,
  buildCapability,
  buildRegistrySyncResult,
  buildRepoContent
} from './fixtures';

describe('writeSpecHubVitepressPages', () => {
  let docsRoot: string;

  beforeEach(() => {
    docsRoot = mkdtempSync(join(tmpdir(), 'spec-hub-vitepress-test-'));
  });

  afterEach(() => {
    rmSync(docsRoot, {recursive: true, force: true});
  });

  it('writes the homepage, one repo-index file, one file per capability, and one file per proposal/design/tasks/delta of each archived change', async () => {
    const result = buildRegistrySyncResult({
      content: buildRepoContent({
        capabilities: [buildCapability({slug: 'error-monitor'})],
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

    const {writtenFiles} = await writeSpecHubVitepressPages({repos: [result], docsRoot});

    expect(Object.keys(writtenFiles)).toEqual(
      expect.arrayContaining([
        '/',
        '/lhx-space/yjs-docs',
        '/lhx-space/yjs-docs/specs/error-monitor',
        '/lhx-space/yjs-docs/changes/change-one',
        '/lhx-space/yjs-docs/changes/change-one/design',
        '/lhx-space/yjs-docs/changes/change-one/tasks',
        '/lhx-space/yjs-docs/changes/change-one/specs/error-monitor'
      ])
    );
    expect(writtenFiles['/']).toBe(join(docsRoot, 'index.md'));
    expect(writtenFiles['/lhx-space/yjs-docs']).toBe(join(docsRoot, 'lhx-space/yjs-docs.md'));
    const specFilePath = writtenFiles['/lhx-space/yjs-docs/specs/error-monitor'];
    expect(specFilePath).toBe(join(docsRoot, 'lhx-space/yjs-docs/specs/error-monitor.md'));
    // biome-ignore lint/style/noNonNullAssertion: presence just asserted on the line above
    expect(readFileSync(specFilePath!, 'utf-8')).toContain('error-monitor');
    expect(existsSync(join(docsRoot, 'index.md'))).toBe(true);
    // proposal.md/design.md/tasks.md/each delta are each their own file, mirroring the on-disk
    // changes/archive/<dir>/{proposal,design,tasks}.md + specs/<slug>/spec.md layout.
    expect(writtenFiles['/lhx-space/yjs-docs/changes/change-one/design']).toBe(
      join(docsRoot, 'lhx-space/yjs-docs/changes/change-one/design.md')
    );
    expect(writtenFiles['/lhx-space/yjs-docs/changes/change-one/specs/error-monitor']).toBe(
      join(docsRoot, 'lhx-space/yjs-docs/changes/change-one/specs/error-monitor.md')
    );
  });

  it('omits design/tasks files when the change has neither, and writes no delta files when it touches no capabilities', async () => {
    const result = buildRegistrySyncResult({
      content: buildRepoContent({archivedChanges: [buildArchivedChange({slug: 'bare-change'})]})
    });

    const {writtenFiles} = await writeSpecHubVitepressPages({repos: [result], docsRoot});

    expect(Object.keys(writtenFiles)).toEqual([
      '/',
      '/lhx-space/yjs-docs',
      '/lhx-space/yjs-docs/changes/bare-change'
    ]);
  });

  it('returns a sidebar keyed by the repo identity path (bare + trailing-slash), with Introduction + Specs/Changes groups', async () => {
    const result = buildRegistrySyncResult({
      content: buildRepoContent({
        capabilities: [buildCapability({slug: 'error-monitor'})],
        archivedChanges: [buildArchivedChange({slug: 'change-one'})]
      })
    });

    const {sidebar} = await writeSpecHubVitepressPages({repos: [result], docsRoot});

    expect(sidebar['/lhx-space/yjs-docs']).toEqual([
      {text: 'Introduction', link: '/lhx-space/yjs-docs'},
      {
        text: 'Specs',
        collapsed: false,
        items: [{text: 'error-monitor', link: '/lhx-space/yjs-docs/specs/error-monitor'}]
      },
      {
        text: 'Changes',
        collapsed: false,
        items: [{text: '2026-08-15 · change-one', link: '/lhx-space/yjs-docs/changes/change-one'}]
      }
    ]);
    expect(sidebar['/lhx-space/yjs-docs/']).toBe(sidebar['/lhx-space/yjs-docs']);
  });

  it('keeps two repos with a same-named capability in separate files/sidebar entries', async () => {
    const resultA = buildRegistrySyncResult({
      content: buildRepoContent({
        org: 'lhx-space',
        repo: 'yjs-docs',
        capabilities: [buildCapability({slug: 'auth'})]
      })
    });
    const resultB = buildRegistrySyncResult({
      content: buildRepoContent({
        org: 'lhx-space',
        repo: 'lhx-spec-hub',
        capabilities: [buildCapability({slug: 'auth'})]
      })
    });

    const {writtenFiles} = await writeSpecHubVitepressPages({repos: [resultA, resultB], docsRoot});
    const pathA = writtenFiles['/lhx-space/yjs-docs/specs/auth'];
    const pathB = writtenFiles['/lhx-space/lhx-spec-hub/specs/auth'];

    expect(pathA).not.toBe(pathB);
    // biome-ignore lint/style/noNonNullAssertion: presence just asserted on the line above
    expect(readFileSync(pathA!, 'utf-8')).toBeTruthy();
    // biome-ignore lint/style/noNonNullAssertion: presence just asserted on the line above
    expect(readFileSync(pathB!, 'utf-8')).toBeTruthy();
  });

  it('writes a homepage even for an empty repo list', async () => {
    const {writtenFiles} = await writeSpecHubVitepressPages({repos: [], docsRoot});
    expect(Object.keys(writtenFiles)).toEqual(['/']);
    expect(existsSync(join(docsRoot, 'index.md'))).toBe(true);
  });
});
