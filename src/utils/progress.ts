import fs from 'fs';

export interface ProgressState {
  processedUrls: Set<string>;
  failedUrls: Set<string>;
  successCount: number;
  failedCount: number;
}

interface PersistedProgress {
  processedUrls?: string[];
  failedUrls?: string[];
  successCount?: number;
  failedCount?: number;
  lastSaved?: string;
}

export function loadProgress(filePath: string): ProgressState {
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as PersistedProgress;
      return {
        processedUrls: new Set(data.processedUrls || []),
        failedUrls: new Set(data.failedUrls || []),
        successCount: data.successCount || 0,
        failedCount: data.failedCount || 0
      };
    }
  } catch (error) {
    console.warn('Could not load progress file, starting fresh:', error);
  }
  return {
    processedUrls: new Set(),
    failedUrls: new Set(),
    successCount: 0,
    failedCount: 0
  };
}

export function saveProgress(filePath: string, progress: ProgressState): void {
  const data: PersistedProgress = {
    processedUrls: Array.from(progress.processedUrls),
    failedUrls: Array.from(progress.failedUrls),
    successCount: progress.successCount,
    failedCount: progress.failedCount,
    lastSaved: new Date().toISOString()
  };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}
