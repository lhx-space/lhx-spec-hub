import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {parse as parseYaml} from 'yaml';
import {createDiskContentSource} from './disk-source';
import {createGitHubApiContentSource, parseGitHubRepoUrl} from './github-source';
import {readRepoContentOnce} from './sync';
import type {RepoContent, RepoContentSource, RepoIdentity} from './types';

/**
 * One registered repo, as written in `spec-hub.config.yaml` (design.md Decision 8 — this is the
 * "config.yaml drives which repos exist" registration mechanism, in place of the earlier-sketched
 * "central platform + push webhook" idea, which needed a long-running service this project
 * doesn't have). Exactly one of `gitRepoUrl` / `path` must be set — which one determines which
 * `RepoContentSource` adapter gets used (Decision 7).
 */
export interface RegistryEntry {
  /** `https://github.com/<owner>/<repo>` (or `.git`/SSH form) — reads happen entirely over HTTP,
   * in memory, via `GitHubApiContentSource`. Mutually exclusive with `path`. */
  gitRepoUrl?: string;
  /** A local directory (resolved relative to the config file's own directory) that already
   * contains this repo's checkout — reads happen via `DiskContentSource`. Mutually exclusive
   * with `gitRepoUrl`. Meant for local dev loops where hitting the network on every rebuild is
   * unnecessary friction, not for production use. */
  path?: string;
  /** Branch/tag/commit — only meaningful with `gitRepoUrl`. Defaults to `main`. */
  ref?: string;
  /** GitHub personal access token, for private repos or to raise the rate limit. Prefer
   * `tokenEnv` over writing a literal token into a checked-in config file. */
  token?: string;
  /** Name of an environment variable to read the token from at sync time. */
  tokenEnv?: string;
  /** Overrides the `{org, repo}` identity derived from `gitRepoUrl`/the `path` basename — required
   * for `path` entries (there's nothing to parse an org out of a local path), optional for
   * `gitRepoUrl` entries. */
  org?: string;
  repo?: string;
  /** Overrides the homepage card title `docs-site-plugins` would otherwise derive from the repo
   * identity. */
  name?: string;
  /** Overrides the homepage card summary `docs-site-plugins` would otherwise derive from
   * `README.md`'s first paragraph. */
  description?: string;
}

export interface RegistryConfig {
  repos: RegistryEntry[];
}

/** One entry's fully-synced result — `identity`/`content` are what `readRepoContentOnce`
 * produces; `entry` is kept alongside so `docs-site-plugins` can read `name`/`description`
 * overrides without re-deriving them. */
export interface RegistrySyncResult {
  entry: RegistryEntry;
  identity: RepoIdentity;
  content: RepoContent;
}

export function loadRegistryConfig(configPath: string): RegistryConfig {
  const raw = parseYaml(readFileSync(configPath, 'utf-8'));
  if (typeof raw !== 'object' || raw === null || !Array.isArray((raw as {repos?: unknown}).repos)) {
    throw new Error(`${configPath}: expected a top-level "repos" array`);
  }
  const repos = (raw as {repos: unknown[]}).repos.map((entry, index) =>
    validateEntry(entry, index, configPath)
  );
  return {repos};
}

function validateEntry(entry: unknown, index: number, configPath: string): RegistryEntry {
  if (typeof entry !== 'object' || entry === null) {
    throw new Error(`${configPath}: repos[${index}] must be an object`);
  }
  const {gitRepoUrl, path} = entry as RegistryEntry;
  if (Boolean(gitRepoUrl) === Boolean(path)) {
    throw new Error(
      `${configPath}: repos[${index}] must set exactly one of "gitRepoUrl" or "path"`
    );
  }
  if (path && !(entry as RegistryEntry).org) {
    throw new Error(
      `${configPath}: repos[${index}] uses "path" and must also set "org" (and usually "repo")`
    );
  }
  return entry as RegistryEntry;
}

/** Derives `{org, repo}` for an entry, and resolves an env-var token, without touching the
 * network — split out from `resolveContentSource` so callers (e.g. the homepage renderer) can
 * get an entry's identity without triggering a sync. */
export function resolveRegistryEntryIdentity(entry: RegistryEntry): RepoIdentity {
  if (entry.gitRepoUrl) {
    const {owner, repo} = parseGitHubRepoUrl(entry.gitRepoUrl);
    return {org: entry.org ?? owner, repo: entry.repo ?? repo};
  }
  if (!entry.org) {
    throw new Error(
      'A "path" registry entry must set "org" (validated at load time — this should be unreachable)'
    );
  }
  return {org: entry.org, repo: entry.repo ?? basenameOf(entry.path ?? '')};
}

function basenameOf(path: string): string {
  return path.replace(/\/+$/, '').split('/').at(-1) ?? path;
}

function resolveEntryToken(entry: RegistryEntry): string | undefined {
  return entry.token ?? (entry.tokenEnv ? process.env[entry.tokenEnv] : undefined);
}

/** @param configDir Directory `path` entries are resolved relative to — normally
 * `dirname(configPath)`, passed separately so callers that already parsed the config once don't
 * need to re-derive it. */
export function resolveContentSource(entry: RegistryEntry, configDir: string): RepoContentSource {
  if (entry.gitRepoUrl) {
    const {owner, repo} = parseGitHubRepoUrl(entry.gitRepoUrl);
    return createGitHubApiContentSource({
      owner,
      repo,
      ref: entry.ref,
      token: resolveEntryToken(entry)
    });
  }
  if (!entry.path) {
    throw new Error(
      'Registry entry has neither "gitRepoUrl" nor "path" (should be unreachable after validation)'
    );
  }
  return createDiskContentSource(resolve(configDir, entry.path));
}

/** Syncs every repo in `config` — network/disk reads run concurrently (`Promise.all`), matching
 * the full-resync-per-repo model (Decision 6b) applied across the whole registry rather than
 * just within one repo. One entry failing rejects the whole call; callers that want
 * per-repo isolation should catch around individual `readRepoContentOnce`/`resolveContentSource`
 * calls themselves instead of using this convenience function. */
export async function syncRegistry(
  config: RegistryConfig,
  configDir: string
): Promise<RegistrySyncResult[]> {
  return Promise.all(
    config.repos.map(async entry => {
      const identity = resolveRegistryEntryIdentity(entry);
      const source = resolveContentSource(entry, configDir);
      const content = await readRepoContentOnce(source, identity);
      return {entry, identity, content};
    })
  );
}

/** Convenience wrapper: load `spec-hub.config.yaml` at `configPath` and sync every repo it
 * lists in one call. */
export async function loadAndSyncRegistry(configPath: string): Promise<RegistrySyncResult[]> {
  const config = loadRegistryConfig(configPath);
  return syncRegistry(config, dirname(configPath));
}
