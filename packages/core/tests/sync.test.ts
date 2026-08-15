import {rmSync} from 'node:fs';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {DiskContentSource} from '../src/disk-source';
import {readRepoContentOnce, SyncedRepoStore} from '../src/sync';
import type {RepoContentSource} from '../src/types';
import {createFakeContentSource, type FakeSourceData} from './fake-source';
import {
  createTempOpenspecFixture,
  writeActiveChange,
  writeArchivedChange,
  writeCapabilitySpec,
  writeReadme,
  writeReadmeZhCN
} from './fixtures';

const identity = {org: 'lhx-space', repo: 'yjs-docs'};

interface BuiltSource {
  source: RepoContentSource;
  cleanup: () => void;
}

function buildDiskSource(data: FakeSourceData): BuiltSource {
  const fixture = createTempOpenspecFixture();
  for (const [slug, markdown] of Object.entries(data.capabilities ?? {})) {
    writeCapabilitySpec(fixture.openspecDir, slug, markdown);
  }
  for (const change of data.archivedChanges ?? []) {
    writeArchivedChange(fixture.openspecDir, change);
  }
  if (data.readme !== undefined) writeReadme(fixture.repoRootDir, data.readme);
  if (data.readmeZhCN !== undefined) writeReadmeZhCN(fixture.repoRootDir, data.readmeZhCN);
  return {source: new DiskContentSource(fixture.repoRootDir), cleanup: fixture.cleanup};
}

function buildFakeSource(data: FakeSourceData): BuiltSource {
  return {source: createFakeContentSource(data), cleanup: () => {}};
}

/**
 * The same scenarios from spec-sync-engine spec.md, run once against `DiskContentSource` and
 * once against a purely in-memory fake — proving design.md Decision 7's claim: swapping the
 * content-source adapter never requires touching `readRepoContentOnce`/`SyncedRepoStore`.
 */
describe.each([
  {name: 'DiskContentSource', build: buildDiskSource},
  {name: 'in-memory fake source', build: buildFakeSource}
])('readRepoContentOnce / SyncedRepoStore — $name', ({build}) => {
  it('includes both capabilities and archived changes when both exist', async () => {
    const {source, cleanup} = build({
      capabilities: {'error-monitor': '## Requirements\n'},
      archivedChanges: [
        {
          archivedDate: '2026-08-15',
          slug: 'error-monitor-network-support',
          touchedCapabilities: ['error-monitor']
        }
      ]
    });
    try {
      const content = await readRepoContentOnce(source, identity);
      expect(content.org).toBe('lhx-space');
      expect(content.repo).toBe('yjs-docs');
      expect(content.capabilities).toHaveLength(1);
      expect(content.capabilities[0]?.slug).toBe('error-monitor');
      expect(content.capabilities[0]?.relatedChanges).toEqual([
        {slug: 'error-monitor-network-support', archivedDate: '2026-08-15'}
      ]);
      expect(content.archivedChanges).toHaveLength(1);
      expect(content.archivedChanges[0]?.slug).toBe('error-monitor-network-support');
    } finally {
      cleanup();
    }
  });

  it('a capability with no related archived changes has an empty (not missing) relatedChanges', async () => {
    const {source, cleanup} = build({capabilities: {'error-monitor': '## Requirements\n'}});
    try {
      const content = await readRepoContentOnce(source, identity);
      expect(content.capabilities[0]?.relatedChanges).toEqual([]);
    } finally {
      cleanup();
    }
  });

  it('throws when an archived change is missing proposal.md', async () => {
    const {source, cleanup} = build({
      archivedChanges: [{archivedDate: '2026-08-15', slug: 'broken', omitProposal: true}]
    });
    try {
      await expect(readRepoContentOnce(source, identity)).rejects.toThrow(/missing proposal\.md/);
    } finally {
      cleanup();
    }
  });

  it('SyncedRepoStore keeps the last successful content and rethrows when a sync fails', async () => {
    const good = build({capabilities: {a: '## Requirements\n'}});
    const broken = build({
      archivedChanges: [{archivedDate: '2026-08-15', slug: 'broken', omitProposal: true}]
    });
    try {
      const store = new SyncedRepoStore();
      await store.sync(good.source, identity);

      await expect(store.sync(broken.source, identity)).rejects.toThrow(/missing proposal\.md/);
      expect(store.getLastSynced(identity)?.capabilities.map(c => c.slug)).toEqual(['a']);
    } finally {
      good.cleanup();
      broken.cleanup();
    }
  });

  it('SyncedRepoStore has no last-synced content for a repo that was never synced', () => {
    const store = new SyncedRepoStore();
    expect(store.getLastSynced(identity)).toBeUndefined();
  });

  it('includes readme/readmeZhCN when the source has them, undefined when it does not', async () => {
    const withReadmes = build({readme: '# Project\nEnglish.\n', readmeZhCN: '# 项目\n中文。\n'});
    const withoutReadmes = build({capabilities: {a: '## Requirements\n'}});
    try {
      const content = await readRepoContentOnce(withReadmes.source, identity);
      expect(content.readme).toBe('# Project\nEnglish.\n');
      expect(content.readmeZhCN).toBe('# 项目\n中文。\n');

      const bare = await readRepoContentOnce(withoutReadmes.source, identity);
      expect(bare.readme).toBeUndefined();
      expect(bare.readmeZhCN).toBeUndefined();
    } finally {
      withReadmes.cleanup();
      withoutReadmes.cleanup();
    }
  });
});

/** Scenarios that only make sense for the disk adapter specifically (active, non-archived
 * `changes/<name>/` directories are a disk/on-disk-layout concept the `RepoContentSource`
 * protocol has no notion of at all — the fake source can't even represent one). */
describe('DiskContentSource-specific behavior', () => {
  let fixture: ReturnType<typeof createTempOpenspecFixture>;

  beforeEach(() => {
    fixture = createTempOpenspecFixture();
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('excludes active, not-yet-archived changes/<name>/ directories entirely', async () => {
    writeCapabilitySpec(fixture.openspecDir, 'error-monitor', '## Requirements\n');
    writeActiveChange(fixture.openspecDir, 'some-in-flight-change');

    const content = await readRepoContentOnce(new DiskContentSource(fixture.repoRootDir), identity);
    expect(content.archivedChanges).toEqual([]);
  });

  it('a capability removed from disk disappears on the next full re-read', async () => {
    writeCapabilitySpec(fixture.openspecDir, 'error-monitor', '## Requirements\n');
    const source = new DiskContentSource(fixture.repoRootDir);
    const before = await readRepoContentOnce(source, identity);
    expect(before.capabilities.map(c => c.slug)).toEqual(['error-monitor']);

    rmSync(`${fixture.openspecDir}/specs/error-monitor`, {recursive: true, force: true});

    const after = await readRepoContentOnce(source, identity);
    expect(after.capabilities).toEqual([]);
  });
});
