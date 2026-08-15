import {describe, expect, it} from 'vitest';
import {summarizeReadme} from '../src/summary';

describe('summarizeReadme', () => {
  it('returns undefined for undefined input', () => {
    expect(summarizeReadme(undefined)).toBeUndefined();
  });

  it('skips a leading heading and badge/image lines, takes the first real paragraph', () => {
    const markdown = [
      '# My Project',
      '',
      '[![CI](https://example.com/badge.svg)](https://example.com)',
      '',
      'This is the real description of the project.',
      'It continues on a second line.',
      '',
      'A second paragraph that should not be included.'
    ].join('\n');

    expect(summarizeReadme(markdown)).toBe(
      'This is the real description of the project. It continues on a second line.'
    );
  });

  it('strips inline code/bold/link markdown syntax', () => {
    const markdown = '# Title\n\nUses `code`, **bold**, and a [link](https://example.com) inline.';
    expect(summarizeReadme(markdown)).toBe('Uses code, bold, and a link inline.');
  });

  it('truncates long paragraphs to maxLength with an ellipsis', () => {
    const longSentence = `A${'b'.repeat(300)}`;
    const result = summarizeReadme(`# T\n\n${longSentence}`, 50);
    expect(result?.length).toBe(50);
    expect(result?.endsWith('…')).toBe(true);
  });

  it('returns undefined when the README has no real content beyond headings/badges', () => {
    expect(summarizeReadme('# Title\n\n![badge](https://example.com/b.svg)\n')).toBeUndefined();
  });
});
