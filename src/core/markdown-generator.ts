import { ExtractedContent, PocketItem } from '../types';

function escapeYamlString(raw: string): string {
  return raw
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, '\\n');
}

function formatDate(value: string): string {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return value;
  }

  // Unix timestamp in seconds or milliseconds
  if (/^\d+$/.test(trimmed)) {
    const num = Number(trimmed);
    if (!Number.isNaN(num)) {
      const date = new Date(trimmed.length >= 13 ? num : num * 1000);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
      }
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return value;
}

export function generateMarkdown(item: PocketItem, content: ExtractedContent): string {
  const title = escapeYamlString(content.title || item.title || '');
  const description = escapeYamlString(content.description || '');
  const tags = (item.tags || '')
    .split('|')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);
  const frontmatterLines = [
    '---',
    `title: "${title}"`,
    `url: ${item.url}`,
    `date_added: ${formatDate(item.time_added)}`,
    `status: ${item.status}`,
    `domain: ${content.domain}`,
    `description: "${description}"`
  ];

  if (item.time_to_read) {
    frontmatterLines.push(`time_to_read: "${escapeYamlString(item.time_to_read)}"`);
  }

  if (tags.length > 0) {
    const escapedTags = tags.map(tag => `"${escapeYamlString(tag)}"`).join(', ');
    frontmatterLines.push(`tags: [${escapedTags}]`);
  }

  frontmatterLines.push('---');
  const frontmatter = frontmatterLines.join('\n');
  
  return `${frontmatter}\n\n${content.content}`;
} 
