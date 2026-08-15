import type {ArchivedChangeDirRef, ArchivedChangeFileName, RepoContentSource} from '../src/types';
import {type ArchivedChangeFixture, resolveProposalMarkdown} from './fixtures';

export interface FakeSourceData {
  /** slug -> spec.md markdown. */
  capabilities?: Record<string, string>;
  archivedChanges?: ArchivedChangeFixture[];
  readme?: string;
  readmeZhCN?: string;
}

/**
 * A `RepoContentSource` implementation backed by plain JS objects — no disk, no network, no
 * temp directories to clean up. Exists to prove design.md Decision 7's actual claim: every
 * scenario covered against `DiskContentSource` in disk-source.test.ts is re-run against this
 * fake in sync.test.ts, with zero changes to `readRepoContentOnce`/`SyncedRepoStore`.
 */
export function createFakeContentSource(data: FakeSourceData): RepoContentSource {
  const capabilities = data.capabilities ?? {};
  const archivedChanges = data.archivedChanges ?? [];

  function findChange(dirName: string): ArchivedChangeFixture | undefined {
    return archivedChanges.find(change => `${change.archivedDate}-${change.slug}` === dirName);
  }

  return {
    async listCapabilitySlugs() {
      return Object.keys(capabilities).sort();
    },
    async readCapabilitySpec(slug: string) {
      const markdown = capabilities[slug];
      if (markdown === undefined) throw new Error(`Unknown capability "${slug}"`);
      return markdown;
    },
    async listArchivedChangeDirs(): Promise<ArchivedChangeDirRef[]> {
      return archivedChanges
        .map(change => ({
          dirName: `${change.archivedDate}-${change.slug}`,
          archivedDate: change.archivedDate,
          slug: change.slug
        }))
        .sort((a, b) => a.dirName.localeCompare(b.dirName));
    },
    async readArchivedChangeFile(dirName: string, fileName: ArchivedChangeFileName) {
      const change = findChange(dirName);
      if (!change) return undefined;
      if (fileName === 'proposal.md') return resolveProposalMarkdown(change);
      if (fileName === 'design.md') return change.designMarkdown;
      return change.tasksMarkdown;
    },
    async readCapabilityDeltas(dirName: string) {
      const change = findChange(dirName);
      return [...(change?.touchedCapabilities ?? [])]
        .sort()
        .map(slug => ({slug, deltaMarkdown: '## ADDED Requirements\n'}));
    },
    async readReadme() {
      return data.readme;
    },
    async readReadmeZhCN() {
      return data.readmeZhCN;
    }
  };
}
