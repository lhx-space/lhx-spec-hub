/**
 * @luhanxin/spec-hub-core — framework-agnostic sync/normalization engine.
 *
 * Normalizes registered repos' `openspec/` + `README*` content — read through the
 * `RepoContentSource` protocol (disk or GitHub API today; git-clone/isomorphic-git adapters are
 * still hypothetical, see design.md Decision 7) — into `RepoContent` trees that the
 * rspress/vitepress plugin adapters can render without needing to understand OpenSpec's on-disk
 * layout, or how bytes got here in the first place.
 *
 * `registry.ts` is the config.yaml-driven entry point most consumers actually want
 * (`loadAndSyncRegistry`); `query.ts` is the read layer over the resulting `RepoContent[]` meant
 * for non-rendering consumers (e.g. a future RAG ingestion pipeline).
 */

export {createDiskContentSource, DiskContentSource} from './disk-source';
export type {GitHubApiContentSourceOptions} from './github-source';
export {
  createGitHubApiContentSource,
  GitHubApiContentSource,
  parseGitHubRepoUrl
} from './github-source';
export type {
  ArchivedChangeQueryFilter,
  CapabilityQueryFilter,
  QueriedArchivedChange,
  QueriedCapability
} from './query';
export {
  getArchivedChange,
  getCapability,
  getRepoContent,
  listArchivedChanges,
  listCapabilities
} from './query';
export type {
  RegistryConfig,
  RegistryEntry,
  RegistrySyncResult,
  SyncProgressEvent,
  SyncRegistryOptions
} from './registry';
export {
  loadAndSyncRegistry,
  loadRegistryConfig,
  resolveContentSource,
  resolveRegistryEntryIdentity,
  syncRegistry
} from './registry';
export {summarizeReadme} from './summary';
export {readRepoContentOnce, SyncedRepoStore} from './sync';
export type {
  ArchivedChange,
  ArchivedChangeDirRef,
  ArchivedChangeFileName,
  ArchivedChangeRef,
  CapabilityDelta,
  CapabilitySpec,
  RepoContent,
  RepoContentSource,
  RepoIdentity
} from './types';
