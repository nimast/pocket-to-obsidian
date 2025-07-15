import fs from 'fs';
import path from 'path';
import { slugify } from '../utils/slugify';
import { PocketItem } from '../types';

export interface ConversionResult {
  item: PocketItem;
  success: boolean;
  error?: string;
  outputPath?: string;
}

export function createOutputFolder(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputDir = path.join(process.cwd(), 'outputs', `run-${timestamp}`);
  fs.mkdirSync(outputDir, { recursive: true });
  return outputDir;
}

export function findLatestRunFolder(): string | null {
  const outputsDir = path.join(process.cwd(), 'outputs');
  if (!fs.existsSync(outputsDir)) {
    return null;
  }
  
  const runFolders = fs.readdirSync(outputsDir)
    .filter(name => name.startsWith('run-'))
    .sort()
    .reverse();
  
  return runFolders.length > 0 ? path.join(outputsDir, runFolders[0]) : null;
}

export function readPreviousResults(runFolder: string): {
  successful: Set<string>;
  failed: PocketItem[];
} {
  const successful = new Set<string>();
  const failed: PocketItem[] = [];
  
  // Read successful conversions
  const successfulPath = path.join(runFolder, 'successful.csv');
  if (fs.existsSync(successfulPath)) {
    const content = fs.readFileSync(successfulPath, 'utf8');
    const lines = content.split('\n').slice(1); // Skip header
    lines.forEach(line => {
      if (line.trim()) {
        const url = line.split(',')[1]?.replace(/"/g, '');
        if (url) successful.add(url);
      }
    });
  }
  
  // Read failed conversions
  const failedPath = path.join(runFolder, 'failed.csv');
  if (fs.existsSync(failedPath)) {
    const content = fs.readFileSync(failedPath, 'utf8');
    const lines = content.split('\n').slice(1); // Skip header
    lines.forEach(line => {
      if (line.trim()) {
        const parts = line.split(',');
        if (parts.length >= 5) {
          failed.push({
            title: parts[0]?.replace(/"/g, '') || '',
            url: parts[1]?.replace(/"/g, '') || '',
            time_added: parts[2]?.replace(/"/g, '') || '',
            tags: parts[3]?.replace(/"/g, '') || '',
            status: parts[4]?.replace(/"/g, '') as 'unread' | 'archive'
          });
        }
      }
    });
  }
  
  return { successful, failed };
}

export function writeMarkdownToVault(
  vaultRoot: string,
  item: PocketItem,
  markdown: string
): string {
  const folder = item.status === 'unread' ? 'unread' : 'archive';
  const clippingsDir = path.join(vaultRoot, 'Clippings', folder);
  if (!fs.existsSync(clippingsDir)) {
    fs.mkdirSync(clippingsDir, { recursive: true });
  }
  const filename = `${slugify(item.title) || 'untitled'}-${item.time_added}.md`;
  const filePath = path.join(clippingsDir, filename);
  fs.writeFileSync(filePath, markdown, 'utf8');
  return filePath;
}

export function writeResultsToCSV(results: ConversionResult[], outputDir: string): void {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  // Write successful conversions CSV
  if (successful.length > 0) {
    const successfulCSV = [
      'title,url,time_added,tags,status,output_path',
      ...successful.map(r => 
        `"${r.item.title}","${r.item.url}","${r.item.time_added}","${r.item.tags}","${r.item.status}","${r.outputPath}"`
      )
    ].join('\n');
    fs.writeFileSync(path.join(outputDir, 'successful.csv'), successfulCSV, 'utf8');
  }

  // Write failed conversions CSV
  if (failed.length > 0) {
    const failedCSV = [
      'title,url,time_added,tags,status,error',
      ...failed.map(r => 
        `"${r.item.title}","${r.item.url}","${r.item.time_added}","${r.item.tags}","${r.item.status}","${r.error}"`
      )
    ].join('\n');
    fs.writeFileSync(path.join(outputDir, 'failed.csv'), failedCSV, 'utf8');
  }

  // Write summary report
  const summary = {
    total: results.length,
    successful: successful.length,
    failed: failed.length,
    timestamp: new Date().toISOString(),
    outputDir
  };
  fs.writeFileSync(
    path.join(outputDir, 'summary.json'), 
    JSON.stringify(summary, null, 2), 
    'utf8'
  );
} 