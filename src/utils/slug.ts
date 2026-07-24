// Human-readable URL slugs for novels, e.g. the title «سيد الظلال العائد»
// becomes «سيد-الظلال-العائد». Arabic letters are kept (browsers show them
// decoded in the address bar); spaces and punctuation collapse to single
// dashes so links read as the novel's real name.
export function slugify(text: string): string {
  return (text || '')
    .toString()
    .trim()
    .toLowerCase()
    // Drop characters that are noisy or unsafe in a URL path segment, but keep
    // Arabic letters, Latin letters, digits, spaces and dashes.
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
