import type {ArchivedChange, ArchivedChangeRef} from './types';

/** For a given capability slug, finds every archived change whose own `specs/<slug>/` delta
 * directory exists (`ArchivedChange.specDeltas`), ordered by `archivedDate` ascending (oldest
 * first — a "history" reads naturally in chronological order). Purely structural — no markdown
 * parsing/NLP, see spec-sync-engine spec.md "capability 关联历史变更". */
export function computeRelatedChanges(
  capabilitySlug: string,
  archivedChanges: ArchivedChange[]
): ArchivedChangeRef[] {
  return archivedChanges
    .filter(change => change.specDeltas.some(delta => delta.slug === capabilitySlug))
    .map(change => ({slug: change.slug, archivedDate: change.archivedDate}))
    .sort((a, b) => a.archivedDate.localeCompare(b.archivedDate));
}
