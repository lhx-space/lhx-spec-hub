/**
 * Pure markdown-rendering helpers: turn synced content (produced by `@luhanxin/spec-hub-core`)
 * into `{routePath, content}` pairs, per `docs-site-plugins` spec.md's namespacing requirement
 * (`/<org>/<repo>/specs/<capability>`, `/<org>/<repo>/changes/<slug>`).
 *
 * Rendering deliberately follows rspress's *own* conventions instead of inventing a bespoke
 * "markdown links on a page" layout:
 * - The homepage uses rspress's real home-page frontmatter (`pageType: 'home'` + `hero` +
 *   `features`, see rspress's `@rspress/shared` `Hero`/`Feature` types) — this is what renders
 *   through rspress's built-in `HomeLayout`/`HomeHero`/`HomeFeature` components (styled hero +
 *   clickable feature cards), not a plain bullet list.
 * - Each repo's own page (`renderRepoIndexPage`) is its README, verbatim — "Introduction" per
 *   design.md Decision 8/9's revision. It does NOT also dump a flat list of every capability/
 *   change on the same page; those are reachable via the sidebar (`repoSidebarEntries`), which
 *   is what gives rspress's own `usePrevNextPage`/`DocFooter` something to compute prev/next
 *   from — a flat single page had nothing to page through.
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
 * - `repoSidebarEntries` returns rspress's real `Sidebar` shape (`{[pathPrefix]: SidebarItem[]}`,
 *   grouped with `SidebarGroup`), meant to be merged into `themeConfig.sidebar` by this
 *   package's `config` plugin hook (see `index.ts`) — this is what was missing before: rspress
 *   was never told about a sidebar at all, so specs/changes had no persistent nav and no
 *   prev/next.
 *
 * Deliberately dumb about content itself — no Given/When/Then transform, no HTML, verbatim
 * `specMarkdown`/`proposalMarkdown`/`readme` dropped in as-is (see design.md Decision 6's note
 * on rendering raw markdown first).
 *
 * `@luhanxin/spec-hub-vitepress-plugin` has a near-identical copy of this file, adjusted for
 * vitepress's equivalent (but not identical) conventions — see that file's own header comment.
 * Intentionally duplicated rather than extracted into `@luhanxin/spec-hub-core` — `spec-sync-
 * engine` spec.md scopes that package to producing `RepoContent`, not rendering it into pages.
 */
import type {
  ArchivedChange,
  CapabilityDelta,
  CapabilitySpec,
  RegistrySyncResult,
  RepoIdentity
} from '@luhanxin/spec-hub-core';
import {summarizeReadme} from '@luhanxin/spec-hub-core';
import type {Feature, Hero, Sidebar, SidebarGroup, SidebarItem} from '@rspress/shared';
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

/** rspress compiles pages through MDX, which parses `<` as the start of a JSX tag — so a
 * perfectly normal CommonMark autolink like `<https://example.com>` (which real READMEs use,
 * e.g. `yjs-docs`'s) breaks the build ("Unexpected character `/`... to create a link in MDX,
 * use `[text](url)`" — literally MDX's own suggested fix). Every string embedded verbatim here
 * came from outside this package's control (`specMarkdown`/`proposalMarkdown`/`readme`/etc.),
 * so this runs on all of them before embedding. `@luhanxin/spec-hub-vitepress-plugin` doesn't
 * need this — vitepress compiles through markdown-it, not MDX, and has no such restriction. */
function escapeAngleBracketAutolinksForMdx(markdown: string): string {
  return markdown.replace(/<(https?:\/\/[^>\s]+)>/g, '[$1]($1)');
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
      escapeAngleBracketAutolinksForMdx(capability.specMarkdown.trim()),
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
      escapeAngleBracketAutolinksForMdx(change.proposalMarkdown.trim()),
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
      escapeAngleBracketAutolinksForMdx(change.designMarkdown.trim()),
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
      escapeAngleBracketAutolinksForMdx(change.tasksMarkdown.trim()),
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
      escapeAngleBracketAutolinksForMdx(delta.deltaMarkdown.trim()),
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

function repoFeature(result: RegistrySyncResult): Feature {
  const {title, description, link} = repoCardInfo(result);
  return {icon: '📘', title, details: description ?? 'No description available.', link};
}

/** The homepage — rspress's real home-page layout (`pageType: 'home'`, `hero`/`features`
 * frontmatter, see this file's header comment), one feature card per registered repo, in
 * `spec-hub.config.yaml`'s `repos` order, each card clickable into that repo's own Introduction
 * page (design.md Decision 8/9). */
export function renderHomePage(results: RegistrySyncResult[]): GeneratedPage {
  const primary = results[0] ? repoCardInfo(results[0]) : undefined;
  const hero: Hero = {
    name: 'Spec Hub',
    text: 'OpenSpec content aggregated across repos',
    tagline: "Browse each registered repo's capabilities and archived changes below.",
    actions: primary ? [{text: `Browse ${primary.title}`, link: primary.link, theme: 'brand'}] : []
  };
  const features: Feature[] = results.map(repoFeature);

  return {routePath: '/', content: `${frontmatter({pageType: 'home', hero, features})}\n`};
}

/** One registered repo's own landing page — its README (English preferred, falling back to
 * `README.zh-CN.md`), verbatim, and nothing else. What a homepage feature card links into, and
 * the "Introduction" sidebar entry `repoSidebarEntries` points at — capabilities/archived
 * changes are reachable from the sidebar, not duplicated here as a flat link list. */
export function renderRepoIndexPage(result: RegistrySyncResult): GeneratedPage {
  const {identity, content} = result;
  const readme = content.readme ?? content.readmeZhCN;
  const body = readme
    ? escapeAngleBracketAutolinksForMdx(readme.trim())
    : '_No README synced for this repo yet — browse its specs and changes via the sidebar._';

  return {
    routePath: repoIndexRoutePath(identity),
    content: [frontmatter({title: `${identity.org}/${identity.repo}`}), '', body, ''].join('\n')
  };
}

/** One archived change's sidebar entry — a plain link to its Proposal page when it has nothing
 * else (the common case: no design doc, no tasks list, no touched capabilities yet), or a
 * collapsible group (still itself linking to Proposal — rspress's `SidebarGroup.link` — with
 * Design/Tasks/each delta as nested items) when it does. This — not a flat list of unrelated
 * pages — is what lets prev/next flow Proposal → Design → Tasks → each delta → the next
 * change's Proposal. */
function archivedChangeSidebarItem(
  identity: RepoIdentity,
  change: ArchivedChange
): SidebarItem | SidebarGroup {
  const subItems: SidebarItem[] = [];
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
  if (subItems.length === 0) return {text, link};
  return {text, link, items: subItems, collapsible: true, collapsed: true};
}

/** One registered repo's sidebar — "Introduction" (linking to `renderRepoIndexPage`'s route),
 * then a "Specs" group and a "Changes" group (newest first), each omitted entirely when that
 * repo has none yet. Registered under two keys pointing at the same array — the repo's bare
 * identity path (so the Introduction page itself, whose own route is that bare path, shows this
 * sidebar too) and that path with a trailing slash (so every nested `/specs/*`, `/changes/*`
 * page matches it via rspress's prefix-based sidebar lookup). Because every registered repo gets
 * its own pair of keys this long, two repos can never falsely prefix-match each other (rspress
 * picks the *longest* matching key), even when one repo's name is a literal prefix of another's
 * (e.g. `yjs-docs` vs. `yjs-docs-extra`).
 *
 * This — merged into `themeConfig.sidebar` by `index.ts`'s `config` plugin hook — is what makes
 * rspress compute prev/next (`usePrevNextPage`/`DocFooter`) automatically; there was no sidebar
 * at all before, so there was nothing to page through. */
export function repoSidebarEntries(result: RegistrySyncResult): Sidebar {
  const {identity, content} = result;
  const base = repoIndexRoutePath(identity);
  const items: (SidebarItem | SidebarGroup)[] = [{text: 'Introduction', link: base}];

  if (content.capabilities.length > 0) {
    items.push({
      text: 'Specs',
      items: content.capabilities.map(capability => ({
        text: capability.slug,
        link: capabilityRoutePath(identity, capability.slug)
      })),
      collapsible: true,
      collapsed: false
    });
  }

  if (content.archivedChanges.length > 0) {
    items.push({
      text: 'Changes',
      items: [...content.archivedChanges]
        .reverse()
        .map(change => archivedChangeSidebarItem(identity, change)),
      collapsible: true,
      collapsed: false
    });
  }

  return {[base]: items, [`${base}/`]: items};
}
