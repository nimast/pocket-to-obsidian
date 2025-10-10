export interface ContentValidationInput {
  bodyMarkdown: string;
  wordCount: number;
  charCount: number;
  finalUrl: string;
  title?: string | null;
  description?: string | null;
  domain?: string | null;
}

export interface ContentValidationResult {
  isValid: boolean;
  reason?: string;
}

const MIN_BODY_WORDS = 10;
const MIN_BODY_CHARS = 100;

const FAILURE_PATTERNS = [
  /\b404\b/i,
  /\b403\b/i,
  /(page|file|article) not found/i,
  /requested (?:page|resource) (?:was|is) not found/i,
  /page cannot be found/i,
  /content not available/i,
  /this page is no longer available/i,
  /temporarily unavailable/i,
  /site (?:is )?under maintenance/i,
  /access denied/i,
  /account suspended/i,
  /(post|article|content) has been removed/i,
  /does not exist/i,
  /not available in your region/i,
  /(post|item) has been deleted/i
];

const TITLE_RED_FLAGS = [
  /^home$/i,
  /^index(?: of)?$/i,
  /^redirecting/i,
  /^sign (?:in|up)/i,
  /^log ?in/i,
  /^access denied/i,
  /^verification/i,
  /^just a moment/i,
  /enable javascript/i,
  /browser (?:check|verification)/i,
  /^error/i,
  /404/i,
  /page not found/i
];

const DESCRIPTION_RED_FLAGS = [
  /login required/i,
  /you must sign in/i,
  /access denied/i,
  /page not found/i,
  /resource is unavailable/i
];

const LOGIN_HOST_TOKENS = ['login', 'signin', 'accounts', 'auth', 'account', 'idp', 'sso', 'verify', 'consent', 'error'];
const LOGIN_PATH_PATTERNS = [/\blogin\b/i, /\bsign-?in\b/i, /auth/i, /session/i, /account/i, /consent/i, /verify/i, /error/i];

export function assessContentValidity({
  bodyMarkdown,
  wordCount,
  charCount,
  finalUrl,
  title,
  description,
  domain
}: ContentValidationInput): ContentValidationResult {
  const firstWords = bodyMarkdown.split(/\s+/).slice(0, 10).join(' ');
  const loweredPreview = firstWords.toLowerCase();
  const eligibleForPatternCheck = wordCount >= MIN_BODY_WORDS * 2;
  const failedByPattern = eligibleForPatternCheck && FAILURE_PATTERNS.some(pattern => pattern.test(loweredPreview));

  const extractedTitle = (title || '').trim();
  const extractedDescription = (description || '').trim();
  const normalizedDomain = (domain || '').replace(/^www\./, '').toLowerCase();
  const normalizedTitle = extractedTitle.replace(/^www\./, '').toLowerCase();
  const titleMatchesDomain =
    normalizedTitle &&
    normalizedDomain &&
    (normalizedTitle === normalizedDomain || normalizedTitle === `${normalizedDomain}/`);

  let finalUrlHost = '';
  let finalUrlPath = '';
  try {
    const parsedFinal = new URL(finalUrl);
    finalUrlHost = parsedFinal.hostname.toLowerCase();
    finalUrlPath = parsedFinal.pathname.toLowerCase();
  } catch {
    finalUrlHost = '';
    finalUrlPath = '';
  }

  const titleRedFlag = extractedTitle && TITLE_RED_FLAGS.some(pattern => pattern.test(extractedTitle));
  const descriptionRedFlag = extractedDescription && DESCRIPTION_RED_FLAGS.some(pattern => pattern.test(extractedDescription));
  const hostLoginFlag = finalUrlHost && LOGIN_HOST_TOKENS.some(token => finalUrlHost.includes(token));
  const pathLoginFlag = LOGIN_PATH_PATTERNS.some(pattern => pattern.test(finalUrlPath));

  const shouldFail =
    wordCount < MIN_BODY_WORDS ||
    charCount < MIN_BODY_CHARS ||
    failedByPattern ||
    titleRedFlag ||
    titleMatchesDomain ||
    descriptionRedFlag ||
    hostLoginFlag ||
    pathLoginFlag;

  if (!shouldFail) {
    return { isValid: true };
  }

  let reason = 'insufficient content';
  if (failedByPattern) {
    reason = 'matched error indicator phrase';
  } else if (titleRedFlag) {
    reason = 'title matched error indicator';
  } else if (titleMatchesDomain) {
    reason = 'title matched site domain';
  } else if (descriptionRedFlag) {
    reason = 'description matched error indicator';
  } else if (hostLoginFlag || pathLoginFlag) {
    reason = 'final URL appears to be an auth/login page';
  }

  return {
    isValid: false,
    reason
  };
}
