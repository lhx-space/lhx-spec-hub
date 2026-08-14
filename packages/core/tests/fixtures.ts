import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

/**
 * Builds a minimal, throwaway `openspec/` directory on disk for unit tests — deliberately not
 * the real `yjs-docs` fixture (that's `scripts/verify-against-yjs-docs.ts`, a manual/local-only
 * verification step, not something CI should depend on a sibling repo existing for). Callers
 * must call the returned `cleanup()` once done.
 */
export interface TempOpenspecFixture {
  openspecDir: string;
  cleanup: () => void;
}

export function createTempOpenspecFixture(): TempOpenspecFixture {
  const root = mkdtempSync(join(tmpdir(), 'spec-hub-core-test-'));
  return {
    openspecDir: root,
    cleanup: () => rmSync(root, {recursive: true, force: true})
  };
}

export function writeCapabilitySpec(openspecDir: string, slug: string, markdown: string): void {
  const dir = join(openspecDir, 'specs', slug);
  mkdirSync(dir, {recursive: true});
  writeFileSync(join(dir, 'spec.md'), markdown, 'utf-8');
}

export interface ArchivedChangeFixture {
  archivedDate: string;
  slug: string;
  proposalMarkdown?: string;
  designMarkdown?: string;
  tasksMarkdown?: string;
  /** Capability slugs to create empty `specs/<slug>/` delta directories for. */
  touchedCapabilities?: string[];
}

export function writeArchivedChange(openspecDir: string, change: ArchivedChangeFixture): void {
  const dir = join(openspecDir, 'changes', 'archive', `${change.archivedDate}-${change.slug}`);
  mkdirSync(dir, {recursive: true});
  writeFileSync(join(dir, 'proposal.md'), change.proposalMarkdown ?? `# ${change.slug}\n`, 'utf-8');
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
 * correctly excluded from the synced content tree. */
export function writeActiveChange(openspecDir: string, name: string): void {
  const dir = join(openspecDir, 'changes', name);
  mkdirSync(dir, {recursive: true});
  writeFileSync(join(dir, 'proposal.md'), `# ${name}\n`, 'utf-8');
}
