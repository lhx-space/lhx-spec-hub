import {describe, expect, it} from 'vitest';
import {computeRelatedChanges} from '../src/associate';
import type {ArchivedChange} from '../src/types';

function archivedChange(overrides: Partial<ArchivedChange>): ArchivedChange {
  return {
    slug: 'some-change',
    archivedDate: '2026-01-01',
    proposalMarkdown: '',
    touchedCapabilities: [],
    ...overrides
  };
}

describe('computeRelatedChanges', () => {
  it('returns an empty array when no archived change touched the capability', () => {
    const changes = [archivedChange({slug: 'unrelated', touchedCapabilities: ['auth']})];

    expect(computeRelatedChanges('error-monitor', changes)).toEqual([]);
  });

  it('includes only changes whose touchedCapabilities contains the slug', () => {
    const changes = [
      archivedChange({
        slug: 'a',
        archivedDate: '2026-08-13',
        touchedCapabilities: ['error-monitor']
      }),
      archivedChange({slug: 'b', archivedDate: '2026-08-14', touchedCapabilities: ['auth']})
    ];

    expect(computeRelatedChanges('error-monitor', changes)).toEqual([
      {slug: 'a', archivedDate: '2026-08-13'}
    ]);
  });

  it('sorts matches by archivedDate ascending (oldest first)', () => {
    const changes = [
      archivedChange({
        slug: 'later',
        archivedDate: '2026-08-15',
        touchedCapabilities: ['error-monitor']
      }),
      archivedChange({
        slug: 'earlier',
        archivedDate: '2026-08-13',
        touchedCapabilities: ['error-monitor']
      })
    ];

    expect(computeRelatedChanges('error-monitor', changes)).toEqual([
      {slug: 'earlier', archivedDate: '2026-08-13'},
      {slug: 'later', archivedDate: '2026-08-15'}
    ]);
  });
});
