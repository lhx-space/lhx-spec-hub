/**
 * Pure markdown-rendering helpers: turn a `RepoContent` (produced by `@luhanxin/spec-hub-core`)
 * into `{routePath, content}` pairs, per `docs-site-plugins` spec.md's namespacing requirement
 * (`/<org>/<repo>/specs/<capability>`, `/<org>/<repo>/changes/<slug>`).
 *
 * Deliberately dumb — no Given/When/Then transform, no HTML, verbatim `specMarkdown`/
 * `proposalMarkdown` etc. dropped in as-is (see design.md Decision 6's note on rendering raw
 * markdown first, only adding a presentation transform if it actually looks bad in practice).
 *
 * `@luhanxin/spec-hub-vitepress-plugin` has a near-identical copy of this file. Intentionally
 * duplicated rather than extracted into `@luhanxin/spec-hub-core` — `spec-sync-engine` spec.md
 * scopes that package to producing `RepoContent`, not rendering it into pages. Revisit if the
 * two copies drift enough to be worth a shared package.
 */
import type {ArchivedChange, CapabilitySpec, RepoIdentity} from '@luhanxin/spec-hub-core';

export interface GeneratedPage {
  routePath: string;
  content: string;
}

export function capabilityRoutePath(identity: RepoIdentity, slug: string): string {
  return `/${identity.org}/${identity.repo}/specs/${slug}`;
}

export function archivedChangeRoutePath(identity: RepoIdentity, slug: string): string {
  return `/${identity.org}/${identity.repo}/changes/${slug}`;
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
      '---',
      `title: "${identity.org}/${identity.repo} — ${capability.slug}"`,
      '---',
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

export function renderArchivedChangePage(
  identity: RepoIdentity,
  change: ArchivedChange
): GeneratedPage {
  const sections = [change.proposalMarkdown.trim()];
  if (change.designMarkdown) {
    sections.push(`## Design\n\n${change.designMarkdown.trim()}`);
  }
  if (change.tasksMarkdown) {
    sections.push(`## Tasks\n\n${change.tasksMarkdown.trim()}`);
  }

  return {
    routePath: archivedChangeRoutePath(identity, change.slug),
    content: [
      '---',
      `title: "${identity.org}/${identity.repo} — ${change.slug}"`,
      '---',
      '',
      `# ${change.slug}`,
      '',
      sections.join('\n\n'),
      ''
    ].join('\n')
  };
}
