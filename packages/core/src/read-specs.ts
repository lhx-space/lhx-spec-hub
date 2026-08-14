import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

/**
 * Lists capability slugs under `specs/` — i.e. `specs/<capability>/spec.md`. A subdirectory
 * without a `spec.md` inside it is not a capability and is silently skipped rather than treated
 * as an error, since `openspec/specs/` is not exclusively owned by this package.
 */
export function readCapabilitySlugs(specsDir: string): string[] {
  if (!existsSync(specsDir)) return [];
  return readdirSync(specsDir, {withFileTypes: true})
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(slug => existsSync(join(specsDir, slug, 'spec.md')))
    .sort();
}

/** Reads `specs/<slug>/spec.md` verbatim — no parsing, see spec-sync-engine spec.md "原始
 * Markdown 保真". */
export function readCapabilitySpecMarkdown(specsDir: string, slug: string): string {
  return readFileSync(join(specsDir, slug, 'spec.md'), 'utf-8');
}
