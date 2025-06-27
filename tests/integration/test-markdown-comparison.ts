import path from 'path';
import fs from 'fs';
import { ContentExtractor } from '../../src/core/content-extractor';
import { generateMarkdown } from '../../src/core/markdown-generator';
import { PocketItem } from '../../src/types';
import stringSimilarity from 'string-similarity';

describe('Integration: Clipped markdown matches original Obsidian Web Clipper output', () => {
  const testUrl = 'https://whatisintelligence.antikythera.org/chapter-01/';
  const expectedFile = path.resolve(
    '/Users/nimast/dev/repos/obs-vault/Clippings/What is Intelligence?  Antikythera 1.md'
  );

  it('should produce similar markdown output', async () => {
    const item: PocketItem = {
      title: 'What is Intelligence?  Antikythera 1',
      url: testUrl,
      time_added: 'test',
      tags: '',
      status: 'archive',
    };
    const extractor = new ContentExtractor();
    const content = await extractor.extractContent(testUrl);
    const markdown = generateMarkdown(item, content);
    const expected = fs.readFileSync(expectedFile, 'utf8');
    // Compare similarity (ignore frontmatter differences)
    const sim = stringSimilarity.compareTwoStrings(
      markdown.replace(/---[\s\S]*?---/, ''),
      expected.replace(/---[\s\S]*?---/, '')
    );
    expect(sim).toBeGreaterThan(0.7);
  });
}); 