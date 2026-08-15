import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {DiskContentSource} from '../src/disk-source';
import {GitHubApiContentSource} from '../src/github-source';
import {
  loadRegistryConfig,
  resolveContentSource,
  resolveRegistryEntryIdentity,
  syncRegistry
} from '../src/registry';
import {
  createTempOpenspecFixture,
  writeArchivedChange,
  writeCapabilitySpec,
  writeReadme
} from './fixtures';

describe('loadRegistryConfig', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'spec-hub-registry-test-'));
  });

  afterEach(() => {
    rmSync(dir, {recursive: true, force: true});
  });

  function writeConfig(yaml: string): string {
    const configPath = join(dir, 'spec-hub.config.yaml');
    writeFileSync(configPath, yaml, 'utf-8');
    return configPath;
  }

  it('parses a valid config with both gitRepoUrl and path entries', () => {
    const configPath = writeConfig(
      [
        'repos:',
        '  - gitRepoUrl: https://github.com/lhx-space/yjs-docs',
        '  - path: ../some-repo',
        '    org: lhx-space',
        '    repo: some-repo'
      ].join('\n')
    );

    const config = loadRegistryConfig(configPath);
    expect(config.repos).toHaveLength(2);
    expect(config.repos[0]?.gitRepoUrl).toBe('https://github.com/lhx-space/yjs-docs');
    expect(config.repos[1]?.path).toBe('../some-repo');
  });

  it('rejects a config missing the top-level repos array', () => {
    const configPath = writeConfig('notRepos: []\n');
    expect(() => loadRegistryConfig(configPath)).toThrow(/expected a top-level "repos" array/);
  });

  it('rejects an entry with neither gitRepoUrl nor path', () => {
    const configPath = writeConfig('repos:\n  - ref: main\n');
    expect(() => loadRegistryConfig(configPath)).toThrow(/exactly one of "gitRepoUrl" or "path"/);
  });

  it('rejects an entry with both gitRepoUrl and path', () => {
    const configPath = writeConfig(
      ['repos:', '  - gitRepoUrl: https://github.com/a/b', '    path: ../a'].join('\n')
    );
    expect(() => loadRegistryConfig(configPath)).toThrow(/exactly one of "gitRepoUrl" or "path"/);
  });

  it('rejects a "path" entry missing "org"', () => {
    const configPath = writeConfig('repos:\n  - path: ../some-repo\n');
    expect(() => loadRegistryConfig(configPath)).toThrow(/must also set "org"/);
  });
});

describe('resolveRegistryEntryIdentity', () => {
  it('derives {org, repo} from a gitRepoUrl', () => {
    expect(
      resolveRegistryEntryIdentity({gitRepoUrl: 'https://github.com/lhx-space/yjs-docs'})
    ).toEqual({
      org: 'lhx-space',
      repo: 'yjs-docs'
    });
  });

  it('an explicit org/repo override wins over what would be parsed from gitRepoUrl', () => {
    expect(
      resolveRegistryEntryIdentity({
        gitRepoUrl: 'https://github.com/lhx-space/yjs-docs',
        org: 'custom-org',
        repo: 'custom-repo'
      })
    ).toEqual({org: 'custom-org', repo: 'custom-repo'});
  });

  it('for a "path" entry, uses the explicit org and falls back to the path basename for repo', () => {
    expect(resolveRegistryEntryIdentity({path: '../checkouts/some-repo', org: 'local'})).toEqual({
      org: 'local',
      repo: 'some-repo'
    });
  });
});

describe('resolveContentSource', () => {
  it('a gitRepoUrl entry resolves to a GitHubApiContentSource', () => {
    const source = resolveContentSource(
      {gitRepoUrl: 'https://github.com/lhx-space/yjs-docs'},
      '/irrelevant'
    );
    expect(source).toBeInstanceOf(GitHubApiContentSource);
  });

  it('a path entry resolves to a DiskContentSource rooted at path-relative-to-configDir', async () => {
    const fixture = createTempOpenspecFixture();
    try {
      writeCapabilitySpec(fixture.openspecDir, 'error-monitor', '## Requirements\n');
      writeReadme(fixture.repoRootDir, '# Project\n');

      // An absolute `path` is returned as-is by `resolve()` regardless of `configDir` — this
      // also exercises the more common case, a path relative to the config file's own directory.
      const source = resolveContentSource({path: fixture.repoRootDir, org: 'local'}, '/irrelevant');

      expect(source).toBeInstanceOf(DiskContentSource);
      expect(await source.listCapabilitySlugs()).toEqual(['error-monitor']);
      expect(await source.readReadme()).toBe('# Project\n');
    } finally {
      fixture.cleanup();
    }
  });
});

describe('syncRegistry', () => {
  it('syncs every "path" entry concurrently and returns entry + identity + content together', async () => {
    const fixtureA = createTempOpenspecFixture();
    const fixtureB = createTempOpenspecFixture();
    try {
      writeCapabilitySpec(fixtureA.openspecDir, 'auth', '## A\n');
      writeCapabilitySpec(fixtureB.openspecDir, 'auth', '## B\n');

      const results = await syncRegistry(
        {
          repos: [
            {path: fixtureA.repoRootDir, org: 'org-a', repo: 'repo-a'},
            {path: fixtureB.repoRootDir, org: 'org-b', repo: 'repo-b'}
          ]
        },
        '/irrelevant'
      );

      expect(results).toHaveLength(2);
      expect(results[0]?.identity).toEqual({org: 'org-a', repo: 'repo-a'});
      expect(results[0]?.content.capabilities[0]?.specMarkdown).toBe('## A\n');
      expect(results[1]?.identity).toEqual({org: 'org-b', repo: 'repo-b'});
      expect(results[1]?.content.capabilities[0]?.specMarkdown).toBe('## B\n');
    } finally {
      fixtureA.cleanup();
      fixtureB.cleanup();
    }
  });

  it('reports started/succeeded through onProgress, in stable index order, without affecting the returned results', async () => {
    const fixtureA = createTempOpenspecFixture();
    const fixtureB = createTempOpenspecFixture();
    try {
      const events: Array<{
        identity: {org: string; repo: string};
        status: string;
        index: number;
        total: number;
      }> = [];

      const results = await syncRegistry(
        {
          repos: [
            {path: fixtureA.repoRootDir, org: 'org-a', repo: 'repo-a'},
            {path: fixtureB.repoRootDir, org: 'org-b', repo: 'repo-b'}
          ]
        },
        '/irrelevant',
        {onProgress: event => events.push(event)}
      );

      expect(results).toHaveLength(2);
      // One 'started' + one 'succeeded' per repo, each keeping the same {identity, index, total}
      // it started with — regardless of which repo's promise happens to settle first.
      const forRepoA = events.filter(event => event.identity.repo === 'repo-a');
      expect(forRepoA.map(event => event.status)).toEqual(['started', 'succeeded']);
      expect(forRepoA.every(event => event.index === 0 && event.total === 2)).toBe(true);
      const forRepoB = events.filter(event => event.identity.repo === 'repo-b');
      expect(forRepoB.map(event => event.status)).toEqual(['started', 'succeeded']);
      expect(forRepoB.every(event => event.index === 1 && event.total === 2)).toBe(true);
    } finally {
      fixtureA.cleanup();
      fixtureB.cleanup();
    }
  });

  it('reports a "failed" status (and still rejects) when a repo errors', async () => {
    const fixture = createTempOpenspecFixture();
    try {
      // A malformed archived change (missing required proposal.md) is what readRepoContentOnce
      // actually throws for — see sync.ts.
      writeArchivedChange(fixture.openspecDir, {
        archivedDate: '2026-08-15',
        slug: 'broken',
        omitProposal: true
      });
      const events: Array<{status: string}> = [];

      await expect(
        syncRegistry(
          {repos: [{path: fixture.repoRootDir, org: 'org-a', repo: 'repo-a'}]},
          '/irrelevant',
          {onProgress: event => events.push(event)}
        )
      ).rejects.toThrow(/missing proposal\.md/);

      expect(events.map(event => event.status)).toEqual(['started', 'failed']);
    } finally {
      fixture.cleanup();
    }
  });
});
