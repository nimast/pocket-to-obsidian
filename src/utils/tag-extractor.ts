import { ExtractedContent } from '../types';
import { TAG_STOPWORDS } from './tag-stopwords';
import { TAG_SYNONYM_MAP } from './tag-synonyms';

const KEYWORD_PARAGRAPH_LIMIT = 3;
const KEYWORD_MIN_LENGTH = 4;
const KEYWORD_MIN_FREQUENCY = 2;
const KEYWORD_MAX_RESULTS = 5;

const SYNONYM_MAP = TAG_SYNONYM_MAP;

export function extractTagsFromContent(content: ExtractedContent): string[] {
  const candidates: string[] = [];
  const meta = Array.isArray(content.metaTags) ? content.metaTags : [];

  meta.forEach((entry: any) => {
    if (!entry) {
      return;
    }
    const rawName = String(entry.name ?? entry.property ?? entry['http-equiv'] ?? '').toLowerCase();
    const rawValue = String(entry.content ?? entry.value ?? '').trim();
    if (!rawValue) {
      return;
    }

    const addValues = (value: string) => {
      value
        .split(/[,;|]/)
        .forEach(tag => collectTagCandidate(candidates, tag));
    };

    if (rawName.includes('keyword')) {
      addValues(rawValue);
    } else if (
      rawName.endsWith(':tag') ||
      rawName === 'tag' ||
      rawName === 'article:tag' ||
      rawName === 'news:tag' ||
      rawName === 'category'
    ) {
      addValues(rawValue);
    }
  });

  const bodyKeywords = extractKeywordsFromContent(content);
  bodyKeywords.forEach(tag => collectTagCandidate(candidates, tag));

  return Array.from(
    candidates.reduce((acc, tag) => {
      const key = createSemanticKey(tag);
      if (!key) {
        return acc;
      }
      if (!acc.has(key)) {
        acc.set(key, tag);
      }
      return acc;
    }, new Map<string, string>()).values()
  ).slice(0, 10);
}

export function mergeTags(existing: string, extras: string[]): string {
  const normalized = new Map<string, string>();

  const processTag = (value: string) => {
    const buffer: string[] = [];
    collectTagCandidate(buffer, value);
    buffer.forEach(tag => {
      const key = createSemanticKey(tag);
      if (key && !normalized.has(key)) {
        normalized.set(key, tag);
      }
    });
  };

  (existing || '')
    .split('|')
    .map(tag => tag.trim())
    .filter(Boolean)
    .forEach(processTag);

  extras.forEach(processTag);

  return Array.from(normalized.values()).join('|');
}

function extractKeywordsFromContent(content: ExtractedContent): string[] {
  const textBlocks = [`${content.title || ''}`, content.content || '']
    .join('\n')
    .split(/\n{2,}/)
    .map(block => block.replace(/^#+\s*/gm, '').trim())
    .filter(Boolean)
    .slice(0, KEYWORD_PARAGRAPH_LIMIT);

  if (textBlocks.length === 0) {
    return [];
  }

  const combinedText = textBlocks.join('\n');
  const retextKeywords = extractKeywordsWithRetext(combinedText);
  const fallbackKeywords = retextKeywords.length >= KEYWORD_MAX_RESULTS
    ? []
    : extractKeywordsFallback(combinedText);

  const combined = [...retextKeywords, ...fallbackKeywords];
  const unique = new Map<string, string>();
  combined.forEach(tag => {
    const normalized = tag.toLowerCase();
    if (!unique.has(normalized)) {
      unique.set(normalized, tag);
    }
  });

  return Array.from(unique.values()).slice(0, KEYWORD_MAX_RESULTS);
}

function extractKeywordsWithRetext(text: string): string[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { unified } = require('unified');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const retextEnglish = require('retext-english');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const retextKeywords = require('retext-keywords');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { toString } = require('nlcst-to-string');

    const file = unified().use(retextEnglish).use(retextKeywords).processSync(text);
    const data = file.data as { keywords?: any[]; keyphrases?: any[] };
    const results: { value: string; score: number }[] = [];

    if (Array.isArray(data?.keywords)) {
      data.keywords.forEach(keyword => {
        if (keyword?.matches?.length) {
          const value = toString(keyword.matches[0].node);
          results.push({ value, score: keyword.score ?? 1 });
        }
      });
    }

    if (Array.isArray(data?.keyphrases)) {
      data.keyphrases.forEach(phrase => {
        if (phrase?.matches?.length) {
          const match = phrase.matches[0];
          const value = Array.isArray(match.nodes)
            ? match.nodes.map((node: unknown) => toString(node)).join('')
            : toString(match.node);
          results.push({ value, score: phrase.score ?? 1 });
        }
      });
    }

    const normalized = new Map<string, { value: string; score: number }>();
    results.forEach(({ value, score }) => {
      const cleaned = cleanKeyword(value);
      if (!cleaned || cleaned.length < KEYWORD_MIN_LENGTH) {
        return;
      }
      const key = cleaned.toLowerCase();
      const existing = normalized.get(key);
      if (!existing || existing.score < score) {
        normalized.set(key, { value: cleaned, score });
      }
    });

    return Array.from(normalized.values())
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.value)
      .slice(0, KEYWORD_MAX_RESULTS);
  } catch {
    return [];
  }
}

function extractKeywordsFallback(text: string): string[] {
  const tokens = text.toLowerCase().match(/[a-z][a-z0-9]+/g) || [];
  const frequencies = new Map<string, { count: number; original: string }>();

  tokens.forEach(token => {
    if (token.length < KEYWORD_MIN_LENGTH) return;
    if (TAG_STOPWORDS.has(token)) return;
    const existing = frequencies.get(token);
    if (existing) {
      existing.count += 1;
    } else {
      frequencies.set(token, { count: 1, original: token });
    }
  });

  const cleanedKeywords: string[] = [];

  Array.from(frequencies.entries())
    .filter(([, info]) => info.count >= KEYWORD_MIN_FREQUENCY)
    .sort((a, b) => b[1].count - a[1].count)
    .some(([, info]) => {
      const cleaned = cleanKeyword(info.original);
      if (!cleaned) {
        return cleanedKeywords.length >= KEYWORD_MAX_RESULTS;
      }
      collectTagCandidate(cleanedKeywords, cleaned);
      if (cleanedKeywords.length > KEYWORD_MAX_RESULTS) {
        cleanedKeywords.length = KEYWORD_MAX_RESULTS;
      }
      return cleanedKeywords.length >= KEYWORD_MAX_RESULTS;
    });

  return cleanedKeywords.slice(0, KEYWORD_MAX_RESULTS);
}

function cleanKeyword(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = value
    .replace(/[“”"']/g, '')
    .replace(/^[^\w]+|[^\w]+$/g, '')
    .trim();
  if (!cleaned || cleaned.length < KEYWORD_MIN_LENGTH) {
    return undefined;
  }
  return canonicalizeTag(cleaned);
}

function collectTagCandidate(target: string[], raw: string): void {
  if (!raw) return;
  const seenKeys = new Set(target.map(createSemanticKey).filter(Boolean) as string[]);

  const pushCandidate = (candidate: string | undefined) => {
    if (!candidate) return;
    const key = createSemanticKey(candidate);
    if (!key || seenKeys.has(key)) {
      return;
    }
    target.push(candidate);
    seenKeys.add(key);
  };

  pushCandidate(canonicalizeTag(raw));

  raw
    .split(/[\s/_]+/)
    .map(token => token.replace(/^[^\w]+|[^\w]+$/g, '').trim())
    .filter(Boolean)
    .forEach(token => pushCandidate(canonicalizeTag(token)));
}

function canonicalizeTag(tag: string): string | undefined {
  if (!tag) return undefined;

  const normalized = stripDiacritics(tag.toLowerCase());
  const collapsed = normalized.replace(/[^a-z0-9]+/g, '');
  const directSynonym = SYNONYM_MAP[collapsed] ?? SYNONYM_MAP[normalized.trim()];
  if (directSynonym) {
    return directSynonym;
  }

  let canonical = normalized
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!canonical) {
    return undefined;
  }

  const synonym = SYNONYM_MAP[canonical];
  if (synonym) {
    canonical = synonym;
  }

  canonical = canonical
    .split('-')
    .map(segment => singularizeSegment(segment))
    .join('-');

  const postSingularSynonym = SYNONYM_MAP[canonical];
  if (postSingularSynonym) {
    canonical = postSingularSynonym;
  }

  if (
    canonical.length < KEYWORD_MIN_LENGTH ||
    (!canonical.includes('-') && TAG_STOPWORDS.has(canonical))
  ) {
    return undefined;
  }

  return canonical;
}

function singularizeSegment(segment: string): string {
  if (segment.length <= 3) {
    return segment;
  }
  if (segment.endsWith('ies') && segment.length > 4) {
    return segment.slice(0, -3) + 'y';
  }
  if (segment.endsWith('ses') || segment.endsWith('xes') || segment.endsWith('zes')) {
    return segment.slice(0, -2);
  }
  if (segment.endsWith('s') && !segment.endsWith('ss')) {
    return segment.slice(0, -1);
  }
  return segment;
}

function stripDiacritics(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function createSemanticKey(tag: string): string | undefined {
  if (!tag) {
    return undefined;
  }
  return tag.toLowerCase().replace(/[^a-z0-9]/g, '');
}
