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