<?php
// Shared helpers for the search-engine surfaces (sitemap, prerender,
// IndexNow). Everything here reads the same berry_db.json the site's API
// serves, so a chapter is exposed to crawlers under exactly the same rules
// the app itself uses: deleted records stay hidden, and a scheduled chapter
// stays invisible until its publish time actually arrives.

// The public origin. Kept in one place so every generated URL, canonical tag
// and IndexNow submission agrees.
function seo_site_origin() {
    $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'berrymist.online';
    // Strip a leading www so generated URLs match the canonical host the
    // .htaccess redirect sends every visitor to.
    $host = preg_replace('/^www\./i', '', $host);
    return 'https://' . $host;
}

function seo_load_db() {
    $file = __DIR__ . '/berry_db.json';
    if (!file_exists($file)) return array();
    $raw = @file_get_contents($file);
    if ($raw === false) return array();
    $data = json_decode($raw, true);
    return is_array($data) ? $data : array();
}

// Mirror of src/utils/slug.ts so a URL built by PHP is byte-identical to the
// one the browser app builds for the same novel.
function seo_slugify($text) {
    $text = trim((string)$text);
    if ($text === '') return '';
    $text = function_exists('mb_strtolower') ? mb_strtolower($text, 'UTF-8') : strtolower($text);
    $text = preg_replace('/[^\p{L}\p{N}\s-]/u', '', $text);
    $text = preg_replace('/\s+/u', '-', $text);
    $text = preg_replace('/-+/u', '-', $text);
    return trim($text, '-');
}

function seo_novels($db) {
    $out = array();
    if (empty($db['novels']) || !is_array($db['novels'])) return $out;
    foreach ($db['novels'] as $n) {
        if (!is_array($n) || empty($n['id']) || !empty($n['deleted'])) continue;
        $out[] = $n;
    }
    return $out;
}

// Chapters that are genuinely readable right now: not deleted, not a draft,
// and either unscheduled or past their scheduled publish moment. A chapter
// that is still scheduled must never reach a crawler — it would index a page
// that visitors cannot open yet.
function seo_published_chapters($db, $novelId = null) {
    $out = array();
    if (empty($db['chapters']) || !is_array($db['chapters'])) return $out;
    $now = time();
    foreach ($db['chapters'] as $c) {
        if (!is_array($c) || empty($c['id']) || !empty($c['deleted'])) continue;
        if (!empty($c['isDraft'])) continue;
        if (!empty($c['publishAt'])) {
            $at = strtotime($c['publishAt']);
            if ($at !== false && $at > $now) continue;
        }
        if ($novelId !== null && (empty($c['novelId']) || $c['novelId'] !== $novelId)) continue;
        $out[] = $c;
    }
    return $out;
}

function seo_novel_url($novel) {
    $slug = seo_slugify(isset($novel['titleAr']) ? $novel['titleAr'] : '');
    if ($slug === '') $slug = seo_slugify(isset($novel['titleEn']) ? $novel['titleEn'] : '');
    if ($slug === '') $slug = isset($novel['id']) ? $novel['id'] : '';
    return '/novel/' . rawurlencode($slug);
}

function seo_chapter_url($novel, $chapter) {
    $num = isset($chapter['number']) ? (int)$chapter['number'] : 0;
    return seo_novel_url($novel) . '/chapter-' . $num;
}

// Newest meaningful timestamp on a record, for <lastmod>.
function seo_lastmod($rec, $fallback = null) {
    $candidates = array();
    foreach (array('updatedAt', 'publishAt', 'createdAt') as $k) {
        if (!empty($rec[$k])) {
            $t = strtotime($rec[$k]);
            if ($t !== false) $candidates[] = $t;
        }
    }
    if (!$candidates) return $fallback;
    return max($candidates);
}

// Find a novel by the slug used in a URL (matches the Arabic or English
// title slug, and falls back to the raw id for very old links).
function seo_find_novel_by_slug($novels, $slug) {
    $slug = rawurldecode((string)$slug);
    foreach ($novels as $n) {
        if (seo_slugify(isset($n['titleAr']) ? $n['titleAr'] : '') === $slug) return $n;
        if (seo_slugify(isset($n['titleEn']) ? $n['titleEn'] : '') === $slug) return $n;
        if (isset($n['id']) && $n['id'] === $slug) return $n;
    }
    return null;
}
