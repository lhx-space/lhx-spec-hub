import type {ArchivedChange, CapabilitySpec, RepoContent} from '@luhanxin/spec-hub-core';

/** Minimal in-memory `RepoContent` builder — mirrors `rspress-plugin`'s test fixtures. */
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
