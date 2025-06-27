import { ExtractedContent, PocketItem } from '../types';

export function generateMarkdown(item: PocketItem, content: ExtractedContent): string {
  const frontmatter = `---\ntitle: \"${content.title.replace(/"/g, '\"')}\"\nurl: ${item.url}\ndate_added: ${item.time_added}\nstatus: ${item.status}\ndomain: ${content.domain}\ndescription: \"${content.description.replace(/"/g, '\"')}\"\n---`;
  return `${frontmatter}\n\n${content.content}`;
} 