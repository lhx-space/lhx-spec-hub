import type {ArchivedChange, CapabilitySpec, RepoContent, RepoIdentity} from './types';

/**
 * A read-only query layer over already-synced `RepoContent[]` (design.md Decision 9) — meant to
 * be the one place a future RAG ingestion pipeline (or anything else that wants "give me the
 * specs" without caring about routing/rendering) reaches into, instead of writing its own
 * ad-hoc filtering over the raw `RepoContent[]` shape every time. Pure functions, no I/O — the
 * caller is responsible for having already produced `repos` via `syncRegistry`/
 * `readRepoContentOnce`.
 */

export interface CapabilityQueryFilter {
  org?: string;
  repo?: string;
  /** Matched against the capability `slug` — a plain string is an exact match, a `RegExp` tests
   * with `.test()`. */
  slug?: string | RegExp;
}

export interface QueriedCapability extends CapabilitySpec, RepoIdentity {}

export interface ArchivedChangeQueryFilter {
  org?: string;
  repo?: string;
  slug?: string | RegExp;
}

export interface QueriedArchivedChange extends ArchivedChange, RepoIdentity {}

function matchesSlug(slug: string, filter?: string | RegExp): boolean {
  if (filter === undefined) return true;
  return typeof filter === 'string' ? slug === filter : filter.test(slug);
}

/** Every capability across every repo in `repos`, each annotated with which repo it came from —
 * flattening `RepoContent[]` into one filterable list is the whole point (a RAG ingestion script
 * wants "every capability whose org is X", not "for each repo, if repo.org === X, then for each
 * capability...", every time it needs this). */
export function listCapabilities(
  repos: RepoContent[],
  filter: CapabilityQueryFilter = {}
): QueriedCapability[] {
  return repos
    .filter(repo => (filter.org ? repo.org === filter.org : true))
    .filter(repo => (filter.repo ? repo.repo === filter.repo : true))
    .flatMap(repo =>
      repo.capabilities
        .filter(capability => matchesSlug(capability.slug, filter.slug))
        .map(capability => ({...capability, org: repo.org, repo: repo.repo}))
    );
}

/** Every archived change across every repo in `repos`, same flattening rationale as
 * `listCapabilities`. */
export function listArchivedChanges(
  repos: RepoContent[],
  filter: ArchivedChangeQueryFilter = {}
): QueriedArchivedChange[] {
  return repos
    .filter(repo => (filter.org ? repo.org === filter.org : true))
    .filter(repo => (filter.repo ? repo.repo === filter.repo : true))
    .flatMap(repo =>
      repo.archivedChanges
        .filter(change => matchesSlug(change.slug, filter.slug))
        .map(change => ({...change, org: repo.org, repo: repo.repo}))
    );
}

/** The full `RepoContent` for one repo, or `undefined` if `identity` isn't in `repos`. */
export function getRepoContent(
  repos: RepoContent[],
  identity: RepoIdentity
): RepoContent | undefined {
  return repos.find(repo => repo.org === identity.org && repo.repo === identity.repo);
}

/** One capability, by its exact slug, within one specific repo — the "single ID within a single
 * project" lookup. `undefined` if the repo or the capability isn't found. */
export function getCapability(
  repos: RepoContent[],
  identity: RepoIdentity,
  slug: string
): CapabilitySpec | undefined {
  return getRepoContent(repos, identity)?.capabilities.find(capability => capability.slug === slug);
}

/** One archived change, by its exact slug, within one specific repo. */
export function getArchivedChange(
  repos: RepoContent[],
  identity: RepoIdentity,
  slug: string
): ArchivedChange | undefined {
  return getRepoContent(repos, identity)?.archivedChanges.find(change => change.slug === slug);
}
