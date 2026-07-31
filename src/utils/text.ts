// Chapter text arrives from many sources: typed directly, or pasted from
// Word / web pages / other novel sites. Pasted rich text carries structural
// HTML ("<div>", "<br>", "&nbsp;"…) that the reader used to print as LITERAL
// text between the sentences. Convert that markup into real line breaks and
// plain characters so a chapter always reads exactly like the uploaded
// original. Inline tags the editor understands (<b>/<i>/<u>/<img>) pass
// through untouched — the reader's sanitizer handles them.
export function normalizeChapterText(raw: string): string {
  if (!raw) return '';
  // Fast path: nothing that looks like structural markup or entities.
  if (!/<\/?(div|p|br|span)\b|&(nbsp|amp|lt|gt|quot|#39);/i.test(raw)) return raw;

  return (
    raw
      .replace(/\r\n?/g, '\n')
      // Line-break producing tags
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/div>\s*<div[^>]*>/gi, '\n')
      .replace(/<div[^>]*>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
      .replace(/<p[^>]*>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      // Purely presentational wrappers carry no meaning in plain text
      .replace(/<\/?span[^>]*>/gi, '')
      // Common HTML entities pasted along with the text
      .replace(/&nbsp;/gi, ' ')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&')
      // Tidy up: no trailing spaces, at most one blank line in a row
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

// Turn a novel's English title into a clean, URL-friendly slug so links read
// like "/novel/the-beginning-after-the-end" instead of an opaque id. Strips
// accents/punctuation, lowercases, and joins words with single hyphens.
// Returns '' when the title has no latin characters (caller falls back to id).
export function slugifyTitle(raw: string): string {
  if (!raw) return '';
  return raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // drop combining accents
    .toLowerCase()
    .replace(/['"’`]/g, '')          // drop apostrophes/quotes entirely
    .replace(/[^a-z0-9]+/g, '-')     // everything else becomes a separator
    .replace(/^-+|-+$/g, '')         // trim leading/trailing hyphens
    .slice(0, 80);                   // keep URLs reasonably short
}
