#!/usr/bin/env node
/**
 * Local/manual verification for tasks.md task 5.3 — actually runs `rspress build` against the
 * real `yjs-docs` `openspec/` content synced through `@luhanxin/spec-hub-core`, using this
 * plugin, and checks the generated HTML output contains the expected namespaced routes.
 *
 * Not part of CI (assumes `yjs-docs` is checked out as a sibling directory, like
 * `packages/core/scripts/verify-against-yjs-docs.ts`) — run manually via
 * `pnpm verify:build`. Requires `pnpm build` (this package + `@luhanxin/spec-hub-core`) to have
 * already run, since it imports the built `dist/` output the same way a real consumer would.
 */
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createDiskContentSource, readRepoContentOnce} from '@luhanxin/spec-hub-core';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const yjsDocsOpenspecDir = join(packageDir, '../../../yjs-docs/openspec');
const verifyDir = join(packageDir, '.verify-tmp');

async function main() {
  if (!existsSync(yjsDocsOpenspecDir)) {
    console.error(`yjs-docs not found as a sibling directory (expected at ${yjsDocsOpenspecDir}).`);
    console.error(
      'This script assumes the same layout as packages/core/scripts/verify-against-yjs-docs.ts.'
    );
    process.exit(1);
  }

  const source = createDiskContentSource(yjsDocsOpenspecDir);
  const repoContent = await readRepoContentOnce(source, {org: 'lhx-space', repo: 'yjs-docs'});
  console.log(
    `Synced ${repoContent.capabilities.length} capabilities, ${repoContent.archivedChanges.length} archived changes from yjs-docs.`
  );

  rmSync(verifyDir, {recursive: true, force: true});
  mkdirSync(join(verifyDir, 'docs'), {recursive: true});
  writeFileSync(join(verifyDir, 'docs', 'index.md'), '# Spec Hub verify build\n');
  writeFileSync(join(verifyDir, 'repo-content.json'), JSON.stringify([repoContent]));
  writeFileSync(
    join(verifyDir, 'rspress.config.ts'),
    [
      "import {defineConfig} from 'rspress/config';",
      "import {readFileSync} from 'node:fs';",
      "import {specHubRspressPlugin} from '@luhanxin/spec-hub-rspress-plugin';",
      '',
      "const repos = JSON.parse(readFileSync(new URL('./repo-content.json', import.meta.url), 'utf-8'));",
      '',
      'export default defineConfig({',
      "  root: 'docs',",
      '  plugins: [specHubRspressPlugin({repos})]',
      '});',
      ''
    ].join('\n')
  );

  console.log('Running `rspress build`...');
  execFileSync(join(packageDir, 'node_modules/.bin/rspress'), ['build'], {
    cwd: verifyDir,
    stdio: 'inherit'
  });

  const sampleCapability = repoContent.capabilities[0];
  if (!sampleCapability) {
    throw new Error('yjs-docs fixture produced zero capabilities — nothing to verify.');
  }
  const sampleChange = repoContent.archivedChanges[0];

  const expectedFiles = [
    join(verifyDir, 'doc_build', 'lhx-space', 'yjs-docs', 'specs', `${sampleCapability.slug}.html`),
    ...(sampleChange
      ? [
          join(
            verifyDir,
            'doc_build',
            'lhx-space',
            'yjs-docs',
            'changes',
            `${sampleChange.slug}.html`
          )
        ]
      : [])
  ];

  for (const file of expectedFiles) {
    if (!existsSync(file)) {
      throw new Error(`Expected generated file missing: ${file}`);
    }
    console.log(`OK — found ${file}`);
  }

  console.log(`\nrspress build succeeded and generated the expected namespaced routes.`);
  rmSync(verifyDir, {recursive: true, force: true});
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
