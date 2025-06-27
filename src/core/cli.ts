import path from 'path';
import { parsePocketCSV } from './csv-parser';
import { ContentExtractor } from './content-extractor';
import { generateMarkdown } from './markdown-generator';
import { writeMarkdownToVault } from './file-manager';
import { PocketItem } from '../types';
import ora from 'ora';

const VAULT_ROOT = '/Users/nimast/dev/repos/obs-vault';
const POCKET_CSV = path.resolve(__dirname, '../../part_000000.csv');

async function main() {
  const spinner = ora('Parsing Pocket CSV...').start();
  const items: PocketItem[] = await parsePocketCSV(POCKET_CSV);
  spinner.succeed(`Found ${items.length} items in CSV.`);

  const extractor = new ContentExtractor();
  let count = 0;
  for (const item of items) {
    if (!item.url) continue;
    spinner.start(`Clipping: ${item.title} (${item.url})`);
    try {
      const content = await extractor.extractContent(item.url);
      const markdown = generateMarkdown(item, content);
      writeMarkdownToVault(VAULT_ROOT, item, markdown);
      count++;
      spinner.succeed(`Clipped: ${item.title}`);
    } catch (err) {
      spinner.fail(`Failed to clip: ${item.title} (${item.url})`);
    }
  }
  spinner.succeed(`Done! Clipped ${count} items.`);
}

if (require.main === module) {
  main();
} 