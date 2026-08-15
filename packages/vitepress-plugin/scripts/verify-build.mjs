#!/usr/bin/env node
/**
 * Local/manual verification for tasks.md task 5.3 — actually runs `vitepress build` against the
 * real `yjs-docs` `openspec/` content synced through `@luhanxin/spec-hub-core`, using this
 * package's `writeSpecHubVitepressPages`, and checks the generated HTML output contains the
 * expected namespaced routes.
 *
 * Not part of CI (assumes `yjs-docs` is checked out as a sibling directory) — run manually via
 * `pnpm verify:build`. Requires `pnpm build` (this package + `@luhanxin/spec-hub-core`) to have
 * already run.
 */
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createDiskContentSource, readRepoContentOnce} from '@luhanxin/spec-hub-core';
import {writeSpecHubVitepressPages} from '../dist/index.js';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const yjsDocsOpenspecDir = join(packageDir, '../../../yjs-docs/openspec');
const verifyDir = join(packageDir, '.verify-tmp');

async function main() {
  if (!existsSync(yjsDocsOpenspecDir)) {
    console.error(`yjs-docs not found as a sibling directory (expected at ${yjsDocsOpenspecDir}).`);
    process.exit(1);
  }

  const source = createDiskContentSource(yjsDocsOpenspecDir);
  const repoContent = await readRepoContentOnce(source, {org: 'lhx-space', repo: 'yjs-docs'});
  console.log(
    `Synced ${repoContent.capabilities.length} capabilities, ${repoContent.archivedChanges.length} archived changes from yjs-docs.`
  );

  rmSync(verifyDir, {recursive: true, force: true});
  mkdirSync(join(verifyDir, 'docs', '.vitepress'), {recursive: true});
  writeFileSync(join(verifyDir, 'docs', 'index.md'), '# Spec Hub verify build\n');

  const {sidebar} = await writeSpecHubVitepressPages({
    repos: [repoContent],
    docsRoot: join(verifyDir, 'docs')
  });

  writeFileSync(
    join(verifyDir, 'docs', '.vitepress', 'config.mjs'),
    [
      'export default {',
      "  title: 'Spec Hub verify build',",
      `  themeConfig: {sidebar: ${JSON.stringify(sidebar)}}`,
      '};',
      ''
    ].join('\n')
  );

  console.log('Running `vitepress build`...');
  execFileSync(join(packageDir, 'node_modules/.bin/vitepress'), ['build', 'docs'], {
    cwd: verifyDir,
    stdio: 'inherit'
  });

  const sampleCapability = repoContent.capabilities[0];
  if (!sampleCapability) {
    throw new Error('yjs-docs fixture produced zero capabilities — nothing to verify.');
  }
  const sampleChange = repoContent.archivedChanges[0];

  const expectedFiles = [
    join(
      verifyDir,
      'docs/.vitepress/dist',
      'lhx-space/yjs-docs/specs',
      `${sampleCapability.slug}.html`
    ),
    ...(sampleChange
      ? [
          join(
            verifyDir,
            'docs/.vitepress/dist',
            'lhx-space/yjs-docs/changes',
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

  console.log('\nvitepress build succeeded and generated the expected namespaced routes.');
  rmSync(verifyDir, {recursive: true, force: true});
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
