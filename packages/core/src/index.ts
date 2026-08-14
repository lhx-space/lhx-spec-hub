/**
 * @luhanxin/spec-hub-core — framework-agnostic sync/normalization engine.
 *
 * Reads a registered repo's `openspec/` subtree from a local filesystem path (no network/git
 * access — see `ReadLocalRepoInput`) and normalizes it into a `RepoContent` tree that the
 * rspress/vitepress plugin adapters can render without needing to understand OpenSpec's on-disk
 * layout themselves. See openspec/changes/cross-repo-spec-aggregation/design.md Decision 6.
 */

export {readRepoContentOnce, SyncedRepoStore} from './sync';
export type {
  ArchivedChange,
  ArchivedChangeRef,
  CapabilitySpec,
  ReadLocalRepoInput,
  RepoContent,
  RepoIdentity
} from './types';
