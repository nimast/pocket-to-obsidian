#!/usr/bin/env node

import { Command } from 'commander';
import { parsePocketCSV } from './core/csv-parser';
import { ContentExtractor } from './core/content-extractor';
import { generateMarkdown } from './core/markdown-generator';
import { 
  writeMarkdownToVault, 
  createOutputFolder, 
  writeResultsToCSV, 
  ConversionResult,
  findLatestRunFolder,
  readPreviousResults
} from './core/file-manager';
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
  .option('-r, --resume [folder]', 'Resume from previous run, optionally specify folder path')
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
  if (options.resume) {
    console.log(chalk.yellow('Resume mode: enabled'));
  }
  console.log('');

  try {
    console.log(chalk.blue('Parsing Pocket CSV...'));
    const items: PocketItem[] = await parsePocketCSV(csvPath);
    console.log(chalk.green(`✓ Found ${items.length} items in CSV.`));

    let itemsToProcess: PocketItem[] = items;
    let previousResults: ConversionResult[] = [];

    if (options.resume) {
      // Find the resume folder - either specified or latest
      let resumeFolder: string | null = null;
      
      if (typeof options.resume === 'string' && options.resume !== 'true') {
        // Specific folder provided
        resumeFolder = path.resolve(options.resume);
        console.log(chalk.yellow(`Resuming from specified folder: ${resumeFolder}`));
      } else {
        // Use latest folder
        resumeFolder = findLatestRunFolder();
        if (resumeFolder) {
          console.log(chalk.yellow(`Resuming from latest run: ${resumeFolder}`));
        }
      }

      if (resumeFolder) {
        const { successful, failed } = readPreviousResults(resumeFolder);
        
        // Skip items that were successfully processed
        const skippedCount = successful.size;
        console.log(chalk.gray(`Skipping ${skippedCount} previously successful conversions`));
        
        // Only process failed items and new items
        itemsToProcess = items.filter(item => !successful.has(item.url));
        
        // Add previously failed items to results (so they get retried)
        previousResults = failed.map(item => ({
          item,
          success: false,
          error: 'Retrying from previous run'
        }));
        
        console.log(chalk.yellow(`Will retry ${failed.length} failed conversions`));
        console.log(chalk.white(`Will process ${itemsToProcess.length - failed.length} new items`));
      } else {
        console.log(chalk.gray('No previous run found, processing all items'));
      }
    }

    // Apply limit if specified
    if (options.limit) {
      itemsToProcess = itemsToProcess.slice(0, options.limit);
    }
    console.log(chalk.white(`Processing ${itemsToProcess.length} items...`));

    // Create timestamped output folder
    const outputDir = options.output || createOutputFolder();
    console.log(chalk.white(`Output folder: ${outputDir}`));

    const extractor = new ContentExtractor({
      headless: options.headless === 'true'
    });
    const results: ConversionResult[] = [...previousResults];
    
    try {
      for (let i = 0; i < itemsToProcess.length; i++) {
        const item = itemsToProcess[i];
        if (!item.url) continue;
        
        const progress = `[${i + 1}/${itemsToProcess.length}]`;
        
        // Check if this is a retry from previous run
        const isRetry = results.some(r => r.item.url === item.url);
        if (isRetry) {
          console.log(chalk.blue(`${progress} Retrying: ${item.title}`));
        } else {
          console.log(chalk.blue(`${progress} Clipping: ${item.title}`));
        }
        console.log(chalk.gray(`   URL: ${item.url}`));
        
        try {
          const content = await extractor.extractContent(item.url);
          const markdown = generateMarkdown(item, content);
          const outputPath = writeMarkdownToVault(vaultPath, item, markdown);
          
          // Update existing result or add new one
          const existingIndex = results.findIndex(r => r.item.url === item.url);
          if (existingIndex >= 0) {
            results[existingIndex] = {
              item,
              success: true,
              outputPath
            };
          } else {
            results.push({
              item,
              success: true,
              outputPath
            });
          }
          
          console.log(chalk.green(`   ✓ Success: ${path.basename(outputPath)}`));
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          
          // Update existing result or add new one
          const existingIndex = results.findIndex(r => r.item.url === item.url);
          if (existingIndex >= 0) {
            results[existingIndex] = {
              item,
              success: false,
              error: errorMessage
            };
          } else {
            results.push({
              item,
              success: false,
              error: errorMessage
            });
          }
          
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
        
        if (options.resume) {
          console.log(chalk.blue(`\n💡 Tip: Run again with --resume to retry the ${failed} failed conversions`));
        }
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