import {join} from 'node:path';
import {computeRelatedChanges} from './associate';
import {listArchivedChangeDirs, readArchivedChange} from './read-archive';
import {readCapabilitySlugs, readCapabilitySpecMarkdown} from './read-specs';
import type {ReadLocalRepoInput, RepoContent, RepoIdentity} from './types';

/** One full, synchronous read of `input.openspecDir` into a `RepoContent`. Pure — throws on any
 * filesystem error, does not know about (and must not know about) any previously synced content;
 * that concern belongs to `SyncedRepoStore` below. Every call fully re-reads `specs/` and
 * `changes/archive/` from scratch — no incremental diffing (design.md Decision 6b). */
export function readRepoContentOnce(input: ReadLocalRepoInput): RepoContent {
  const specsDir = join(input.openspecDir, 'specs');
  const archiveDir = join(input.openspecDir, 'changes', 'archive');

  const archivedChanges = listArchivedChangeDirs(archiveDir).map(parsed =>
    readArchivedChange(archiveDir, parsed)
  );

  const capabilities = readCapabilitySlugs(specsDir).map(slug => ({
    slug,
    specMarkdown: readCapabilitySpecMarkdown(specsDir, slug),
    relatedChanges: computeRelatedChanges(slug, archivedChanges)
  }));

  return {
    org: input.identity.org,
    repo: input.identity.repo,
    capabilities,
    archivedChanges
  };
}

function repoKey(identity: RepoIdentity): string {
  return `${identity.org}/${identity.repo}`;
}

/**
 * Holds the last successfully synced `RepoContent` per repo. `sync()` fully replaces whatever
 * was previously stored — but only on success: if `readRepoContentOnce` throws, the previous
 * entry is left untouched and the error propagates to the caller unchanged (spec-sync-engine
 * spec.md "同步失败不清空已有内容": a failed sync must surface as a clear failure, not be
 * silently swallowed into "nothing happened, old content is still there" — callers that want the
 * old content back explicitly call `getLastSynced`).
 */
export class SyncedRepoStore {
  private readonly lastGood = new Map<string, RepoContent>();

  sync(input: ReadLocalRepoInput): RepoContent {
    const content = readRepoContentOnce(input);
    this.lastGood.set(repoKey(input.identity), content);
    return content;
  }

  getLastSynced(identity: RepoIdentity): RepoContent | undefined {
    return this.lastGood.get(repoKey(identity));
  }
}
