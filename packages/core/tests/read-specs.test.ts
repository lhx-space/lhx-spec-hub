import {mkdirSync} from 'node:fs';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {readCapabilitySlugs, readCapabilitySpecMarkdown} from '../src/read-specs';
import {createTempOpenspecFixture, type TempOpenspecFixture, writeCapabilitySpec} from './fixtures';

describe('readCapabilitySlugs / readCapabilitySpecMarkdown', () => {
  let fixture: TempOpenspecFixture;

  beforeEach(() => {
    fixture = createTempOpenspecFixture();
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('returns an empty array when specs/ does not exist', () => {
    expect(readCapabilitySlugs(`${fixture.openspecDir}/specs`)).toEqual([]);
  });

  it('lists only directories that contain a spec.md, sorted', () => {
    writeCapabilitySpec(fixture.openspecDir, 'error-monitor', '## Requirements\n');
    writeCapabilitySpec(fixture.openspecDir, 'auth', '## Requirements\n');
    // A directory without spec.md must not be treated as a capability.
    const specsDir = `${fixture.openspecDir}/specs`;
    mkdirSync(`${specsDir}/not-a-capability`, {recursive: true});

    expect(readCapabilitySlugs(specsDir)).toEqual(['auth', 'error-monitor']);
  });

  it('reads the spec.md content verbatim, byte-for-byte', () => {
    const markdown = '## Requirements\n\n### Requirement: 原文保真\n某些内容\t带 tab。\n';
    writeCapabilitySpec(fixture.openspecDir, 'error-monitor', markdown);

    expect(readCapabilitySpecMarkdown(`${fixture.openspecDir}/specs`, 'error-monitor')).toBe(
      markdown
    );
  });
});
