import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {ArchivedChangeDirRef, ArchivedChangeFileName, RepoContentSource} from './types';

/** `<archivedDate>-<slug>`, e.g. `2026-08-15-error-monitor-network-support`. Matches the naming
 * convention used by `openspec archive` across every OpenSpec-adopting repo checked so far
 * (`yjs-docs`). */
const ARCHIVE_DIR_PATTERN = /^(\d{4}-\d{2}-\d{2})-(.+)$/;

/**
 * The default, and today the *only*, `RepoContentSource` implementation — reads an
 * already-checked-out `openspec/` directory from local disk. Whatever puts that directory on
 * disk (a fresh `git clone`, a sparse-checkout, some future ingest pipeline) is entirely outside
 * this class's concern; `spec-hub-core`'s normalization logic (`associate.ts`/`sync.ts`) is
 * unaware this adapter even exists — it only ever talks to `RepoContentSource` (design.md
 * Decision 7). A future git-clone-to-tempdir / GitHub API / isomorphic-git adapter is a
 * completely separate class implementing the same interface, requiring zero changes here.
 */
export class DiskContentSource implements RepoContentSource {
  constructor(private readonly openspecDir: string) {}

  private get specsDir(): string {
    return join(this.openspecDir, 'specs');
  }

  private get archiveDir(): string {
    return join(this.openspecDir, 'changes', 'archive');
  }

  async listCapabilitySlugs(): Promise<string[]> {
    if (!existsSync(this.specsDir)) return [];
    return readdirSync(this.specsDir, {withFileTypes: true})
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .filter(slug => existsSync(join(this.specsDir, slug, 'spec.md')))
      .sort();
  }

  async readCapabilitySpec(slug: string): Promise<string> {
    return readFileSync(join(this.specsDir, slug, 'spec.md'), 'utf-8');
  }

  async listArchivedChangeDirs(): Promise<ArchivedChangeDirRef[]> {
    if (!existsSync(this.archiveDir)) return [];
    return readdirSync(this.archiveDir, {withFileTypes: true})
      .filter(entry => entry.isDirectory())
      .map(entry => {
        const match = ARCHIVE_DIR_PATTERN.exec(entry.name);
        return match ? {dirName: entry.name, archivedDate: match[1], slug: match[2]} : null;
      })
      .filter((parsed): parsed is ArchivedChangeDirRef => parsed !== null)
      .sort((a, b) => a.dirName.localeCompare(b.dirName));
  }

  async readArchivedChangeFile(
    dirName: string,
    fileName: ArchivedChangeFileName
  ): Promise<string | undefined> {
    const filePath = join(this.archiveDir, dirName, fileName);
    return existsSync(filePath) ? readFileSync(filePath, 'utf-8') : undefined;
  }

  async listTouchedCapabilities(dirName: string): Promise<string[]> {
    const changeSpecsDir = join(this.archiveDir, dirName, 'specs');
    if (!existsSync(changeSpecsDir)) return [];
    return readdirSync(changeSpecsDir, {withFileTypes: true})
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort();
  }
}

export function createDiskContentSource(openspecDir: string): RepoContentSource {
  return new DiskContentSource(openspecDir);
}
