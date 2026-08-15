import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

/**
 * Builds a minimal, throwaway repo checkout on disk for unit tests — a `repoRootDir` containing
 * `openspec/**` and (optionally) `README.md`/`README.zh-CN.md` at its root, matching what
 * `DiskContentSource` now expects (design.md Decision 8 moved the source's root from
 * `openspec/` up to the repo root, so it can also reach the READMEs). Deliberately not the real
 * `yjs-docs` fixture (that's `scripts/verify-against-yjs-docs.ts`, a manual/local-only
 * verification step, not something CI should depend on a sibling repo existing for). Callers
 * must call the returned `cleanup()` once done.
 */
export interface TempOpenspecFixture {
  repoRootDir: string;
  openspecDir: string;
  cleanup: () => void;
}

export function createTempOpenspecFixture(): TempOpenspecFixture {
  const root = mkdtempSync(join(tmpdir(), 'spec-hub-core-test-'));
  return {
    repoRootDir: root,
    openspecDir: join(root, 'openspec'),
    cleanup: () => rmSync(root, {recursive: true, force: true})
  };
}

export function writeCapabilitySpec(openspecDir: string, slug: string, markdown: string): void {
  const dir = join(openspecDir, 'specs', slug);
  mkdirSync(dir, {recursive: true});
  writeFileSync(join(dir, 'spec.md'), markdown, 'utf-8');
}

export function writeReadme(repoRootDir: string, markdown: string): void {
  mkdirSync(repoRootDir, {recursive: true});
  writeFileSync(join(repoRootDir, 'README.md'), markdown, 'utf-8');
}

export function writeReadmeZhCN(repoRootDir: string, markdown: string): void {
  mkdirSync(repoRootDir, {recursive: true});
  writeFileSync(join(repoRootDir, 'README.zh-CN.md'), markdown, 'utf-8');
}

/** Shared shape consumed by both `writeArchivedChange` (disk) and `createFakeContentSource`
 * (in-memory) — see sync.test.ts, which builds the exact same fixture data for both adapters. */
export interface ArchivedChangeFixture {
  archivedDate: string;
  slug: string;
  proposalMarkdown?: string;
  /** Set `true` to make `proposal.md` absent entirely — for testing the "missing proposal.md"
   * failure scenario. By default a placeholder `proposal.md` is always present, so most
   * fixtures don't need to think about this. */
  omitProposal?: boolean;
  designMarkdown?: string;
  tasksMarkdown?: string;
  /** Capability slugs to create empty `specs/<slug>/` delta directories for. */
  touchedCapabilities?: string[];
}

/** The one rule both adapters follow for `proposal.md`'s content: absent when `omitProposal`,
 * otherwise `proposalMarkdown` or a placeholder — kept in one place so the disk writer and the
 * fake source can't drift apart on this. */
export function resolveProposalMarkdown(change: ArchivedChangeFixture): string | undefined {
  if (change.omitProposal) return undefined;
  return change.proposalMarkdown ?? `# ${change.slug}\n`;
}

export function writeArchivedChange(openspecDir: string, change: ArchivedChangeFixture): void {
  const dir = join(openspecDir, 'changes', 'archive', `${change.archivedDate}-${change.slug}`);
  mkdirSync(dir, {recursive: true});
  const proposalMarkdown = resolveProposalMarkdown(change);
  if (proposalMarkdown !== undefined) {
    writeFileSync(join(dir, 'proposal.md'), proposalMarkdown, 'utf-8');
  }
  if (change.designMarkdown !== undefined) {
    writeFileSync(join(dir, 'design.md'), change.designMarkdown, 'utf-8');
  }
  if (change.tasksMarkdown !== undefined) {
    writeFileSync(join(dir, 'tasks.md'), change.tasksMarkdown, 'utf-8');
  }
  for (const capabilitySlug of change.touchedCapabilities ?? []) {
    const capabilityDeltaDir = join(dir, 'specs', capabilitySlug);
    mkdirSync(capabilityDeltaDir, {recursive: true});
    writeFileSync(join(capabilityDeltaDir, 'spec.md'), '## ADDED Requirements\n', 'utf-8');
  }
}

/** Creates an active, not-yet-archived `changes/<name>/` directory — used to assert it's
 * correctly excluded from the synced content tree. Disk-only concept: the `RepoContentSource`
 * protocol has no method that could even expose one, by design (see disk-source.test.ts
 * "DiskContentSource-specific behavior"). */
export function writeActiveChange(openspecDir: string, name: string): void {
  const dir = join(openspecDir, 'changes', name);
  mkdirSync(dir, {recursive: true});
  writeFileSync(join(dir, 'proposal.md'), `# ${name}\n`, 'utf-8');
}
