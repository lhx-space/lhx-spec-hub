import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {writeSpecHubVitepressPages} from '../src/write-pages';
import {buildArchivedChange, buildCapability, buildRepoContent} from './fixtures';

describe('writeSpecHubVitepressPages', () => {
  let docsRoot: string;

  beforeEach(() => {
    docsRoot = mkdtempSync(join(tmpdir(), 'spec-hub-vitepress-test-'));
  });

  afterEach(() => {
    rmSync(docsRoot, {recursive: true, force: true});
  });

  it('writes one .md file per capability and per archived change, namespaced by org/repo', async () => {
    const repo = buildRepoContent({
      capabilities: [buildCapability({slug: 'error-monitor'})],
      archivedChanges: [buildArchivedChange({slug: 'change-one'})]
    });

    const {writtenFiles} = await writeSpecHubVitepressPages({repos: [repo], docsRoot});

    expect(Object.keys(writtenFiles)).toEqual(
      expect.arrayContaining([
        '/lhx-space/yjs-docs/specs/error-monitor',
        '/lhx-space/yjs-docs/changes/change-one'
      ])
    );
    const specFilePath = writtenFiles['/lhx-space/yjs-docs/specs/error-monitor'];
    expect(specFilePath).toBe(join(docsRoot, 'lhx-space/yjs-docs/specs/error-monitor.md'));
    // biome-ignore lint/style/noNonNullAssertion: presence just asserted on the line above
    expect(readFileSync(specFilePath!, 'utf-8')).toContain('error-monitor');
  });

  it('returns a sidebar keyed by /<org>/<repo>/specs/ and /<org>/<repo>/changes/', async () => {
    const repo = buildRepoContent({
      capabilities: [buildCapability({slug: 'error-monitor'})],
      archivedChanges: [buildArchivedChange({slug: 'change-one'})]
    });

    const {sidebar} = await writeSpecHubVitepressPages({repos: [repo], docsRoot});

    expect(sidebar['/lhx-space/yjs-docs/specs/']).toEqual([
      {text: 'error-monitor', link: '/lhx-space/yjs-docs/specs/error-monitor'}
    ]);
    expect(sidebar['/lhx-space/yjs-docs/changes/']).toEqual([
      {text: 'change-one', link: '/lhx-space/yjs-docs/changes/change-one'}
    ]);
  });

  it('keeps two repos with a same-named capability in separate files/sidebar entries', async () => {
    const repoA = buildRepoContent({
      org: 'lhx-space',
      repo: 'yjs-docs',
      capabilities: [buildCapability({slug: 'auth'})]
    });
    const repoB = buildRepoContent({
      org: 'lhx-space',
      repo: 'lhx-spec-hub',
      capabilities: [buildCapability({slug: 'auth'})]
    });

    const {writtenFiles} = await writeSpecHubVitepressPages({repos: [repoA, repoB], docsRoot});
    const pathA = writtenFiles['/lhx-space/yjs-docs/specs/auth'];
    const pathB = writtenFiles['/lhx-space/lhx-spec-hub/specs/auth'];

    expect(pathA).not.toBe(pathB);
    // biome-ignore lint/style/noNonNullAssertion: presence just asserted on the line above
    expect(readFileSync(pathA!, 'utf-8')).toBeTruthy();
    // biome-ignore lint/style/noNonNullAssertion: presence just asserted on the line above
    expect(readFileSync(pathB!, 'utf-8')).toBeTruthy();
  });
});
