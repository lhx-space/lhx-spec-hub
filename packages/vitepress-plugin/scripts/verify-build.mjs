#!/usr/bin/env node
/**
 * Local/manual verification for tasks.md task 5.3 — actually runs `vitepress build` against the
 * real `yjs-docs` repo (README + `openspec/` content) synced through `@luhanxin/spec-hub-core`,
 * using this package's `writeSpecHubVitepressPages`, and checks the generated HTML output
 * contains the expected namespaced routes (capability page, archived-change page, repo index
 * page, homepage).
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
const yjsDocsRepoRootDir = join(packageDir, '../../../yjs-docs');
const verifyDir = join(packageDir, '.verify-tmp');

async function main() {
  if (!existsSync(join(yjsDocsRepoRootDir, 'openspec'))) {
    console.error(`yjs-docs not found as a sibling directory (expected at ${yjsDocsRepoRootDir}).`);
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
  mkdirSync(join(verifyDir, 'docs', '.vitepress'), {recursive: true});

  const {sidebar} = await writeSpecHubVitepressPages({
    repos: [registrySyncResult],
    docsRoot: join(verifyDir, 'docs')
  });

  writeFileSync(
    join(verifyDir, 'docs', '.vitepress', 'config.mjs'),
    [
      'export default {',
      "  title: 'Spec Hub verify build',",
      // Embedded READMEs are verbatim content from outside this package's control and commonly
      // contain repo-relative links (e.g. `./packages/foo`) that are meaningful on GitHub but
      // don't resolve to any page in this generated site — vitepress's default dead-link check
      // would otherwise fail the whole build over that, not just warn.
      '  ignoreDeadLinks: true,',
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

  const sampleCapability = content.capabilities[0];
  if (!sampleCapability) {
    throw new Error('yjs-docs fixture produced zero capabilities — nothing to verify.');
  }
  const sampleChange = content.archivedChanges[0];

  const expectedFiles = [
    join(verifyDir, 'docs/.vitepress/dist', 'index.html'),
    join(verifyDir, 'docs/.vitepress/dist', 'lhx-space/yjs-docs.html'),
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
