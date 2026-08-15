/**
 * Turns a repo's `README.md` into the short blurb the homepage card shows for it (design.md
 * Decision 8). Deliberately dumb — strip the first Markdown heading if the README opens with
 * one, take the first non-empty paragraph after that, collapse it to plain-ish text, truncate.
 * Not a real Markdown parser: good enough for "one sentence on a card", nothing more.
 */
export function summarizeReadme(markdown: string | undefined, maxLength = 200): string | undefined {
  if (!markdown) return undefined;

  const lines = markdown.split('\n');
  const paragraphLines: string[] = [];
  let sawNonHeadingContent = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      if (sawNonHeadingContent) break;
      continue;
    }
    if (/^#{1,6}\s/.test(trimmed) || /^!\[/.test(trimmed) || /^\[!\[/.test(trimmed)) {
      // Heading or badge/image line — part of the "front matter" every README opens with, not
      // the actual description.
      continue;
    }
    sawNonHeadingContent = true;
    paragraphLines.push(trimmed);
  }

  const paragraph = paragraphLines
    .join(' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();

  if (paragraph.length === 0) return undefined;
  return paragraph.length > maxLength
    ? `${paragraph.slice(0, maxLength - 1).trimEnd()}…`
    : paragraph;
}
