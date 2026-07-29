// Tell the search engines about a chapter the moment it goes live.
//
// A sitemap alone only helps once a crawler decides to come back on its own,
// which can take days. This pushes the new URL out immediately: the server
// forwards it to IndexNow (Bing, Yandex, Naver and Seznam share submissions)
// and refreshes Google's copy of the sitemap.
//
// Publishing must never depend on a search engine answering, so this is
// deliberately fire-and-forget: any failure is swallowed and the chapter is
// published regardless. The engines will still find it through the sitemap.
export function notifySearchEngines(input: { novelId?: string; chapterNumber?: number }): void {
  try {
    const body = JSON.stringify({
      novelId: input.novelId,
      chapterNumber: input.chapterNumber,
    });
    // keepalive lets the request survive the page navigating away right after
    // a translator hits publish.
    fetch('/api/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => { /* offline or no PHP host — the sitemap still covers it */ });
  } catch {
    /* never let announcing a chapter break publishing it */
  }
}
