import {mkdirSync} from 'node:fs';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {DiskContentSource} from '../src/disk-source';
import {
  createTempOpenspecFixture,
  type TempOpenspecFixture,
  writeArchivedChange,
  writeCapabilitySpec
} from './fixtures';

describe('DiskContentSource', () => {
  let fixture: TempOpenspecFixture;
  let source: DiskContentSource;

  beforeEach(() => {
    fixture = createTempOpenspecFixture();
    source = new DiskContentSource(fixture.openspecDir);
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('listCapabilitySlugs / readCapabilitySpec', () => {
    it('returns an empty array when specs/ does not exist', async () => {
      expect(await source.listCapabilitySlugs()).toEqual([]);
    });

    it('lists only directories that contain a spec.md, sorted', async () => {
      writeCapabilitySpec(fixture.openspecDir, 'error-monitor', '## Requirements\n');
      writeCapabilitySpec(fixture.openspecDir, 'auth', '## Requirements\n');
      mkdirSync(`${fixture.openspecDir}/specs/not-a-capability`, {recursive: true});

      expect(await source.listCapabilitySlugs()).toEqual(['auth', 'error-monitor']);
    });

    it('reads the spec.md content verbatim, byte-for-byte', async () => {
      const markdown = '## Requirements\n\n### Requirement: 原文保真\n某些内容\t带 tab。\n';
      writeCapabilitySpec(fixture.openspecDir, 'error-monitor', markdown);

      expect(await source.readCapabilitySpec('error-monitor')).toBe(markdown);
    });
  });

  describe('listArchivedChangeDirs / readArchivedChangeFile / listTouchedCapabilities', () => {
    it('returns an empty array when changes/archive/ does not exist', async () => {
      expect(await source.listArchivedChangeDirs()).toEqual([]);
    });

    it('parses <archivedDate>-<slug> directory names', async () => {
      writeArchivedChange(fixture.openspecDir, {
        archivedDate: '2026-08-15',
        slug: 'error-monitor-network-support'
      });

      expect(await source.listArchivedChangeDirs()).toEqual([
        {
          dirName: '2026-08-15-error-monitor-network-support',
          archivedDate: '2026-08-15',
          slug: 'error-monitor-network-support'
        }
      ]);
    });

    it('reads proposal/design/tasks markdown verbatim; design/tasks are undefined when absent', async () => {
      writeArchivedChange(fixture.openspecDir, {
        archivedDate: '2026-08-15',
        slug: 'error-monitor-network-support',
        proposalMarkdown: '## Why\n原文保真\n',
        touchedCapabilities: ['error-monitor']
      });

      expect(
        await source.readArchivedChangeFile(
          '2026-08-15-error-monitor-network-support',
          'proposal.md'
        )
      ).toBe('## Why\n原文保真\n');
      expect(
        await source.readArchivedChangeFile('2026-08-15-error-monitor-network-support', 'design.md')
      ).toBeUndefined();
      expect(
        await source.listTouchedCapabilities('2026-08-15-error-monitor-network-support')
      ).toEqual(['error-monitor']);
    });
  });
});
