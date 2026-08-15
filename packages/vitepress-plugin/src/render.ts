/**
 * Pure markdown-rendering helpers — identical in spirit to
 * `@luhanxin/spec-hub-rspress-plugin`'s `render.ts` (see that file's header comment for why this
 * is duplicated rather than shared via `@luhanxin/spec-hub-core`).
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
