import * as puppeteer from 'puppeteer';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';
// @ts-ignore
import { gfm } from 'turndown-plugin-gfm';
import { ExtractedContent } from '../types';

interface ContentExtractorOptions {
  headless?: boolean;
  logHandler?: (level: 'warn' | 'info', context: string | undefined, message: string) => void;
}

export class ContentExtractor {
  private turndownService: TurndownService;
  private browser: puppeteer.Browser | null = null;
  private options: ContentExtractorOptions;
  private extractionCount: number = 0;
  private readonly BROWSER_RESTART_INTERVAL = 50; // Restart browser every 50 extractions
  private readonly MAX_EXTRACTION_ATTEMPTS = 3;
  private readonly domPurify = createDOMPurify(new JSDOM('').window as unknown as any);
  private readonly logHandler?: (level: 'warn' | 'info', context: string | undefined, message: string) => void;

  constructor(options: ContentExtractorOptions = {}) {
    this.options = {
      headless: true,
      ...options
    };
    this.logHandler = this.options.logHandler;
    
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
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage', // Overcome limited resource problems
          '--disable-gpu',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--ignore-certificate-errors', // Ignore SSL certificate errors
          '--ignore-certificate-errors-spki-list',
          '--ignore-ssl-errors',
          '--allow-running-insecure-content',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-extensions',
          '--no-first-run',
          '--disable-default-apps',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-client-side-phishing-detection',
          '--disable-component-extensions-with-background-pages',
          '--disable-ipc-flooding-protection',
          '--allow-insecure-localhost',
          '--ignore-urlfetcher-cert-requests'
        ]
      });
    }
    return this.browser;
  }

  private async restartBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    // Browser will be recreated on next getBrowser() call
    this.extractionCount = 0;
  }

  async extractContent(url: string, context?: string): Promise<ExtractedContent> {
    let lastError: unknown = null;
    
    for (let attempt = 1; attempt <= this.MAX_EXTRACTION_ATTEMPTS; attempt++) {
      try {
        return await this.performExtraction(url, url, context);
      } catch (error: any) {
        lastError = error;
        if (attempt < this.MAX_EXTRACTION_ATTEMPTS) {
          try {
            await this.restartBrowser();
          } catch (restartError) {
            const restartMessage = restartError instanceof Error ? restartError.message : String(restartError);
            this.logWarn(context, `Failed to restart browser before retrying ${url}: ${restartMessage}`);
          }
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
    }
    
    const finalMessage = lastError
      ? lastError instanceof Error
        ? lastError.message
        : String(lastError)
      : 'Unknown error';
    
    throw new Error(`Content extraction failed for ${url} after ${this.MAX_EXTRACTION_ATTEMPTS} attempts: ${finalMessage}`);
  }

  private async performExtraction(
    targetUrl: string,
    domainSourceUrl: string,
    context?: string
  ): Promise<ExtractedContent> {
    if (this.extractionCount >= this.BROWSER_RESTART_INTERVAL) {
      await this.restartBrowser();
    }
    
    const browser = await this.getBrowser();
    let page: puppeteer.Page | null = null;
    let requestHandler: ((req: puppeteer.HTTPRequest) => void) | null = null;
    
    try {
      page = await browser.newPage();
      
      // Set reasonable resource limits
      await page.setDefaultNavigationTimeout(30000);
      await page.setDefaultTimeout(30000);
      
      // Block unnecessary resources to speed up loading and reduce memory usage
      await page.setRequestInterception(true);
      requestHandler = (req: puppeteer.HTTPRequest) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      };
      page.on('request', requestHandler);
      
      // Navigate to the page with retry logic
      let navigationSuccess = false;
      let navigationAttempts = 0;
      const maxNavigationAttempts = 2;
      
      while (!navigationSuccess && navigationAttempts < maxNavigationAttempts) {
        try {
          navigationAttempts++;
          await page.goto(targetUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 20000
          });
          navigationSuccess = true;
        } catch (err: any) {
          if (navigationAttempts === maxNavigationAttempts) {
            const message = err?.message || String(err);
            const isSSLError = message && (
              message.includes('SSL') || 
              message.includes('certificate') ||
              message.includes('CERT_') ||
              message.includes('ERR_CERT')
            );
            const errorContext = isSSLError ? ' (SSL certificate issue - ignoring)' : '';
            throw new Error(`Failed to navigate to ${targetUrl} after ${maxNavigationAttempts} attempts: ${message}${errorContext}`);
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      const collectedMetaTags = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('meta')).map((meta) => ({
          name: meta.getAttribute('name'),
          property: meta.getAttribute('property'),
          'http-equiv': meta.getAttribute('http-equiv'),
          content: meta.getAttribute('content')
        }));
      });

      let result: {
        title: string;
        content: string;
        description?: string;
        author?: string;
        published?: string;
        favicon?: string;
        image?: string;
        wordCount?: number;
        metaTags?: any[];
      };
      
      try {
        await page.addScriptTag({
          url: 'https://unpkg.com/defuddle@0.6.6/dist/index.js'
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        result = await page.evaluate(() => {
          // @ts-ignore - Defuddle is now available in browser context
          const Defuddle = (window as any).Defuddle;
          if (!Defuddle) {
            throw new Error('Defuddle not available in browser context');
          }
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
      } catch (injectionError) {
        const injectionMessage = injectionError instanceof Error
          ? injectionError.message
          : String(injectionError ?? '');
        
        if (this.isTrustedTypesViolation(injectionError)) {
          this.logWarn(context, `Defuddle injection blocked by Trusted Types for ${targetUrl}, falling back to server-side parsing.`);
          const html = await page.content();
          result = await this.parseWithServerSideDefuddle(html, targetUrl);
        } else if (this.isScriptLoadFailure(injectionMessage)) {
          this.logWarn(context, `Defuddle script failed to load for ${targetUrl}, falling back to server-side parsing.`);
          const html = await page.content();
          result = await this.parseWithServerSideDefuddle(html, targetUrl);
        } else if (this.isDefuddleUnavailable(injectionMessage)) {
          this.logWarn(context, `Defuddle unavailable in browser context for ${targetUrl}, falling back to server-side parsing.`);
          const html = await page.content();
          result = await this.parseWithServerSideDefuddle(html, targetUrl);
        } else {
          throw injectionError;
        }
      }
      
      const cleanedHtml = this.cleanHtml(result.content);
      const markdown = this.turndownService.turndown(cleanedHtml);
      const finalUrl = page.url();
      
      this.extractionCount++;
      
      return {
        title: result.title || '',
        content: markdown,
        description: result.description || '',
        author: result.author || '',
        published: result.published || '',
        domain: this.extractDomain(domainSourceUrl),
        favicon: result.favicon || '',
        image: result.image || '',
        wordCount: typeof result.wordCount === 'number' ? result.wordCount : markdown.split(/\s+/).filter(Boolean).length,
        metaTags: [
          ...(Array.isArray(result.metaTags) ? result.metaTags : []),
          ...collectedMetaTags
        ],
        finalUrl
      };
      
    } catch (err: any) {
      const message = err?.message || String(err);
      const isSSLError = message && (
        message.includes('SSL') || 
        message.includes('certificate') ||
        message.includes('CERT_') ||
        message.includes('ERR_CERT') ||
        message.includes('ERR_SSL') ||
        message.includes('CERTIFICATE_VERIFY_FAILED') ||
        message.includes('self signed certificate') ||
        message.includes('unable to verify the first certificate')
      );
      
      if (isSSLError) {
        throw new Error(`SSL certificate error for ${targetUrl} (this should be ignored by browser settings): ${message}`);
      } else {
        throw new Error(`Content extraction failed for ${targetUrl}: ${message}`);
      }
    } finally {
      if (page) {
        if (requestHandler) {
          try {
            page.off('request', requestHandler);
          } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logWarn(context, `Error removing request handler: ${msg}`);
          }
        }
        
        if (!page.isClosed()) {
          try {
            await page.setRequestInterception(false);
          } catch (err: any) {
            const message = err?.message || String(err);
            // Ignore protocol errors that surface when the page is already shutting down
            if (!message.includes('Fetch.disable')) {
              const msg = err instanceof Error ? err.message : String(err);
              this.logWarn(context, `Error disabling request interception: ${msg}`);
            }
          }
        }
        
        try {
          await page.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logWarn(context, `Error closing page: ${msg}`);
        }
      }
    }
  }

  private cleanHtml(html: string): string {
    const sanitized = this.domPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['script', 'style'],
      FORBID_ATTR: ['style', 'onload', 'onerror', 'onclick', 'onmouseover', 'onfocus']
    });
    return typeof sanitized === 'string' ? sanitized : String(sanitized);
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
  
  private isTrustedTypesViolation(error: unknown): boolean {
    const message = error instanceof Error
      ? error.message
      : String(error ?? '');
    return /TrustedScript|Trusted\s*Types|TrustedType/i.test(message);
  }
  
  private isDefuddleUnavailable(message: string): boolean {
    return /Defuddle (not available|is not available|is not defined)/i.test(message);
  }
  
  private isScriptLoadFailure(message: string): boolean {
    return /Could not load script|Script loading failed|Failed to load/i.test(message);
  }
  
  
  private async parseWithServerSideDefuddle(html: string, url: string) {
    const defuddleModule = await import('defuddle');
    const defuddleExports: any = defuddleModule;
    const DefuddleCtor = defuddleExports.default || defuddleExports.Defuddle || defuddleExports;
    if (typeof DefuddleCtor !== 'function') {
      throw new Error('Defuddle module did not export a constructor');
    }
    const dom = new JSDOM(html, { url });
    
    try {
      const defuddled = new DefuddleCtor(dom.window.document).parse();
      return {
        title: defuddled.title || '',
        content: defuddled.content || '',
        description: defuddled.description,
        author: defuddled.author,
        published: defuddled.published,
        favicon: defuddled.favicon,
        image: defuddled.image,
        wordCount: typeof defuddled.wordCount === 'number' ? defuddled.wordCount : undefined,
        metaTags: defuddled.metaTags || []
      };
    } finally {
      dom.window.close();
    }
  }

  private logWarn(context: string | undefined, message: string): void {
    if (this.logHandler) {
      this.logHandler('warn', context, message);
      return;
    }
    if (context) {
      console.warn(`${context} ${message}`);
    } else {
      console.warn(message);
    }
  }
}

// TypeScript module declarations for missing types
// @ts-ignore
declare module 'turndown-plugin-gfm';
// @ts-ignore
declare module 'jsdom'; 
// @ts-ignore
declare module 'defuddle';
