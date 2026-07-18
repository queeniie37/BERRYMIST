// Chapter text arrives from many sources: typed directly, or pasted from
// Word / web pages / other novel sites. Pasted rich text carries structural
// HTML ("<div>", "<br>", "&nbsp;"…) that the reader used to print as LITERAL
// text between the sentences. Convert that markup into real line breaks and
// plain characters so a chapter always reads exactly like the editor showed
// it. Inline tags the editor understands (<b>/<i>/<u>/<img>) pass through
// untouched — the reader's sanitizer handles them.
//
// Fidelity rule: the translator's line layout is preserved EXACTLY — the
// blank lines they see in the editor (including ones they added or removed
// by hand) are what readers get. Automatic spacing happens only once, when
// the chapter text is first pasted into the empty editor (see
// spreadPlainTextLines), and stays fully editable afterwards.

const INLINE_KEEP = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'IMG', 'A']);

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// DOM-faithful conversion: every visual line in the contenteditable editor
// (a <div>/<p> block, a <br>) becomes exactly one text line; an empty block
// (<div><br></div>) becomes exactly one empty line.
function htmlToLines(html: string): string {
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  const lines: string[] = [];
  let cur = '';
  const endLine = () => {
    lines.push(cur);
    cur = '';
  };

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      cur += escapeText((node.textContent || '').replace(/\u00a0/g, ' '));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName;

    if (tag === 'BR') {
      endLine();
      return;
    }
    if (INLINE_KEEP.has(tag)) {
      cur += (el as HTMLElement).outerHTML;
      return;
    }
    if (tag === 'DIV' || tag === 'P') {
      if (cur !== '') endLine();
      const before = lines.length;
      el.childNodes.forEach(walk);
      // A block is one visual line: close it unless its content already
      // closed itself (e.g. <div><br></div> = exactly one empty line).
      if (cur !== '' || lines.length === before) endLine();
      // Pasted rich text separates real paragraphs with <p>; keep that
      // breathing room as one blank line.
      if (tag === 'P') lines.push('');
      return;
    }
    // Unknown wrappers (span, font, …) carry no layout meaning — keep only
    // their contents.
    el.childNodes.forEach(walk);
  };

  body.childNodes.forEach(walk);
  if (cur !== '') endLine();

  // Trim leading/trailing empty lines and per-line edge spaces, but keep
  // every interior blank line exactly as authored.
  const trimmed = lines.map((l) => l.replace(/^[ \t]+|[ \t]+$/g, ''));
  while (trimmed.length && trimmed[0] === '') trimmed.shift();
  while (trimmed.length && trimmed[trimmed.length - 1] === '') trimmed.pop();
  return trimmed.join('\n');
}

export function normalizeChapterText(raw: string): string {
  if (!raw) return '';
  const text = raw.replace(/\r\n?/g, '\n');
  // Plain text (typed or already normalized): keep the line layout as-is.
  if (!/<\/?(div|p|br|span)\b|&(nbsp|amp|lt|gt|quot|#39);/i.test(text)) return text;

  if (typeof DOMParser !== 'undefined') {
    try {
      return htmlToLines(text);
    } catch {
      /* fall through to the regex approximation */
    }
  }

  // Regex approximation for environments without a DOM parser.
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>\s*<div[^>]*>/gi, '\n')
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/?span[^>]*>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// First-attach formatting for the add-chapter editor: spread pasted text so
// every non-empty line is followed by one visible blank line. Returns HTML
// for a contenteditable editor (<div>line</div><div><br></div>…). Applied
// ONLY when pasting into an empty editor — afterwards the translator's own
// edits (adding or removing blank lines) are what gets saved and shown.
export function spreadPlainTextLines(text: string): string {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return lines.map((l) => `<div>${escapeText(l)}</div>`).join('<div><br></div>');
}
