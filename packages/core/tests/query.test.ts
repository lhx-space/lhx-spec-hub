import {describe, expect, it} from 'vitest';
import {
  getArchivedChange,
  getCapability,
  getRepoContent,
  listArchivedChanges,
  listCapabilities
} from '../src/query';
import type {RepoContent} from '../src/types';

const repoA: RepoContent = {
  org: 'lhx-space',
  repo: 'yjs-docs',
  capabilities: [
    {slug: 'auth', specMarkdown: '# auth A\n', relatedChanges: []},
    {slug: 'error-monitor', specMarkdown: '# error-monitor\n', relatedChanges: []}
  ],
  archivedChanges: [
    {
      slug: 'error-monitor-network-support',
      archivedDate: '2026-08-15',
      proposalMarkdown: '# why\n',
      specDeltas: [{slug: 'error-monitor', deltaMarkdown: '## ADDED Requirements\n'}]
    }
  ]
};

const repoB: RepoContent = {
  org: 'lhx-space',
  repo: 'lhx-spec-hub',
  capabilities: [{slug: 'auth', specMarkdown: '# auth B\n', relatedChanges: []}],
  archivedChanges: []
};

const repos = [repoA, repoB];

describe('listCapabilities', () => {
  it('flattens every repo, annotating each capability with its org/repo', () => {
    expect(listCapabilities(repos)).toEqual([
      {
        slug: 'auth',
        specMarkdown: '# auth A\n',
        relatedChanges: [],
        org: 'lhx-space',
        repo: 'yjs-docs'
      },
      {
        slug: 'error-monitor',
        specMarkdown: '# error-monitor\n',
        relatedChanges: [],
        org: 'lhx-space',
        repo: 'yjs-docs'
      },
      {
        slug: 'auth',
        specMarkdown: '# auth B\n',
        relatedChanges: [],
        org: 'lhx-space',
        repo: 'lhx-spec-hub'
      }
    ]);
  });

  it('two repos with a same-named capability are kept separate, not merged/deduped', () => {
    const authOnly = listCapabilities(repos, {slug: 'auth'});
    expect(authOnly).toHaveLength(2);
    expect(authOnly.map(c => c.repo)).toEqual(['yjs-docs', 'lhx-spec-hub']);
  });

  it('filters by repo', () => {
    expect(listCapabilities(repos, {repo: 'lhx-spec-hub'}).map(c => c.slug)).toEqual(['auth']);
  });

  it('filters by slug as a RegExp', () => {
    expect(listCapabilities(repos, {slug: /^error-/}).map(c => c.slug)).toEqual(['error-monitor']);
  });
});

describe('listArchivedChanges', () => {
  it('flattens every repo, annotating each change with its org/repo', () => {
    expect(listArchivedChanges(repos).map(c => ({slug: c.slug, repo: c.repo}))).toEqual([
      {slug: 'error-monitor-network-support', repo: 'yjs-docs'}
    ]);
  });
});

describe('getRepoContent / getCapability / getArchivedChange', () => {
  it('getRepoContent finds the matching repo, undefined when not found', () => {
    expect(getRepoContent(repos, {org: 'lhx-space', repo: 'yjs-docs'})).toBe(repoA);
    expect(getRepoContent(repos, {org: 'lhx-space', repo: 'nonexistent'})).toBeUndefined();
  });

  it('getCapability finds the exact capability within the exact repo', () => {
    expect(getCapability(repos, {org: 'lhx-space', repo: 'yjs-docs'}, 'auth')).toEqual(
      repoA.capabilities[0]
    );
    expect(getCapability(repos, {org: 'lhx-space', repo: 'lhx-spec-hub'}, 'auth')).toEqual(
      repoB.capabilities[0]
    );
    expect(
      getCapability(repos, {org: 'lhx-space', repo: 'yjs-docs'}, 'nonexistent')
    ).toBeUndefined();
  });

  it('getArchivedChange finds the exact change within the exact repo', () => {
    expect(
      getArchivedChange(
        repos,
        {org: 'lhx-space', repo: 'yjs-docs'},
        'error-monitor-network-support'
      )
    ).toBe(repoA.archivedChanges[0]);
    expect(
      getArchivedChange(
        repos,
        {org: 'lhx-space', repo: 'lhx-spec-hub'},
        'error-monitor-network-support'
      )
    ).toBeUndefined();
  });
});
