import fs from 'fs';
import csv from 'csv-parser';
import { PocketItem } from '../types';

export function parsePocketCSV(filePath: string): Promise<PocketItem[]> {
  return new Promise((resolve, reject) => {
    const results: PocketItem[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        // Only process if URL is present
        if (data['url']) {
          results.push({
            title: data['title'] || '',
            url: data['url'],
            time_added: data['time_added'],
            tags: data['tags'] || '',
            status: data['status'] === 'unread' ? 'unread' : 'archive',
          });
        }
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
} 