// Chapter text arrives from many sources: typed directly, or pasted from
// Word / web pages / other novel sites. Pasted rich text carries structural
// HTML ("<div>", "<br>", "&nbsp;"…) that the reader used to print as LITERAL
// text between the sentences. Convert that markup into real line breaks and
// plain characters so a chapter always reads exactly like the uploaded
// original. Inline tags the editor understands (<b>/<i>/<u>/<img>) pass
// through untouched — the reader's sanitizer handles them.
//
// Layout rule: every non-empty line becomes its own paragraph with exactly
// one blank line before the next. The reader renders each paragraph as a
// separate block with generous spacing, so chapters always read with wide,
// comfortable gaps between lines — no matter how the text was pasted.
export function normalizeChapterText(raw: string): string {
  if (!raw) return '';

  let text = raw;
  // Structural markup or entities pasted along with the text
  if (/<\/?(div|p|br|span)\b|&(nbsp|amp|lt|gt|quot|#39);/i.test(text)) {
    text = text
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
      .replace(/&amp;/gi, '&');
  } else {
    text = text.replace(/\r\n?/g, '\n');
  }

  // One paragraph per line, always separated by a single blank line.
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n\n');
}
