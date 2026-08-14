import {mkdirSync} from 'node:fs';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {listArchivedChangeDirs, readArchivedChange} from '../src/read-archive';
import {createTempOpenspecFixture, type TempOpenspecFixture, writeArchivedChange} from './fixtures';

describe('listArchivedChangeDirs / readArchivedChange', () => {
  let fixture: TempOpenspecFixture;
  let archiveDir: string;

  beforeEach(() => {
    fixture = createTempOpenspecFixture();
    archiveDir = `${fixture.openspecDir}/changes/archive`;
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('returns an empty array when changes/archive/ does not exist', () => {
    expect(listArchivedChangeDirs(archiveDir)).toEqual([]);
  });

  it('parses <archivedDate>-<slug> directory names', () => {
    writeArchivedChange(fixture.openspecDir, {
      archivedDate: '2026-08-15',
      slug: 'error-monitor-network-support'
    });

    const dirs = listArchivedChangeDirs(archiveDir);
    expect(dirs).toEqual([
      {
        dirName: '2026-08-15-error-monitor-network-support',
        archivedDate: '2026-08-15',
        slug: 'error-monitor-network-support'
      }
    ]);
  });

  it('reads proposal/design/tasks markdown verbatim; design/tasks are optional', () => {
    writeArchivedChange(fixture.openspecDir, {
      archivedDate: '2026-08-15',
      slug: 'error-monitor-network-support',
      proposalMarkdown: '## Why\n原文保真\n',
      touchedCapabilities: ['error-monitor']
    });

    const [parsed] = listArchivedChangeDirs(archiveDir);
    const change = readArchivedChange(archiveDir, parsed!);

    expect(change.proposalMarkdown).toBe('## Why\n原文保真\n');
    expect(change.designMarkdown).toBeUndefined();
    expect(change.tasksMarkdown).toBeUndefined();
    expect(change.touchedCapabilities).toEqual(['error-monitor']);
  });

  it('throws when proposal.md is missing (malformed archive)', () => {
    const dir = `${archiveDir}/2026-08-15-broken`;
    mkdirSync(dir, {recursive: true});

    expect(() =>
      readArchivedChange(archiveDir, {
        dirName: '2026-08-15-broken',
        archivedDate: '2026-08-15',
        slug: 'broken'
      })
    ).toThrow(/missing proposal\.md/);
  });
});
