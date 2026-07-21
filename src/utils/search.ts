// Shared fuzzy-search matching for novels.
//
// Goals (per the owner's request):
//  - Case-insensitive: "SHADOW", "shadow" and "Shadow" all match.
//  - Arabic-form-insensitive: hamza variants (أ/إ/آ → ا), taa marbuta
//    (ة → ه), alef maqsura (ى → ي) and diacritics/tatweel are normalized,
//    so visitors find a novel however they spell it.
//  - Word-based, order-free: every typed word just has to appear SOMEWHERE
//    in the novel's searchable text — "الظلال سيد" finds "سيد الظلال",
//    and "lord shadow" finds "Shadow Lord".

export function normalizeSearchText(text: string): string {
  return (text || '')
    .toLowerCase()
    // Arabic diacritics (tashkeel), superscript alef, and tatweel
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

// True when every word of the query appears (in any order) inside the
// combined normalized text of the given fields.
export function matchesSearch(query: string, fields: Array<string | undefined | null>): boolean {
  const tokens = normalizeSearchText(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = normalizeSearchText(fields.filter(Boolean).join(' '));
  return tokens.every(token => haystack.includes(token));
}
