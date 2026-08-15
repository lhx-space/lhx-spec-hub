#!/usr/bin/env node
/**
 * Local/manual verification for tasks.md task 5.3 — actually runs `rspress build` against the
 * real `yjs-docs` repo (README + `openspec/` content) synced through `@luhanxin/spec-hub-core`,
 * using this plugin, and checks the generated HTML output contains the expected namespaced
 * routes (capability page, archived-change page, repo index page, homepage).
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
const yjsDocsRepoRootDir = join(packageDir, '../../../yjs-docs');
const verifyDir = join(packageDir, '.verify-tmp');

async function main() {
  if (!existsSync(join(yjsDocsRepoRootDir, 'openspec'))) {
    console.error(`yjs-docs not found as a sibling directory (expected at ${yjsDocsRepoRootDir}).`);
    console.error(
      'This script assumes the same layout as packages/core/scripts/verify-against-yjs-docs.ts.'
    );
    process.exit(1);
  }

  const identity = {org: 'lhx-space', repo: 'yjs-docs'};
  const source = createDiskContentSource(yjsDocsRepoRootDir);
  const content = await readRepoContentOnce(source, identity);
  console.log(
    `Synced ${content.capabilities.length} capabilities, ${content.archivedChanges.length} archived changes, ` +
      `readme: ${content.readme ? 'yes' : 'no'} from yjs-docs.`
  );

  const registrySyncResult = {
    entry: {gitRepoUrl: 'https://github.com/lhx-space/yjs-docs'},
    identity,
    content
  };

  rmSync(verifyDir, {recursive: true, force: true});
  mkdirSync(join(verifyDir, 'docs'), {recursive: true});
  writeFileSync(join(verifyDir, 'docs', 'index.md'), '# Spec Hub verify build\n');
  writeFileSync(join(verifyDir, 'registry-sync-result.json'), JSON.stringify([registrySyncResult]));
  writeFileSync(
    join(verifyDir, 'rspress.config.ts'),
    [
      "import {defineConfig} from 'rspress/config';",
      "import {readFileSync} from 'node:fs';",
      "import {specHubRspressPlugin} from '@luhanxin/spec-hub-rspress-plugin';",
      '',
      "const repos = JSON.parse(readFileSync(new URL('./registry-sync-result.json', import.meta.url), 'utf-8'));",
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

  const sampleCapability = content.capabilities[0];
  if (!sampleCapability) {
    throw new Error('yjs-docs fixture produced zero capabilities — nothing to verify.');
  }
  const sampleChange = content.archivedChanges[0];

  const expectedFiles = [
    join(verifyDir, 'doc_build', 'index.html'),
    join(verifyDir, 'doc_build', 'lhx-space', 'yjs-docs.html'),
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

  console.log('\nrspress build succeeded and generated the expected namespaced routes.');
  rmSync(verifyDir, {recursive: true, force: true});
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
