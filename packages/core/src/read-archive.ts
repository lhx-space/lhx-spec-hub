import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {ArchivedChange} from './types';

/** `<archivedDate>-<slug>`, e.g. `2026-08-15-error-monitor-network-support`. Matches the naming
 * convention used by `openspec archive` across every OpenSpec-adopting repo checked so far
 * (`yjs-docs`). */
const ARCHIVE_DIR_PATTERN = /^(\d{4}-\d{2}-\d{2})-(.+)$/;

interface ParsedArchiveDirName {
  dirName: string;
  archivedDate: string;
  slug: string;
}

/** Lists and parses every `changes/archive/<archivedDate>-<slug>/` directory. A directory whose
 * name doesn't match the expected pattern is skipped rather than erroring — being defensive
 * against `changes/archive/` containing something this package doesn't recognize (e.g. a
 * README) is cheaper than failing an entire sync over it. */
export function listArchivedChangeDirs(archiveDir: string): ParsedArchiveDirName[] {
  if (!existsSync(archiveDir)) return [];
  return readdirSync(archiveDir, {withFileTypes: true})
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const match = ARCHIVE_DIR_PATTERN.exec(entry.name);
      return match ? {dirName: entry.name, archivedDate: match[1], slug: match[2]} : null;
    })
    .filter((parsed): parsed is ParsedArchiveDirName => parsed !== null)
    .sort((a, b) => a.dirName.localeCompare(b.dirName));
}

/** Reads one archived change directory into an `ArchivedChange`. `proposal.md` is required —
 * every change that made it through the OpenSpec workflow to archival must have had one; a
 * missing `proposal.md` indicates a malformed archive, so this throws rather than silently
 * defaulting to an empty string (see spec-sync-engine spec.md "同步失败不清空已有内容": the
 * *caller* (`sync.ts`) is responsible for turning this throw into "keep the previous good
 * content tree", this function itself does not know about — nor should it — any previous sync). */
export function readArchivedChange(
  archiveDir: string,
  parsed: ParsedArchiveDirName
): ArchivedChange {
  const dir = join(archiveDir, parsed.dirName);
  const proposalPath = join(dir, 'proposal.md');
  const designPath = join(dir, 'design.md');
  const tasksPath = join(dir, 'tasks.md');

  if (!existsSync(proposalPath)) {
    throw new Error(`Malformed archived change "${parsed.dirName}": missing proposal.md`);
  }

  return {
    slug: parsed.slug,
    archivedDate: parsed.archivedDate,
    proposalMarkdown: readFileSync(proposalPath, 'utf-8'),
    designMarkdown: existsSync(designPath) ? readFileSync(designPath, 'utf-8') : undefined,
    tasksMarkdown: existsSync(tasksPath) ? readFileSync(tasksPath, 'utf-8') : undefined,
    touchedCapabilities: listTouchedCapabilities(join(dir, 'specs'))
  };
}

function listTouchedCapabilities(changeSpecsDir: string): string[] {
  if (!existsSync(changeSpecsDir)) return [];
  return readdirSync(changeSpecsDir, {withFileTypes: true})
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
}
