// Chapter ordering.
//
// A chapter's number must ALWAYS be compared numerically so the list reads
// 80 → 100 → 200 → 1000 (the highest number is always last), never
// lexicographically ("1000" < "80") and never by upload time — a chapter 100
// added after chapter 1000 still belongs before it.
//
// The value can arrive as a real number, as a numeric string (older uploads or
// imported data), or only under the legacy `chapterNumber` field, so normalize
// it once here and use these helpers everywhere chapters are sorted or looked
// up. Anything unparseable sorts as 0 instead of poisoning the comparison with
// NaN (which would leave the whole list in an arbitrary order).
export function chapterNum(c: any): number {
  const raw = c?.number ?? c?.chapterNumber;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

// Ascending by chapter number: lowest first, highest (newest) last.
export function byChapterNumberAsc(a: any, b: any): number {
  return chapterNum(a) - chapterNum(b);
}

// True when a chapter carries the given number, tolerating string/number
// mismatches (URL parsing yields a number; stored data may hold a string).
export function isChapterNumber(c: any, num: number | string): boolean {
  const target = Number(num);
  return Number.isFinite(target) && chapterNum(c) === target;
}

// True only when the chapter actually carries a usable number. `chapterNum`
// falls back to 0 so sorting never sees NaN, but "no number at all" must not
// be mistaken for chapter 0 when picking a novel's first/latest chapter.
export function hasChapterNumber(c: any): boolean {
  const raw = c?.number ?? c?.chapterNumber;
  return raw !== null && raw !== undefined && raw !== '' && Number.isFinite(Number(raw));
}

// Matches a title that is nothing more than the default label "الفصل N"
// (with any spacing/punctuation variants) — i.e. it carries no real subtitle.
const DEFAULT_TITLE_RE = /^الفصل\s*[#№]?\s*\d+\s*[:：.\-–—]?\s*$/u;

// Chapter titles are stored as "الفصل N: <subtitle>". Two data accidents made
// that display as "الفصل N: الفصل N": chapters saved while the title field
// still held its default placeholder, and older imports where the whole
// "الفصل N" label was typed into the subtitle. This helper extracts ONLY the
// real subtitle, returning '' when there is none — so every screen can render
// "الفصل N" alone instead of a duplicated label.
export function chapterSubtitle(c: any): string {
  const raw = typeof c?.title === 'string' ? c.title.trim() : '';
  if (!raw) return '';
  // Whole title is just the default label.
  if (DEFAULT_TITLE_RE.test(raw)) return '';
  const idx = raw.indexOf(':');
  const sub = idx === -1 ? raw : raw.slice(idx + 1).trim();
  if (!sub) return '';
  // Subtitle is itself the bare default label ("الفصل N: الفصل N").
  if (DEFAULT_TITLE_RE.test(sub)) return '';
  return sub;
}

// The canonical one-line label for UI: "الفصل N" or "الفصل N: <subtitle>".
export function chapterDisplayTitle(c: any): string {
  const sub = chapterSubtitle(c);
  return `الفصل ${chapterNum(c)}${sub ? `: ${sub}` : ''}`;
}

// Normalize a title about to be SAVED: translators sometimes leave the
// placeholder "الفصل N" in the subtitle field, which used to be stored
// verbatim as "الفصل N: الفصل N". Store the bare "الفصل N" instead.
export function normalizeChapterTitleInput(num: number | string, subtitle: string): string {
  const sub = (subtitle || '').trim();
  if (!sub || DEFAULT_TITLE_RE.test(sub)) return `الفصل ${num}`;
  return `الفصل ${num}: ${sub}`;
}
