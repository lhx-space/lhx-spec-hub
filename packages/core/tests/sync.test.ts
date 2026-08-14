import {mkdirSync, rmSync} from 'node:fs';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {readRepoContentOnce, SyncedRepoStore} from '../src/sync';
import {
  createTempOpenspecFixture,
  type TempOpenspecFixture,
  writeActiveChange,
  writeArchivedChange,
  writeCapabilitySpec
} from './fixtures';

describe('readRepoContentOnce', () => {
  let fixture: TempOpenspecFixture;

  beforeEach(() => {
    fixture = createTempOpenspecFixture();
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('includes both capabilities and archived changes when both exist', () => {
    writeCapabilitySpec(fixture.openspecDir, 'error-monitor', '## Requirements\n');
    writeArchivedChange(fixture.openspecDir, {
      archivedDate: '2026-08-15',
      slug: 'error-monitor-network-support',
      touchedCapabilities: ['error-monitor']
    });

    const content = readRepoContentOnce({
      openspecDir: fixture.openspecDir,
      identity: {org: 'lhx-space', repo: 'yjs-docs'}
    });

    expect(content.org).toBe('lhx-space');
    expect(content.repo).toBe('yjs-docs');
    expect(content.capabilities).toHaveLength(1);
    expect(content.capabilities[0]!.slug).toBe('error-monitor');
    expect(content.capabilities[0]!.relatedChanges).toEqual([
      {slug: 'error-monitor-network-support', archivedDate: '2026-08-15'}
    ]);
    expect(content.archivedChanges).toHaveLength(1);
    expect(content.archivedChanges[0]!.slug).toBe('error-monitor-network-support');
  });

  it('excludes active, not-yet-archived changes/<name>/ directories entirely', () => {
    writeCapabilitySpec(fixture.openspecDir, 'error-monitor', '## Requirements\n');
    writeActiveChange(fixture.openspecDir, 'some-in-flight-change');

    const content = readRepoContentOnce({
      openspecDir: fixture.openspecDir,
      identity: {org: 'lhx-space', repo: 'yjs-docs'}
    });

    expect(content.archivedChanges).toEqual([]);
  });

  it('a capability with no related archived changes has an empty (not missing) relatedChanges', () => {
    writeCapabilitySpec(fixture.openspecDir, 'error-monitor', '## Requirements\n');

    const content = readRepoContentOnce({
      openspecDir: fixture.openspecDir,
      identity: {org: 'lhx-space', repo: 'yjs-docs'}
    });

    expect(content.capabilities[0]!.relatedChanges).toEqual([]);
  });

  it('a capability removed from disk disappears on the next full re-read', () => {
    writeCapabilitySpec(fixture.openspecDir, 'error-monitor', '## Requirements\n');
    const before = readRepoContentOnce({
      openspecDir: fixture.openspecDir,
      identity: {org: 'lhx-space', repo: 'yjs-docs'}
    });
    expect(before.capabilities.map(c => c.slug)).toEqual(['error-monitor']);

    rmSync(`${fixture.openspecDir}/specs/error-monitor`, {recursive: true, force: true});

    const after = readRepoContentOnce({
      openspecDir: fixture.openspecDir,
      identity: {org: 'lhx-space', repo: 'yjs-docs'}
    });
    expect(after.capabilities).toEqual([]);
  });
});

describe('SyncedRepoStore', () => {
  let fixture: TempOpenspecFixture;
  const identity = {org: 'lhx-space', repo: 'yjs-docs'};

  beforeEach(() => {
    fixture = createTempOpenspecFixture();
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('replaces the previous content wholesale on a successful sync', () => {
    const store = new SyncedRepoStore();
    writeCapabilitySpec(fixture.openspecDir, 'a', '## Requirements\n');
    store.sync({openspecDir: fixture.openspecDir, identity});

    rmSync(`${fixture.openspecDir}/specs/a`, {recursive: true, force: true});
    writeCapabilitySpec(fixture.openspecDir, 'b', '## Requirements\n');
    store.sync({openspecDir: fixture.openspecDir, identity});

    expect(store.getLastSynced(identity)?.capabilities.map(c => c.slug)).toEqual(['b']);
  });

  it('keeps the last successful content and rethrows when a sync fails', () => {
    const store = new SyncedRepoStore();
    writeCapabilitySpec(fixture.openspecDir, 'a', '## Requirements\n');
    store.sync({openspecDir: fixture.openspecDir, identity});

    // Simulate a broken archive (missing proposal.md) causing readRepoContentOnce to throw.
    mkdirSync(`${fixture.openspecDir}/changes/archive/2026-08-15-broken`, {recursive: true});

    expect(() => store.sync({openspecDir: fixture.openspecDir, identity})).toThrow(
      /missing proposal\.md/
    );
    expect(store.getLastSynced(identity)?.capabilities.map(c => c.slug)).toEqual(['a']);
  });

  it('has no last-synced content for a repo that was never synced', () => {
    const store = new SyncedRepoStore();
    expect(store.getLastSynced(identity)).toBeUndefined();
  });
});
