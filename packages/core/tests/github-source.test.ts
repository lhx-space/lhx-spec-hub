import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {GitHubApiContentSource, parseGitHubRepoUrl} from '../src/github-source';

describe('parseGitHubRepoUrl', () => {
  it('parses the https form, with and without .git/trailing slash', () => {
    expect(parseGitHubRepoUrl('https://github.com/lhx-space/lhx-spec-hub')).toEqual({
      owner: 'lhx-space',
      repo: 'lhx-spec-hub'
    });
    expect(parseGitHubRepoUrl('https://github.com/lhx-space/lhx-spec-hub.git')).toEqual({
      owner: 'lhx-space',
      repo: 'lhx-spec-hub'
    });
    expect(parseGitHubRepoUrl('https://github.com/lhx-space/lhx-spec-hub/')).toEqual({
      owner: 'lhx-space',
      repo: 'lhx-spec-hub'
    });
  });

  it('parses the SSH form', () => {
    expect(parseGitHubRepoUrl('git@github.com:lhx-space/lhx-spec-hub.git')).toEqual({
      owner: 'lhx-space',
      repo: 'lhx-spec-hub'
    });
  });

  it('throws on anything that is not a recognized GitHub URL', () => {
    expect(() => parseGitHubRepoUrl('not-a-url')).toThrow(/Not a recognized GitHub repo URL/);
    expect(() => parseGitHubRepoUrl('https://gitlab.com/a/b')).toThrow();
  });
});

/** A fake `fetch` that answers the three endpoint shapes `GitHubApiContentSource` calls —
 * `GET /repos/{owner}/{repo}` (default-branch lookup, only hit when `ref` isn't given), the
 * "get tree recursively" REST endpoint, and `raw.githubusercontent.com` file reads — from an
 * in-memory file map, so these tests never touch the real network. */
function fakeFetch(files: Record<string, string>, options: {defaultBranch?: string} = {}) {
  const tree = Object.keys(files).map(path => ({path, type: 'blob' as const}));
  const defaultBranch = options.defaultBranch ?? 'main';
  return vi.fn(async (url: string | URL, _init?: RequestInit) => {
    const href = url.toString();
    if (href.includes('/git/trees/')) {
      return new Response(JSON.stringify({tree, truncated: false}), {status: 200});
    }
    if (/^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+$/.test(href)) {
      return new Response(JSON.stringify({default_branch: defaultBranch}), {status: 200});
    }
    const match = /^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/(.+)$/.exec(href);
    const path = match?.[1] ? decodeURIComponent(match[1]) : undefined;
    if (path && path in files) {
      return new Response(files[path], {status: 200});
    }
    return new Response('Not Found', {status: 404});
  });
}

describe('GitHubApiContentSource', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('derives capability slugs and archived change dirs from a single cached tree call', async () => {
    const files: Record<string, string> = {
      'openspec/specs/error-monitor/spec.md': '## Requirements\n',
      'openspec/specs/auth/spec.md': '## Requirements\n',
      'openspec/changes/archive/2026-08-15-error-monitor-network-support/proposal.md': '# why\n',
      'openspec/changes/archive/2026-08-15-error-monitor-network-support/specs/error-monitor/spec.md':
        '## delta\n',
      'README.md': '# Project\n'
    };
    const fetchMock = fakeFetch(files);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    // Explicit `ref` here — this test is about tree caching, not default-branch detection
    // (covered separately below), so it should trigger exactly one API call, full stop.
    const source = new GitHubApiContentSource({owner: 'lhx-space', repo: 'yjs-docs', ref: 'main'});

    expect(await source.listCapabilitySlugs()).toEqual(['auth', 'error-monitor']);
    expect(await source.listArchivedChangeDirs()).toEqual([
      {
        dirName: '2026-08-15-error-monitor-network-support',
        archivedDate: '2026-08-15',
        slug: 'error-monitor-network-support'
      }
    ]);
    expect(await source.readCapabilityDeltas('2026-08-15-error-monitor-network-support')).toEqual([
      {slug: 'error-monitor', deltaMarkdown: '## delta\n'}
    ]);
    expect(await source.readCapabilitySpec('error-monitor')).toBe('## Requirements\n');
    expect(await source.readReadme()).toBe('# Project\n');
    expect(await source.readReadmeZhCN()).toBeUndefined();

    // The tree is fetched once and cached — every listing above should have hit the API exactly once.
    const treeCalls = fetchMock.mock.calls.filter(([url]) =>
      url.toString().startsWith('https://api.github.com/')
    );
    expect(treeCalls).toHaveLength(1);
  });

  it('auto-detects the repo\'s actual default branch (not hardcoded "main") when ref is omitted', async () => {
    const fetchMock = fakeFetch(
      {'openspec/specs/error-monitor/spec.md': '## Requirements\n'},
      {defaultBranch: 'master'}
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const source = new GitHubApiContentSource({owner: 'juwenzhang', repo: 'community_platform'});
    expect(await source.listCapabilitySlugs()).toEqual(['error-monitor']);

    const treeCall = fetchMock.mock.calls.find(([url]) => url.toString().includes('/git/trees/'));
    expect(treeCall?.[0].toString()).toContain('/git/trees/master?recursive=1');

    // The default-branch lookup itself should only ever happen once, even though multiple
    // methods each need to resolve a ref (mirrors the tree-caching guarantee above).
    const repoInfoCalls = fetchMock.mock.calls.filter(([url]) =>
      /^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+$/.test(url.toString())
    );
    await source.readReadme();
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        /^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+$/.test(url.toString())
      )
    ).toHaveLength(repoInfoCalls.length);
  });

  it('sends the token as a Bearer header on every request, including the default-branch lookup', async () => {
    const fetchMock = fakeFetch({'README.md': '# Project\n'});
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const source = new GitHubApiContentSource({owner: 'o', repo: 'r', token: 'secret-token'});
    await source.readReadme();
    await source.listCapabilitySlugs();

    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    for (const [, init] of fetchMock.mock.calls) {
      expect((init as RequestInit).headers).toMatchObject({Authorization: 'Bearer secret-token'});
    }
  });

  it('throws a clear error when the GitHub tree API call fails', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('Server Error', {status: 500})
    ) as unknown as typeof fetch;

    const source = new GitHubApiContentSource({owner: 'o', repo: 'r', ref: 'main'});
    await expect(source.listCapabilitySlugs()).rejects.toThrow(/GitHub API error/);
  });

  it('throws a clear error when the default-branch lookup itself fails', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('Not Found', {status: 404})
    ) as unknown as typeof fetch;

    const source = new GitHubApiContentSource({owner: 'o', repo: 'r'});
    await expect(source.listCapabilitySlugs()).rejects.toThrow(
      /GitHub API error fetching repo info/
    );
  });
});
