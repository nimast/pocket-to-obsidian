import path from 'path';
import chalk from 'chalk';

import { PocketItem } from '../types';
import { ContentExtractor } from './content-extractor';
import { generateMarkdown } from './markdown-generator';
import { writeMarkdownToVault, ConversionResult } from './file-manager';
import { extractTagsFromContent, mergeTags } from '../utils/tag-extractor';
import { formatError } from '../utils/error';
import { assessContentValidity } from '../utils/content-validation';
import { estimateTimeToRead } from '../utils/time-to-read';
import { ProgressState } from '../utils/progress';
import { ProgressReporter } from '../utils/progress-reporter';

const MAX_CONSECUTIVE_FAILURES = 10;

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export interface ProcessPocketItemsConfig {
  items: PocketItem[];
  progress: ProgressState;
  vaultPath: string;
  workerCount: number;
  headless: boolean;
  activeExtractors: Set<ContentExtractor>;
  saveProgressSnapshot: (state: ProgressState) => void;
  progressFilePath: string;
}

export interface ProcessingOutcome {
  results: ConversionResult[];
}

export async function processPocketItems({
  items,
  progress,
  vaultPath,
  workerCount,
  headless,
  activeExtractors,
  saveProgressSnapshot,
  progressFilePath
}: ProcessPocketItemsConfig): Promise<ProcessingOutcome> {
  const results: ConversionResult[] = [];
  const totalItems = items.length;
  const resolvedWorkerCount = Math.max(1, Number.isFinite(workerCount) ? workerCount : 1);
  const headlessMode = headless;
  let nextIndex = 0;

  console.log(chalk.white(`Workers: ${resolvedWorkerCount} (headless ${headlessMode ? 'on' : 'off'})`));

  const progressReporter = totalItems > 0 ? await ProgressReporter.create({ total: totalItems }) : null;
  const withProgressLog = (action: () => void): void => {
    if (progressReporter) {
      progressReporter.withTemporaryPause(action);
    } else {
      action();
    }
  };

  const createExtractor = (): ContentExtractor => {
    const instance = new ContentExtractor({
      headless: headlessMode,
      logHandler: (level, context, message) => {
        withProgressLog(() => {
          const prefix = context ? `${context} ` : '';
          const text = `${prefix}${message}`;
          if (level === 'warn') {
            console.warn(text);
          } else {
            console.log(text);
          }
        });
      }
    });
    activeExtractors.add(instance);
    return instance;
  };

  async function runWorker(workerId: number): Promise<void> {
    const workerTag = resolvedWorkerCount > 1 ? `[W${workerId + 1}]` : '';
    let extractor = createExtractor();
    let consecutiveFailures = 0;

    try {
      while (true) {
        const currentIndexLocal = nextIndex++;
        if (currentIndexLocal >= totalItems) {
          break;
        }

        const item = items[currentIndexLocal];
        if (!item?.url) {
          continue;
        }

        const progressLabel = `[${currentIndexLocal + 1}/${totalItems}]`;
        const contextLabel = `${workerTag}${progressLabel}`;
        const logPrefix = `${contextLabel} `;
        const isRetry = results.some(r => r.item.url === item.url);

        const action = isRetry ? 'Retry' : 'Clip';
        const title = item.title || '(untitled)';

        try {
          const content = await extractor.extractContent(item.url, contextLabel);
          const bodyMarkdown = (content.content || '').trim();
          const wordCount = bodyMarkdown ? bodyMarkdown.split(/\s+/).filter(Boolean).length : 0;
          const charCount = bodyMarkdown.length;
          const finalUrl = content.finalUrl || item.url;

          const validationResult = assessContentValidity({
            bodyMarkdown,
            wordCount,
            charCount,
            finalUrl,
            title: content.title,
            description: content.description,
            domain: content.domain
          });

          if (!validationResult.isValid) {
            const reason = validationResult.reason || 'insufficient content';
            throw new Error(`Content invalid after extraction (${reason}, words: ${wordCount}, chars: ${charCount})`);
          }

          const effectiveTimeToRead = estimateTimeToRead(item.time_to_read, content.content, wordCount);
          const autoTags = extractTagsFromContent(content);
          const mergedTags = mergeTags(item.tags, autoTags);
          const itemWithEnhancements: PocketItem = {
            ...item,
            time_to_read: effectiveTimeToRead,
            tags: mergedTags
          };
          const markdown = generateMarkdown(itemWithEnhancements, content);
          const outputPath = writeMarkdownToVault(vaultPath, itemWithEnhancements, markdown, content.title);

          progress.successCount++;
          progress.processedUrls.add(item.url);
          const recoveredFromFailures = progress.failedUrls.delete(item.url);
          consecutiveFailures = 0;
          progressReporter?.incrementSuccess();

          const successResult: ConversionResult = {
            item: itemWithEnhancements,
            success: true,
            outputPath
          };
          const existingIndex = results.findIndex(r => r.item.url === item.url);
          if (existingIndex >= 0) {
            results[existingIndex] = successResult;
          } else {
            results.push(successResult);
          }

          const successTitle = itemWithEnhancements.title || '(untitled)';
          withProgressLog(() => {
            const recoveredNote = recoveredFromFailures ? chalk.gray(' (recovered)') : '';
            console.log(
              chalk.green(`${logPrefix}✅ ${action}: ${successTitle}`) +
                chalk.gray(` ${finalUrl}`) +
                recoveredNote
            );
          });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error';

          if (!progress.failedUrls.has(item.url)) {
            progress.failedCount++;
          }
          progress.failedUrls.add(item.url);
          consecutiveFailures++;
          progressReporter?.incrementFailure();

          const failureResult: ConversionResult = {
            item,
            success: false,
            error: errorMessage
          };
          const existingIndex = results.findIndex(r => r.item.url === item.url);
          if (existingIndex >= 0) {
            results[existingIndex] = failureResult;
          } else {
            results.push(failureResult);
          }

          const conciseError =
            errorMessage.length > 120 ? `${errorMessage.slice(0, 117)}…` : errorMessage;
          withProgressLog(() => {
            console.log(
              chalk.red(`${logPrefix}❌ ${action}: ${item.title || '(untitled)'} — ${conciseError}`) +
                chalk.gray(` ${item.url}`)
            );
          });

          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            withProgressLog(() => {
              console.log(
                chalk.yellow(
                  `${logPrefix}🔄 ${consecutiveFailures} consecutive failures detected. Restarting browser and taking a break...`
                )
              );
            });
            try {
              await extractor.close();
            } catch (closeError) {
              withProgressLog(() => {
                console.error(chalk.red(`${logPrefix}Failed to close extractor during restart: ${formatError(closeError)}`));
              });
            } finally {
              activeExtractors.delete(extractor);
            }
            extractor = createExtractor();
            consecutiveFailures = 0;
            await sleep(5000);
          }
        }

        saveProgressSnapshot(progress);
        await sleep(500);
      }
    } finally {
      try {
        await extractor.close();
      } catch (closeError) {
        withProgressLog(() => {
          console.error(chalk.red(`${workerTag ? `${workerTag} ` : ''}Failed to close extractor:`), formatError(closeError));
        });
      } finally {
        activeExtractors.delete(extractor);
      }
    }
  }

  const workerPromises = Array.from({ length: resolvedWorkerCount }, (_, workerId) => runWorker(workerId));
  await Promise.all(workerPromises);

  saveProgressSnapshot(progress);

  const successful = results.filter(r => r.success).length;
  const failedResults = results.filter(r => !r.success);
  const failed = failedResults.length;

  progressReporter?.finish();

  console.log(chalk.blue('Summary'));
  console.log(chalk.blue('======='));
  console.log(chalk.green(`✓ Successful: ${successful}`));
  console.log(chalk.red(`✗ Failed: ${failed}`));
  console.log(chalk.white(`💾 Progress saved to: ${progressFilePath}`));
  console.log(
    chalk.gray(
      `🎉 Total processed: ${progress.processedUrls.size} items (${progress.successCount} success, ${progress.failedCount} failed attempts)`
    )
  );
  console.log(chalk.yellow(`🚧 Failed URLs tracked: ${progress.failedUrls.size}`));

  if (failed > 0) {
    console.log(chalk.yellow('\nFailed items:'));
    failedResults.forEach(r => {
      console.log(chalk.yellow(`  - ${r.item.title || '(untitled)'}: ${r.error}`));
    });
    console.log(chalk.blue('\n💡 Tip: Run again with --retry-failed after addressing issues to attempt them again.'));
  }

  return { results };
}
