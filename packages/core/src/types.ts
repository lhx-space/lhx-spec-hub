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
   * `readArchivedChange` in `read-archive.ts`, which throws if it's missing. */
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

/** Input for reading a repo's `openspec/` content from a local filesystem path. No network/git
 * access is performed by this package — how bytes get onto local disk (a fresh clone, a
 * sparse-checkout, a registration/webhook pipeline...) is entirely out of scope here (see
 * design.md Open Questions: registration protocol / push-trigger payload are separate,
 * not-yet-designed concerns). */
export interface ReadLocalRepoInput {
  /** Absolute path to the repo's `openspec/` directory (not the repo root). */
  openspecDir: string;
  identity: RepoIdentity;
}
