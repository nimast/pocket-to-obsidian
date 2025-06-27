import * as puppeteer from 'puppeteer';
import TurndownService from 'turndown';
// @ts-ignore
import { gfm } from 'turndown-plugin-gfm';
import { ExtractedContent } from '../types';

interface ContentExtractorOptions {
  headless?: boolean;
}

export class ContentExtractor {
  private turndownService: TurndownService;
  private browser: puppeteer.Browser | null = null;
  private options: ContentExtractorOptions;

  constructor(options: ContentExtractorOptions = {}) {
    this.options = {
      headless: true,
      ...options
    };
    
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });
    this.turndownService.use(gfm);
  }

  private async getBrowser(): Promise<puppeteer.Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: this.options.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    return this.browser;
  }

  async extractContent(url: string): Promise<ExtractedContent> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    
    try {
      // Navigate to the page
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Inject Defuddle from CDN
      await page.addScriptTag({
        url: 'https://unpkg.com/defuddle@0.6.4/dist/index.js'
      });
      
      // Extract content in browser context using the real document
      const result = await page.evaluate(() => {
        // @ts-ignore - Defuddle is now available in browser context
        const Defuddle = (window as any).Defuddle;
        if (!Defuddle) {
          throw new Error('Defuddle not available in browser context');
        }
        // Use Defuddle to extract content from the real document
        const defuddled = new Defuddle(document).parse();
        return {
          title: defuddled.title,
          content: defuddled.content,
          description: defuddled.description,
          author: defuddled.author,
          published: defuddled.published,
          favicon: defuddled.favicon,
          image: defuddled.image,
          wordCount: defuddled.wordCount,
          metaTags: defuddled.metaTags || []
        };
      });
      
      // Clean HTML (mirroring Obsidian's process)
      const cleanedHtml = this.cleanHtml(result.content);
      
      // Convert to Markdown
      const markdown = this.turndownService.turndown(cleanedHtml);
      
      return {
        title: result.title,
        content: markdown,
        description: result.description,
        author: result.author,
        published: result.published,
        domain: this.extractDomain(url),
        favicon: result.favicon,
        image: result.image,
        wordCount: result.wordCount,
        metaTags: result.metaTags
      };
      
    } finally {
      await page.close();
    }
  }

  private cleanHtml(html: string): string {
    // For now, we'll do basic cleaning here
    // In a full implementation, we'd use JSDOM or similar
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/\s*style\s*=\s*["'][^"']*["']/gi, '');
  }

  private extractDomain(url: string): string {
    return new URL(url).hostname;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// TypeScript module declarations for missing types
// @ts-ignore
declare module 'turndown-plugin-gfm';
// @ts-ignore
declare module 'jsdom'; 