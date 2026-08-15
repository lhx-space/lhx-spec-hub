/**
 * @luhanxin/spec-hub-core — framework-agnostic sync/normalization engine.
 *
 * Normalizes a registered repo's `openspec/` content — read through the `RepoContentSource`
 * protocol (disk today; git-clone/GitHub-API/isomorphic-git adapters are future, separate
 * implementations, see design.md Decision 7) — into a `RepoContent` tree that the
 * rspress/vitepress plugin adapters can render without needing to understand OpenSpec's on-disk
 * layout, or how bytes got onto disk in the first place.
 */

export {createDiskContentSource, DiskContentSource} from './disk-source';
export {readRepoContentOnce, SyncedRepoStore} from './sync';
export type {
  ArchivedChange,
  ArchivedChangeDirRef,
  ArchivedChangeFileName,
  ArchivedChangeRef,
  CapabilitySpec,
  RepoContent,
  RepoContentSource,
  RepoIdentity
} from './types';
