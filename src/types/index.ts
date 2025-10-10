export interface PocketItem {
  title: string;
  url: string;
  time_added: string;
  tags: string;
  status: 'unread' | 'archive';
  time_to_read?: string;
}

export interface ExtractedContent {
  title: string;
  content: string;
  description: string;
  author: string;
  published: string;
  domain: string;
  favicon: string;
  image: string;
  wordCount: number;
  metaTags: any[];
  finalUrl?: string;
}

export interface StructuralComparison {
  title: boolean;
  frontmatter: boolean;
  content: boolean;
} 
