/**
 * Data model produced by `@luhanxin/spec-hub-core`, per design.md Decision 6 of the
 * `cross-repo-spec-aggregation` change. Every registered repo's `openspec/` subtree is
 * normalized into exactly two collections — `capabilities` (from `specs/`) and
 * `archivedChanges` (from `changes/archive/`). Active, not-yet-archived `changes/<name>/`
 * directories are never represented here (see spec-sync-engine spec.md).
 */

/** Namespace identity used to keep two different repos' same-named capabilities from colliding
 * (design.md Decision 5) — consumed by `docs-site-plugins` when generating routes, not
 * interpreted by this package itself. */
export interface RepoIdentity {
  org: string;
  repo: string;
}

/** A lightweight reference to an archived change, as attached to a `CapabilitySpec`. Only the
 * fields needed to link to/sort the full `ArchivedChange` — not a copy of its content. */
export interface ArchivedChangeRef {
  slug: string;
  /** `YYYY-MM-DD`, parsed from the archive directory name. */
  archivedDate: string;
}

/** Parsed `changes/archive/<archivedDate>-<slug>/` directory name — part of the
 * `RepoContentSource` protocol's surface (see Decision 7), not just an internal detail of the
 * disk adapter. */
export interface ArchivedChangeDirRef {
  dirName: string;
  archivedDate: string;
  slug: string;
}

/** The three files an archived change directory may contain. `proposal.md` is expected by every
 * properly-archived change (see `readRepoContentOnce` in `sync.ts`, which throws if a source
 * reports it as missing); `design.md`/`tasks.md` are optional. */
export type ArchivedChangeFileName = 'proposal.md' | 'design.md' | 'tasks.md';

export interface CapabilitySpec {
  /** Directory name under `specs/`, e.g. `error-monitor`. */
  slug: string;
  /** Verbatim contents of `specs/<slug>/spec.md` — byte-for-byte, no parsing/transformation
   * (spec-sync-engine spec.md, "原始 Markdown 保真"). */
  specMarkdown: string;
  /** Archived changes whose own `specs/<slug>/` delta directory exists, ordered by
   * `archivedDate` ascending (oldest first — reads as a chronological history). Empty array,
   * never omitted, when no archived change touched this capability. */
  relatedChanges: ArchivedChangeRef[];
}

export interface ArchivedChange {
  /** Parsed from the archive directory name `<archivedDate>-<slug>`. */
  slug: string;
  archivedDate: string;
  /** Verbatim contents of `proposal.md`. Every archived change is expected to have one — see
   * `readRepoContentOnce` in `sync.ts`, which throws if a source reports it missing. */
  proposalMarkdown: string;
  /** Verbatim contents of `design.md`, if present (not every change has a design doc). */
  designMarkdown?: string;
  /** Verbatim contents of `tasks.md`, if present. */
  tasksMarkdown?: string;
  /** Capability slugs whose `specs/<slug>/` delta directory exists under this change. */
  touchedCapabilities: string[];
}

export interface RepoContent extends RepoIdentity {
  capabilities: CapabilitySpec[];
  archivedChanges: ArchivedChange[];
}

/**
 * The protocol every "how do bytes get here" adapter implements — disk (the only adapter this
 * package ships, see `disk-source.ts`), and later a git-clone-to-tempdir adapter / GitHub API
 * in-memory adapter / isomorphic-git adapter, none of which are built yet. `associate.ts` and
 * `sync.ts` — the normalization logic that produces `RepoContent` — talk to this interface
 * exclusively; they have no idea whether the bytes came from disk, a network call, or were
 * fabricated in a test (see `tests/fake-source.ts`, and design.md Decision 7).
 *
 * Deliberately minimal and read-only — this is not a general-purpose virtual filesystem, only
 * exactly the handful of operations `spec-sync-engine` actually needs.
 */
export interface RepoContentSource {
  /** Capability slugs under `specs/` that have a `spec.md` — a subdirectory without one is not
   * a capability. */
  listCapabilitySlugs(): Promise<string[]>;
  /** Verbatim `specs/<slug>/spec.md` contents. */
  readCapabilitySpec(slug: string): Promise<string>;
  /** Parsed `changes/archive/<archivedDate>-<slug>/` directory names. */
  listArchivedChangeDirs(): Promise<ArchivedChangeDirRef[]>;
  /** Verbatim contents of `changes/archive/<dirName>/<fileName>`; `undefined` if that file
   * doesn't exist for that change. The source only reports presence/absence — deciding that a
   * missing `proposal.md` is an error is `sync.ts`'s job, not the source's. */
  readArchivedChangeFile(
    dirName: string,
    fileName: ArchivedChangeFileName
  ): Promise<string | undefined>;
  /** Capability slugs touched by `changes/archive/<dirName>/specs/<slug>/`. */
  listTouchedCapabilities(dirName: string): Promise<string[]>;
}
