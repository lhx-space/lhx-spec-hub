import type {ArchivedChange, CapabilitySpec, RepoContent} from '@luhanxin/spec-hub-core';

/** Minimal in-memory `RepoContent` builder for plugin-layer tests — this package never talks
 * to `@luhanxin/spec-hub-core`'s `RepoContentSource`/disk machinery, it only consumes the
 * already-produced tree, so fixtures here skip straight to that shape. */
export function buildRepoContent(overrides: Partial<RepoContent> = {}): RepoContent {
  return {
    org: 'lhx-space',
    repo: 'yjs-docs',
    capabilities: [],
    archivedChanges: [],
    ...overrides
  };
}

export function buildCapability(overrides: Partial<CapabilitySpec> = {}): CapabilitySpec {
  return {
    slug: 'error-monitor',
    specMarkdown: '## Requirements\n\n### Requirement: Foo\nFoo bar.\n',
    relatedChanges: [],
    ...overrides
  };
}

export function buildArchivedChange(overrides: Partial<ArchivedChange> = {}): ArchivedChange {
  return {
    slug: 'error-monitor-network-support',
    archivedDate: '2026-08-15',
    proposalMarkdown: '# Why\n\nBecause reasons.\n',
    touchedCapabilities: [],
    ...overrides
  };
}
