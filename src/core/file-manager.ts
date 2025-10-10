import fs from 'fs';
import path from 'path';
import { PocketItem } from '../types';

export interface ConversionResult {
  item: PocketItem;
  success: boolean;
  error?: string;
  outputPath?: string;
}

export function writeMarkdownToVault(
  vaultRoot: string,
  item: PocketItem,
  markdown: string,
  extractedTitle?: string
): string {
  const folder = item.status === 'unread' ? 'unread' : 'archive';
  const clippingsDir = path.join(vaultRoot, 'Clippings', folder);
  if (!fs.existsSync(clippingsDir)) {
    fs.mkdirSync(clippingsDir, { recursive: true });
  }
  const effectiveTitle = extractedTitle?.trim() || item.title || 'untitled';
  const sanitizedTitle = effectiveTitle.replace(/[\/:*?"<>|]/g, '').trim() || 'untitled';
  let filename = `${sanitizedTitle}.md`;
  let filePath = path.join(clippingsDir, filename);
  if (fs.existsSync(filePath)) {
    filename = `${sanitizedTitle} - ${item.time_added}.md`;
    filePath = path.join(clippingsDir, filename);
  }
  fs.writeFileSync(filePath, markdown, 'utf8');
  return filePath;
}
