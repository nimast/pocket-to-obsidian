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
          const timeTagsRaw = data['tags'] || '';
          const firstTag = timeTagsRaw.split('|')[0].trim();
          const TIME_TAG_REGEX = /^\d+\s*(minutes?|minute|hours?|hour)$/i;
          const timeToRead = TIME_TAG_REGEX.test(firstTag) ? firstTag : undefined;

          results.push({
            title: data['title'] || '',
            url: data['url'],
            time_added: data['time_added'],
            tags: timeTagsRaw,
            status: data['status'] === 'unread' ? 'unread' : 'archive',
            time_to_read: timeToRead,
          });
        }
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
} 
