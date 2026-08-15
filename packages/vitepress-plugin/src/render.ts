/**
 * Pure markdown-rendering helpers — identical in spirit to
 * `@luhanxin/spec-hub-rspress-plugin`'s `render.ts` (see that file's header comment for the full
 * rationale), adjusted for vitepress's equivalent-but-not-identical conventions:
 * - The homepage uses vitepress's real home-page frontmatter (`layout: 'home'` + `hero` +
 *   `features` — vitepress's own documented convention, rendered through its built-in
 *   `VPHome`/`VPHero`/`VPFeatures` theme components), not a plain bullet list.
 * - Each repo's own page (`renderRepoIndexPage`) is its README, verbatim ("Introduction").
 *   Capabilities/archived changes are NOT also dumped as a flat link list on that same page —
 *   they're reachable via the sidebar (`repoSidebarEntries`, consumed by `write-pages.ts`),
 *   which is what gives vitepress's `usePrevNext` something to compute prev/next from.
 * - An archived change is NOT one giant page with `proposal.md`/`design.md`/`tasks.md`/every
 *   touched capability's delta concatenated together. Each of those is its own on-disk file,
 *   each written assuming it IS the top-level document (all open with `##` per OpenSpec's own
 *   convention: `## Why`, `## Context`, `## 1. ...`, `## ADDED Requirements`) — so each gets its
 *   own route/page (`renderArchivedChangePage` for `proposal.md`, `renderArchivedChangeDesignPage`
 *   for `design.md`, `renderArchivedChangeTasksPage` for `tasks.md`,
 *   `renderArchivedChangeDeltaPage` per touched capability), mirroring
 *   `changes/archive/<dir>/{proposal,design,tasks}.md` + `specs/<slug>/spec.md` onto routes 1:1.
 *   `repoSidebarEntries` nests these under one sidebar group per change, so they're still
 *   discoverable together and prev/next flows Proposal → Design → Tasks → each delta → the next
 *   change's Proposal.
 * - Unlike the rspress version, this does NOT need to escape `<https://...>` autolinks —
 *   vitepress compiles through markdown-it, not MDX, so that's just a normal, safe CommonMark
 *   autolink here.
 */
import type {
  ArchivedChange,
  CapabilityDelta,
  CapabilitySpec,
  RegistrySyncResult,
  RepoIdentity
} from '@luhanxin/spec-hub-core';
import {summarizeReadme} from '@luhanxin/spec-hub-core';
import type {DefaultTheme} from 'vitepress';
import {stringify} from 'yaml';

export interface GeneratedPage {
  routePath: string;
  content: string;
}

/** YAML-serializes `data` into a `---\n...\n---` frontmatter block. Every value that ends up in
 * here (repo names/descriptions from `spec-hub.config.yaml`, README-derived summaries, capability
 * slugs) is outside this package's control and may contain characters that would corrupt
 * hand-written `key: "value"` frontmatter (colons, quotes, newlines) — a real YAML serializer
 * picks correct quoting/block style so this never has to be re-litigated per call site. */
function frontmatter(data: Record<string, unknown>): string {
  return `---\n${stringify(data).trimEnd()}\n---`;
}

export function capabilityRoutePath(identity: RepoIdentity, slug: string): string {
  return `/${identity.org}/${identity.repo}/specs/${slug}`;
}

/** An archived change's own landing page — `proposal.md`, see `renderArchivedChangePage`. */
export function archivedChangeRoutePath(identity: RepoIdentity, slug: string): string {
  return `/${identity.org}/${identity.repo}/changes/${slug}`;
}

/** `design.md`'s own page, see `renderArchivedChangeDesignPage`. */
export function archivedChangeDesignRoutePath(identity: RepoIdentity, slug: string): string {
  return `${archivedChangeRoutePath(identity, slug)}/design`;
}

/** `tasks.md`'s own page, see `renderArchivedChangeTasksPage`. */
export function archivedChangeTasksRoutePath(identity: RepoIdentity, slug: string): string {
  return `${archivedChangeRoutePath(identity, slug)}/tasks`;
}

/** One capability's delta page within a change, see `renderArchivedChangeDeltaPage`. Namespaced
 * under the change (not under `/specs/`) since it's that capability's diff *as part of this
 * specific change*, not its current merged spec (that's `capabilityRoutePath`). */
export function archivedChangeDeltaRoutePath(
  identity: RepoIdentity,
  changeSlug: string,
  capabilitySlug: string
): string {
  return `${archivedChangeRoutePath(identity, changeSlug)}/specs/${capabilitySlug}`;
}

/** Each registered repo's own landing page ("Introduction") — what a homepage feature card
 * (`renderHomePage`) links into, and the first item in that repo's sidebar
 * (`repoSidebarEntries`). */
export function repoIndexRoutePath(identity: RepoIdentity): string {
  return `/${identity.org}/${identity.repo}`;
}

export function renderCapabilityPage(
  identity: RepoIdentity,
  capability: CapabilitySpec
): GeneratedPage {
  const history =
    capability.relatedChanges.length === 0
      ? '_No archived changes reference this capability yet._'
      : capability.relatedChanges
          .map(
            ref =>
              `- ${ref.archivedDate} — [${ref.slug}](${archivedChangeRoutePath(identity, ref.slug)})`
          )
          .join('\n');

  return {
    routePath: capabilityRoutePath(identity, capability.slug),
    content: [
      frontmatter({title: `${identity.org}/${identity.repo} — ${capability.slug}`}),
      '',
      `# ${capability.slug}`,
      '',
      capability.specMarkdown.trim(),
      '',
      '## History',
      '',
      history,
      ''
    ].join('\n')
  };
}

/** The change's own landing page — `proposal.md`, verbatim (every archived change has one, see
 * `readRepoContentOnce` in `sync.ts`, which throws if a source reports it missing).
 * `design.md`/`tasks.md`/each touched capability's delta are deliberately NOT merged in here —
 * see this file's header comment — each gets its own page instead
 * (`renderArchivedChangeDesignPage`/`renderArchivedChangeTasksPage`/
 * `renderArchivedChangeDeltaPage`), linked from this change's sidebar group
 * (`repoSidebarEntries`). */
export function renderArchivedChangePage(
  identity: RepoIdentity,
  change: ArchivedChange
): GeneratedPage {
  return {
    routePath: archivedChangeRoutePath(identity, change.slug),
    content: [
      frontmatter({title: `${identity.org}/${identity.repo} — ${change.slug}`}),
      '',
      `# ${change.slug}`,
      '',
      change.proposalMarkdown.trim(),
      ''
    ].join('\n')
  };
}

/** `design.md`'s own page — `undefined` when the change has none (not every change has a design
 * doc); callers must skip adding a page/sidebar entry for it in that case. See
 * `renderArchivedChangePage`'s doc comment for why this is a separate page rather than a
 * section of it. */
export function renderArchivedChangeDesignPage(
  identity: RepoIdentity,
  change: ArchivedChange
): GeneratedPage | undefined {
  if (!change.designMarkdown) return undefined;
  return {
    routePath: archivedChangeDesignRoutePath(identity, change.slug),
    content: [
      frontmatter({title: `${identity.org}/${identity.repo} — ${change.slug} — Design`}),
      '',
      `# ${change.slug} — Design`,
      '',
      change.designMarkdown.trim(),
      ''
    ].join('\n')
  };
}

/** `tasks.md`'s own page — `undefined` when the change has none. See
 * `renderArchivedChangeDesignPage`'s doc comment. */
export function renderArchivedChangeTasksPage(
  identity: RepoIdentity,
  change: ArchivedChange
): GeneratedPage | undefined {
  if (!change.tasksMarkdown) return undefined;
  return {
    routePath: archivedChangeTasksRoutePath(identity, change.slug),
    content: [
      frontmatter({title: `${identity.org}/${identity.repo} — ${change.slug} — Tasks`}),
      '',
      `# ${change.slug} — Tasks`,
      '',
      change.tasksMarkdown.trim(),
      ''
    ].join('\n')
  };
}

/** One page per capability touched by this change — the actual ADDED/MODIFIED/REMOVED
 * Requirements delta content OpenSpec's own tooling shows, verbatim, linking onward to that
 * capability's current (post-merge) spec page. `proposal.md`'s own "Capabilities" section, if
 * the author wrote one, only names which capabilities were touched — it doesn't show the diff
 * itself; this does. Called once per entry in `change.specDeltas` — see this file's header
 * comment for why each delta is its own page rather than a section of `renderArchivedChangePage`. */
export function renderArchivedChangeDeltaPage(
  identity: RepoIdentity,
  change: ArchivedChange,
  delta: CapabilityDelta
): GeneratedPage {
  return {
    routePath: archivedChangeDeltaRoutePath(identity, change.slug, delta.slug),
    content: [
      frontmatter({title: `${identity.org}/${identity.repo} — ${change.slug} — ${delta.slug}`}),
      '',
      `# ${change.slug} — ${delta.slug}`,
      '',
      `_Delta for [${delta.slug}](${capabilityRoutePath(identity, delta.slug)})._`,
      '',
      delta.deltaMarkdown.trim(),
      ''
    ].join('\n')
  };
}

/** The title/summary/link a homepage feature card shows for one registered repo — `entry.name`/
 * `entry.description` (from `spec-hub.config.yaml`) win over what's derived from the synced
 * content, so a repo without a README (or with a README that opens badly) can still get a
 * sensible card by just setting `description` in the config. */
export function repoCardInfo(result: RegistrySyncResult): {
  title: string;
  description?: string;
  link: string;
} {
  const {entry, identity, content} = result;
  return {
    title: entry.name ?? `${identity.org}/${identity.repo}`,
    description:
      entry.description ?? summarizeReadme(content.readme) ?? summarizeReadme(content.readmeZhCN),
    link: repoIndexRoutePath(identity)
  };
}

function repoFeature(result: RegistrySyncResult): {
  icon: string;
  title: string;
  details: string;
  link: string;
} {
  const {title, description, link} = repoCardInfo(result);
  return {icon: '📘', title, details: description ?? 'No description available.', link};
}

/** The homepage — vitepress's real home-page layout (`layout: 'home'`, `hero`/`features`
 * frontmatter, see this file's header comment), one feature card per registered repo, in
 * `spec-hub.config.yaml`'s `repos` order, each card clickable into that repo's own Introduction
 * page (design.md Decision 8/9). */
export function renderHomePage(results: RegistrySyncResult[]): GeneratedPage {
  const primary = results[0] ? repoCardInfo(results[0]) : undefined;
  const hero = {
    name: 'Spec Hub',
    text: 'OpenSpec content aggregated across repos',
    tagline: "Browse each registered repo's capabilities and archived changes below.",
    actions: primary ? [{text: `Browse ${primary.title}`, link: primary.link, theme: 'brand'}] : []
  };
  const features = results.map(repoFeature);

  return {routePath: '/', content: `${frontmatter({layout: 'home', hero, features})}\n`};
}

/** One registered repo's own landing page — its README (English preferred, falling back to
 * `README.zh-CN.md`), verbatim, and nothing else. What a homepage feature card links into, and
 * the "Introduction" sidebar entry `repoSidebarEntries` points at — capabilities/archived
 * changes are reachable from the sidebar, not duplicated here as a flat link list. */
export function renderRepoIndexPage(result: RegistrySyncResult): GeneratedPage {
  const {identity, content} = result;
  const readme = content.readme ?? content.readmeZhCN;
  const body = readme
    ? readme.trim()
    : '_No README synced for this repo yet — browse its specs and changes via the sidebar._';

  return {
    routePath: repoIndexRoutePath(identity),
    content: [frontmatter({title: `${identity.org}/${identity.repo}`}), '', body, ''].join('\n')
  };
}

/** One archived change's sidebar entry — a plain link to its Proposal page when it has nothing
 * else (the common case: no design doc, no tasks list, no touched capabilities yet), or a group
 * (still itself linking to Proposal — vitepress's `SidebarItem.link` and `.items` are not
 * mutually exclusive, see `types/default-theme.d.ts` — with Design/Tasks/each delta as nested
 * items) when it does. This — not a flat list of unrelated pages — is what lets prev/next flow
 * Proposal → Design → Tasks → each delta → the next change's Proposal. */
function archivedChangeSidebarItem(
  identity: RepoIdentity,
  change: ArchivedChange
): DefaultTheme.SidebarItem {
  const subItems: DefaultTheme.SidebarItem[] = [];
  if (change.designMarkdown) {
    subItems.push({text: 'Design', link: archivedChangeDesignRoutePath(identity, change.slug)});
  }
  if (change.tasksMarkdown) {
    subItems.push({text: 'Tasks', link: archivedChangeTasksRoutePath(identity, change.slug)});
  }
  for (const delta of change.specDeltas) {
    subItems.push({
      text: delta.slug,
      link: archivedChangeDeltaRoutePath(identity, change.slug, delta.slug)
    });
  }

  const text = `${change.archivedDate} · ${change.slug}`;
  const link = archivedChangeRoutePath(identity, change.slug);
  return subItems.length === 0 ? {text, link} : {text, link, items: subItems, collapsed: true};
}

/** One registered repo's sidebar — "Introduction" (linking to `renderRepoIndexPage`'s route),
 * then a "Specs" group and a "Changes" group (newest first), each omitted entirely when that
 * repo has none yet. Registered under two keys pointing at the same array — the repo's bare
 * identity path (so the Introduction page itself, whose own route is that bare path, shows this
 * sidebar too) and that path with a trailing slash (so every nested `/specs/*`, `/changes/*`
 * page matches it via vitepress's prefix-based sidebar lookup, which picks the *longest*
 * matching key — so two repos can never falsely prefix-match each other, even when one repo's
 * name is a literal prefix of another's, e.g. `yjs-docs` vs. `yjs-docs-extra`, because every
 * registered repo gets its own pair of keys this long).
 *
 * This is what makes vitepress compute prev/next (`usePrevNext`/`VPDocFooter`) automatically;
 * previously the sidebar was two disconnected `/specs/`/`/changes/` prefixes with no
 * "Introduction" entry at all, so the repo's own landing page never showed a sidebar, and
 * prev/next never crossed from specs into changes. */
export function repoSidebarEntries(result: RegistrySyncResult): DefaultTheme.SidebarMulti {
  const {identity, content} = result;
  const base = repoIndexRoutePath(identity);
  const items: DefaultTheme.SidebarItem[] = [{text: 'Introduction', link: base}];

  if (content.capabilities.length > 0) {
    items.push({
      text: 'Specs',
      collapsed: false,
      items: content.capabilities.map(capability => ({
        text: capability.slug,
        link: capabilityRoutePath(identity, capability.slug)
      }))
    });
  }

  if (content.archivedChanges.length > 0) {
    items.push({
      text: 'Changes',
      collapsed: false,
      items: [...content.archivedChanges]
        .reverse()
        .map(change => archivedChangeSidebarItem(identity, change))
    });
  }

  return {[base]: items, [`${base}/`]: items};
}
