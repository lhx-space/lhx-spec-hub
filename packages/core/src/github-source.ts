import type {
  ArchivedChangeDirRef,
  ArchivedChangeFileName,
  CapabilityDelta,
  RepoContentSource
} from './types';

/** `<archivedDate>-<slug>`, e.g. `2026-08-15-error-monitor-network-support`. */
const ARCHIVE_DIR_PATTERN = /^(\d{4}-\d{2}-\d{2})-(.+)$/;

export interface GitHubApiContentSourceOptions {
  owner: string;
  repo: string;
  /** Branch/tag/commit SHA to read from. When omitted, the repo's actual default branch is
   * auto-detected via `GET /repos/{owner}/{repo}` (its `default_branch` field) — NOT
   * hardcoded to `main`, since plenty of real repos (including ones checked against this
   * adapter) still default to `master`. One extra API call, made at most once per adapter
   * instance (memoized alongside the tree fetch). */
  ref?: string;
  /** Personal access token, needed for private repos and to raise the (otherwise very low,
   * ~60/hour/IP) unauthenticated GitHub API rate limit. Sent as `Authorization: Bearer <token>`
   * on every request this adapter makes — REST API calls and `raw.githubusercontent.com`
   * fetches alike. */
  token?: string;
}

interface GitTreeEntry {
  path: string;
  type: 'blob' | 'tree' | 'commit';
}

/**
 * Reads a repo directly from GitHub over HTTP, entirely in memory — no `git` binary, no clone,
 * no temp directory (design.md Decision 8, chosen over a git-clone-to-tempdir adapter). Two API
 * surfaces, deliberately kept to a minimum number of round trips:
 *
 *   1. ONE call to the "get a tree recursively" REST endpoint
 *      (`/repos/{owner}/{repo}/git/trees/{ref}?recursive=1`) to learn the *shape* of the whole
 *      repo (every path + whether it's a file or directory) — this is what `listCapabilitySlugs`
 *      / `listArchivedChangeDirs` / `readCapabilityDeltas` read from, cached for the adapter's
 *      lifetime (a fresh adapter instance per sync, matching Decision 6b's full-resync model).
 *   2. One `raw.githubusercontent.com` fetch per file actually read (`readCapabilitySpec` /
 *      `readArchivedChangeFile` / `readReadme*`) — raw content reads are not subject to the
 *      same strict "core" REST rate limit as repeated `contents` API calls would be, so this
 *      stays practical even for a repo with dozens of capabilities/archived changes.
 *
 * Uses the platform `fetch` (Node 18+) — no HTTP client dependency.
 */
export class GitHubApiContentSource implements RepoContentSource {
  private treePromise: Promise<GitTreeEntry[]> | undefined;
  /** Memoized like `treePromise` — only populated (and only ever fetched once) when `ref` isn't
   * explicitly set; see `resolveRef()`. */
  private refPromise: Promise<string> | undefined;

  constructor(private readonly options: GitHubApiContentSourceOptions) {}

  private get specsDir(): string {
    return 'openspec/specs';
  }

  private get archiveDir(): string {
    return 'openspec/changes/archive';
  }

  async listCapabilitySlugs(): Promise<string[]> {
    const tree = await this.getTree();
    const specMdPaths = new Set(
      tree
        .filter(entry => entry.type === 'blob' && entry.path.endsWith('/spec.md'))
        .map(entry => entry.path)
    );
    return [...specMdPaths]
      .map(path => path.slice(this.specsDir.length + 1, -'/spec.md'.length))
      .filter(slug => slug.length > 0 && !slug.includes('/'))
      .sort();
  }

  async readCapabilitySpec(slug: string): Promise<string> {
    return this.fetchRawRequired(`${this.specsDir}/${slug}/spec.md`);
  }

  async listArchivedChangeDirs(): Promise<ArchivedChangeDirRef[]> {
    const tree = await this.getTree();
    const prefix = `${this.archiveDir}/`;
    const dirNames = new Set(
      tree
        .filter(entry => entry.path.startsWith(prefix))
        .map(entry => entry.path.slice(prefix.length).split('/')[0])
        .filter((name): name is string => Boolean(name))
    );
    return [...dirNames]
      .map(dirName => {
        const match = ARCHIVE_DIR_PATTERN.exec(dirName);
        return match ? {dirName, archivedDate: match[1], slug: match[2]} : null;
      })
      .filter((parsed): parsed is ArchivedChangeDirRef => parsed !== null)
      .sort((a, b) => a.dirName.localeCompare(b.dirName));
  }

  async readArchivedChangeFile(
    dirName: string,
    fileName: ArchivedChangeFileName
  ): Promise<string | undefined> {
    return this.fetchRawOptional(`${this.archiveDir}/${dirName}/${fileName}`);
  }

  async readCapabilityDeltas(dirName: string): Promise<CapabilityDelta[]> {
    const tree = await this.getTree();
    const prefix = `${this.archiveDir}/${dirName}/specs/`;
    const specMdPaths = new Set(
      tree
        .filter(
          entry =>
            entry.type === 'blob' &&
            entry.path.startsWith(prefix) &&
            entry.path.endsWith('/spec.md')
        )
        .map(entry => entry.path)
    );
    const slugs = [...specMdPaths]
      .map(path => path.slice(prefix.length, -'/spec.md'.length))
      .filter(slug => slug.length > 0 && !slug.includes('/'))
      .sort();
    return Promise.all(
      slugs.map(async slug => ({
        slug,
        deltaMarkdown: await this.fetchRawRequired(`${prefix}${slug}/spec.md`)
      }))
    );
  }

  async readReadme(): Promise<string | undefined> {
    return this.fetchRawOptional('README.md');
  }

  async readReadmeZhCN(): Promise<string | undefined> {
    return this.fetchRawOptional('README.zh-CN.md');
  }

  private getTree(): Promise<GitTreeEntry[]> {
    if (!this.treePromise) {
      this.treePromise = this.fetchTree();
    }
    return this.treePromise;
  }

  /** `options.ref` if set; otherwise the repo's actual `default_branch`, fetched once and
   * memoized (see the `ref` option's doc comment for why this isn't just hardcoded to `main`). */
  private resolveRef(): Promise<string> {
    if (this.options.ref) return Promise.resolve(this.options.ref);
    if (!this.refPromise) {
      this.refPromise = this.fetchDefaultBranch();
    }
    return this.refPromise;
  }

  private async fetchDefaultBranch(): Promise<string> {
    const {owner, repo} = this.options;
    const url = `https://api.github.com/repos/${owner}/${repo}`;
    const response = await fetch(url, {headers: this.apiHeaders()});
    if (!response.ok) {
      throw new Error(
        `GitHub API error fetching repo info for ${owner}/${repo}: ${response.status} ${response.statusText}`
      );
    }
    const body = (await response.json()) as {default_branch?: string};
    if (!body.default_branch) {
      throw new Error(
        `GitHub API response for ${owner}/${repo} did not include a "default_branch"`
      );
    }
    return body.default_branch;
  }

  private async fetchTree(): Promise<GitTreeEntry[]> {
    const {owner, repo} = this.options;
    const ref = await this.resolveRef();
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
    const response = await fetch(url, {headers: this.apiHeaders()});
    if (!response.ok) {
      throw new Error(
        `GitHub API error fetching tree for ${owner}/${repo}@${ref}: ${response.status} ${response.statusText}`
      );
    }
    const body = (await response.json()) as {tree: GitTreeEntry[]; truncated?: boolean};
    if (body.truncated) {
      throw new Error(
        `GitHub tree for ${owner}/${repo}@${ref} was truncated (repo too large for a single ` +
          'recursive tree call) — GitHubApiContentSource does not yet handle pagination.'
      );
    }
    return body.tree;
  }

  private async fetchRawRequired(path: string): Promise<string> {
    const content = await this.fetchRawOptional(path);
    if (content === undefined) {
      const ref = await this.resolveRef();
      throw new Error(`${this.options.owner}/${this.options.repo}@${ref}: missing ${path}`);
    }
    return content;
  }

  private async fetchRawOptional(path: string): Promise<string | undefined> {
    const {owner, repo} = this.options;
    const ref = await this.resolveRef();
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(ref)}/${path}`;
    const response = await fetch(url, {headers: this.rawHeaders()});
    if (response.status === 404) return undefined;
    if (!response.ok) {
      throw new Error(
        `GitHub raw content error fetching ${owner}/${repo}@${ref}/${path}: ${response.status}`
      );
    }
    return response.text();
  }

  private apiHeaders(): Record<string, string> {
    const headers: Record<string, string> = {Accept: 'application/vnd.github+json'};
    if (this.options.token) headers['Authorization'] = `Bearer ${this.options.token}`;
    return headers;
  }

  private rawHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.options.token) headers['Authorization'] = `Bearer ${this.options.token}`;
    return headers;
  }
}

export function createGitHubApiContentSource(
  options: GitHubApiContentSourceOptions
): RepoContentSource {
  return new GitHubApiContentSource(options);
}

/** Parses `https://github.com/<owner>/<repo>`, `https://github.com/<owner>/<repo>.git`, or
 * `git@github.com:<owner>/<repo>.git` into `{owner, repo}`. Throws on anything else — no silent
 * best-effort guessing. */
export function parseGitHubRepoUrl(url: string): {owner: string; repo: string} {
  const httpsMatch = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(url);
  if (httpsMatch) {
    const [, owner, repo] = httpsMatch;
    if (owner && repo) return {owner, repo};
  }
  const sshMatch = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/.exec(url);
  if (sshMatch) {
    const [, owner, repo] = sshMatch;
    if (owner && repo) return {owner, repo};
  }
  throw new Error(`Not a recognized GitHub repo URL: "${url}"`);
}
