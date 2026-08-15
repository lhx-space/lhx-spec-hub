/**
 * Manual/local-only verification for tasks.md 4.1 — NOT a `vitest` test, deliberately: it
 * depends on the real `yjs-docs` repo being cloned as a sibling directory, which CI cannot rely
 * on. Run with `pnpm verify:yjs-docs` and eyeball the printed counts against the real repo
 * (currently: 24 capability specs, ~20 archived changes — see the conversation that produced
 * design.md Decision 6/6b). Uses `createDiskContentSource` — the same `RepoContentSource`
 * adapter used everywhere else — deliberately, to exercise the real code path rather than a
 * one-off shortcut.
 */
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {createDiskContentSource} from '../src/disk-source';
import {readRepoContentOnce} from '../src/sync';

const openspecDir = join(import.meta.dirname, '../../../../yjs-docs/openspec');

if (!existsSync(openspecDir)) {
  console.error(
    `yjs-docs/openspec not found at ${openspecDir} — skipping (this script only works when ` +
      'yjs-docs is cloned as a sibling directory of lhx-spec-hub).'
  );
  process.exit(0);
}

const content = await readRepoContentOnce(createDiskContentSource(openspecDir), {
  org: 'lhx-space',
  repo: 'yjs-docs'
});

console.log(`capabilities: ${content.capabilities.length}`);
console.log(`archivedChanges: ${content.archivedChanges.length}`);
console.log();
console.log('capabilities with related changes:');
for (const capability of content.capabilities) {
  console.log(`  ${capability.slug} — ${capability.relatedChanges.length} related change(s)`);
}
console.log();
console.log('capabilities with NO related changes (worth eyeballing — expected for some):');
for (const capability of content.capabilities.filter(c => c.relatedChanges.length === 0)) {
  console.log(`  ${capability.slug}`);
}
