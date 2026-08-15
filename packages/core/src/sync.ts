import {computeRelatedChanges} from './associate';
import type {ArchivedChange, RepoContent, RepoContentSource, RepoIdentity} from './types';

/**
 * One full, asynchronous read of `source` into a `RepoContent`. Pure — throws on any error the
 * source surfaces (or on a missing required `proposal.md`, see below), does not know about (and
 * must not know about) any previously synced content; that concern belongs to `SyncedRepoStore`
 * below. Every call fully re-reads from `source` from scratch — no incremental diffing
 * (design.md Decision 6b). Works identically regardless of which `RepoContentSource`
 * implementation `source` is (disk, in-memory fake, or a future git/API adapter — Decision 7).
 */
export async function readRepoContentOnce(
  source: RepoContentSource,
  identity: RepoIdentity
): Promise<RepoContent> {
  const archivedChangeDirs = await source.listArchivedChangeDirs();
  const archivedChanges: ArchivedChange[] = await Promise.all(
    archivedChangeDirs.map(async dirRef => {
      const proposalMarkdown = await source.readArchivedChangeFile(dirRef.dirName, 'proposal.md');
      if (proposalMarkdown === undefined) {
        throw new Error(`Malformed archived change "${dirRef.dirName}": missing proposal.md`);
      }
      const [designMarkdown, tasksMarkdown, touchedCapabilities] = await Promise.all([
        source.readArchivedChangeFile(dirRef.dirName, 'design.md'),
        source.readArchivedChangeFile(dirRef.dirName, 'tasks.md'),
        source.listTouchedCapabilities(dirRef.dirName)
      ]);
      return {
        slug: dirRef.slug,
        archivedDate: dirRef.archivedDate,
        proposalMarkdown,
        designMarkdown,
        tasksMarkdown,
        touchedCapabilities
      };
    })
  );

  const capabilitySlugs = await source.listCapabilitySlugs();
  const capabilities = await Promise.all(
    capabilitySlugs.map(async slug => ({
      slug,
      specMarkdown: await source.readCapabilitySpec(slug),
      relatedChanges: computeRelatedChanges(slug, archivedChanges)
    }))
  );

  return {org: identity.org, repo: identity.repo, capabilities, archivedChanges};
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

  async sync(source: RepoContentSource, identity: RepoIdentity): Promise<RepoContent> {
    const content = await readRepoContentOnce(source, identity);
    this.lastGood.set(repoKey(identity), content);
    return content;
  }

  getLastSynced(identity: RepoIdentity): RepoContent | undefined {
    return this.lastGood.get(repoKey(identity));
  }
}
