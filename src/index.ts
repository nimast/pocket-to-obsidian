#!/usr/bin/env node

import { Command } from 'commander';
import { parsePocketCSV } from './core/csv-parser';
import { ContentExtractor } from './core/content-extractor';
import { generateMarkdown } from './core/markdown-generator';
import { writeMarkdownToVault, createOutputFolder, writeResultsToCSV, ConversionResult } from './core/file-manager';
import { PocketItem } from './types';
import path from 'path';
import chalk from 'chalk';

const program = new Command();

program
  .name('pocket-to-obsidian')
  .description('Convert Pocket bookmarks to Obsidian markdown files')
  .version('1.0.0')
  .option('-v, --vault <path>', 'Path to your Obsidian vault', process.env.OBSIDIAN_VAULT_PATH)
  .option('-c, --csv <file>', 'Path to Pocket CSV export file (default: part_000000.csv in project folder)', 'part_000000.csv')
  .option('-l, --limit <number>', 'Limit number of items to process', parseInt)
  .option('-o, --output <path>', 'Custom output directory')
  .option('--headless <boolean>', 'Run browser in headless mode', 'true')
  .parse();

const options = program.opts();

async function main() {
  // Validate required options
  if (!options.vault) {
    console.error(chalk.red('Error: Obsidian vault path is required.'));
    console.error(chalk.yellow('Set OBSIDIAN_VAULT_PATH environment variable or use --vault option.'));
    process.exit(1);
  }

  if (!options.csv) {
    console.error(chalk.red('Error: CSV file path is required.'));
    process.exit(1);
  }

  const csvPath = path.resolve(options.csv);
  const vaultPath = path.resolve(options.vault);

  console.log(chalk.blue('Pocket to Obsidian Converter'));
  console.log(chalk.gray('========================'));
  console.log(chalk.white(`Vault: ${vaultPath}`));
  console.log(chalk.white(`CSV: ${csvPath}`));
  if (options.limit) {
    console.log(chalk.white(`Limit: ${options.limit} items`));
  }
  console.log('');

  try {
    console.log(chalk.blue('Parsing Pocket CSV...'));
    const items: PocketItem[] = await parsePocketCSV(csvPath);
    console.log(chalk.green(`✓ Found ${items.length} items in CSV.`));

    // Apply limit if specified
    const itemsToProcess = options.limit ? items.slice(0, options.limit) : items;
    console.log(chalk.white(`Processing ${itemsToProcess.length} items...`));

    // Create timestamped output folder
    const outputDir = options.output || createOutputFolder();
    console.log(chalk.white(`Output folder: ${outputDir}`));

    const extractor = new ContentExtractor({
      headless: options.headless === 'true'
    });
    const results: ConversionResult[] = [];
    
    try {
      for (let i = 0; i < itemsToProcess.length; i++) {
        const item = itemsToProcess[i];
        if (!item.url) continue;
        
        const progress = `[${i + 1}/${itemsToProcess.length}]`;
        console.log(chalk.blue(`${progress} Clipping: ${item.title}`));
        console.log(chalk.gray(`   URL: ${item.url}`));
        
        try {
          const content = await extractor.extractContent(item.url);
          const markdown = generateMarkdown(item, content);
          const outputPath = writeMarkdownToVault(vaultPath, item, markdown);
          
          results.push({
            item,
            success: true,
            outputPath
          });
          
          console.log(chalk.green(`   ✓ Success: ${path.basename(outputPath)}`));
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          results.push({
            item,
            success: false,
            error: errorMessage
          });
          
          console.log(chalk.red(`   ✗ Failed: ${errorMessage}`));
        }
        console.log('');
      }
      
      // Write results to CSV files
      writeResultsToCSV(results, outputDir);
      
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      console.log(chalk.blue('Summary'));
      console.log(chalk.blue('======='));
      console.log(chalk.green(`✓ Successful: ${successful}`));
      console.log(chalk.red(`✗ Failed: ${failed}`));
      console.log(chalk.white(`📁 Results saved to: ${outputDir}`));
      
      if (failed > 0) {
        console.log(chalk.yellow('\nFailed items:'));
        results.filter(r => !r.success).forEach(r => {
          console.log(chalk.yellow(`  - ${r.item.title}: ${r.error}`));
        });
      }
      
    } finally {
      await extractor.close();
    }
  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
} 