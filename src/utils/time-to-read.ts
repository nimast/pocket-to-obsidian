const READING_PATTERNS = [
  /estimated (?:reading|read) time[:\s-]?\s*(\d+)\s*(minutes?|minute|mins?|hours?|hour)/i,
  /reading time[:\s-]?\s*(\d+)\s*(minutes?|minute|mins?|hours?|hour)/i,
  /read time[:\s-]?\s*(\d+)\s*(minutes?|minute|mins?|hours?|hour)/i,
  /time to read[:\s-]?\s*(\d+)\s*(minutes?|minute|mins?|hours?|hour)/i,
  /(\d+)\s*(minutes?|minute|mins?|hours?|hour)\s+(?:to\s+)?read/i,
  /\b(\d+)\s*min(?:ute)?s?\s+read\b/i,
  /\bread\s*time\s*[:\-]?\s*(\d+)\s*(minutes?|minute|mins?|hours?|hour)/i,
  /\bread\s+in\s*(\d+)\s*(minutes?|minute|mins?|hours?|hour)/i,
  /estimated to read in.*?(\d+)\s*(minutes?|minute|mins?|hours?|hour)/i
];

export function estimateTimeToRead(
  existingTimeToRead: string | null | undefined,
  bodyContent: string | null | undefined,
  wordCount: number
): string {
  if (existingTimeToRead) {
    return existingTimeToRead;
  }

  const minutes = Math.max(1, Math.round(wordCount / 200));
  const wordBasedEstimate = `${minutes} minute${minutes === 1 ? '' : 's'}`;

  const sourceText = bodyContent || '';
  for (const pattern of READING_PATTERNS) {
    const match = pattern.exec(sourceText);
    if (match) {
      return `${match[1]} ${match[2].toLowerCase()}`;
    }
  }

  return wordBasedEstimate;
}
