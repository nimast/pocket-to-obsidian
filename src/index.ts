#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import chalk from 'chalk';

import { parsePocketCSV } from './core/csv-parser';
import type { ContentExtractor } from './core/content-extractor';
import { processPocketItems } from './core/pocket-processor';
import { PocketItem } from './types';
import { loadProgress, saveProgress, ProgressState } from './utils/progress';

const program = new Command();
const PROJECT_ROOT = process.cwd();
const PROGRESS_FILE = path.resolve(PROJECT_ROOT, 'progress.json');

const activeExtractors = new Set<ContentExtractor>();
let currentProgress: ProgressState | null = null;
let isShuttingDown = false;

async function closeAllExtractors(): Promise<void> {
  if (activeExtractors.size === 0) {
    return;
  }

  const extractors = Array.from(activeExtractors);
  await Promise.allSettled(
    extractors.map(async extractor => {
      try {
        await extractor.close();
      } catch (err) {
        console.error(chalk.red('Failed to close extractor:'), err);
      } finally {
        activeExtractors.delete(extractor);
      }
    })
  );
}

async function saveStateAndExit(exitCode: number): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  try {
    if (currentProgress) {
      saveProgress(PROGRESS_FILE, currentProgress);
    }
  } catch (err) {
    console.error(chalk.red('Failed to save progress during shutdown:'), err);
  }

  await closeAllExtractors();
  process.exit(exitCode);
}

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Promise Rejection at:'), promise, chalk.red('reason:'), reason);
  if (currentProgress) {
    saveProgress(PROGRESS_FILE, currentProgress);
  }
});

process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error);
  void saveStateAndExit(1);
});

process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\nReceived SIGINT. Saving progress and shutting down gracefully...'));
  if (currentProgress) {
    console.log(chalk.yellow('📊 Current progress snapshot:'), {
      successCount: currentProgress.successCount,
      failedAttempts: currentProgress.failedCount,
      processedUrls: currentProgress.processedUrls.size,
      failedUrlsTracked: currentProgress.failedUrls.size
    });
  }
  void saveStateAndExit(0);
});

program
  .name('pocket-to-obsidian')
  .description('Convert Pocket bookmarks to Obsidian markdown files')
  .version('1.0.0')
  .option('-v, --vault <path>', 'Path to your Obsidian vault', process.env.OBSIDIAN_VAULT_PATH)
  .option('-c, --csv <file>', 'Path to Pocket CSV export file (default: part_000000.csv in project folder)', 'part_000000.csv')
  .option('-l, --limit <number>', 'Limit number of items to process', parseInt)
  .option('--headless <boolean>', 'Run browser in headless mode', 'true')
  .option('--workers <number>', 'Number of concurrent extraction workers', (value) => parseInt(value, 10), 5)
  .option('--retry-failed', 'Retry URLs previously recorded as failed in progress.json')
  .parse();

const options = program.opts();

async function main(): Promise<void> {
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

    let itemsToProcess: PocketItem[] = items;
    if (options.limit) {
      itemsToProcess = itemsToProcess.slice(0, options.limit);
    }
    console.log(chalk.white(`Processing ${itemsToProcess.length} items...`));

    const progress = loadProgress(PROGRESS_FILE);
    currentProgress = progress;
    console.log(chalk.gray('📊 Loaded progress:'), {
      successCount: progress.successCount,
      failedCount: progress.failedCount,
      processedCount: progress.processedUrls.size,
      failedTracked: progress.failedUrls.size
    });

    const alreadyProcessed = itemsToProcess.filter(item => item.url && progress.processedUrls.has(item.url));
    const previouslyFailed = itemsToProcess.filter(item => item.url && progress.failedUrls.has(item.url));

    if (options.retryFailed) {
      if (alreadyProcessed.length > 0) {
        console.log(chalk.gray(`Ignoring ${alreadyProcessed.length} items already marked successful in progress tracking`));
      }
      if (previouslyFailed.length === 0) {
        console.log(chalk.yellow('No failed URLs recorded in progress.json to retry.'));
        saveProgress(PROGRESS_FILE, progress);
        return;
      }
      console.log(chalk.white(`Retrying ${previouslyFailed.length} previously failed item(s)`));
      itemsToProcess = previouslyFailed;
    } else {
      if (alreadyProcessed.length > 0) {
        console.log(chalk.gray(`Skipping ${alreadyProcessed.length} items already processed in progress tracking`));
      }
      if (previouslyFailed.length > 0) {
        console.log(chalk.gray(`Skipping ${previouslyFailed.length} items previously failed. Run with --retry-failed to retry them.`));
      }
      itemsToProcess = itemsToProcess.filter(item => item.url && !progress.processedUrls.has(item.url) && !progress.failedUrls.has(item.url));
      if (itemsToProcess.length === 0) {
        console.log(chalk.green('All items already processed or awaiting retry!'));
        saveProgress(PROGRESS_FILE, progress);
        return;
      }
    }

    const requestedWorkers = typeof options.workers === 'number' && Number.isFinite(options.workers)
      ? options.workers
      : 1;
    const workerCount = Math.max(1, requestedWorkers);
    const headlessMode = options.headless !== 'false';

    await processPocketItems({
      items: itemsToProcess,
      progress,
      vaultPath,
      workerCount,
      headless: headlessMode,
      activeExtractors,
      saveProgressSnapshot: (state) => saveProgress(PROGRESS_FILE, state),
      progressFilePath: PROGRESS_FILE
    });
  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
    if (currentProgress) {
      saveProgress(PROGRESS_FILE, currentProgress);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(chalk.red('Unhandled error in main:'), err);
    process.exit(1);
  });
}
