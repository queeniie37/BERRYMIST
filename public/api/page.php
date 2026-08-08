<?php
// Compress this response when the browser accepts it — see api/db.php for why
// this matters on a first visit over mobile data. Safe alongside mod_deflate:
// nothing re-compresses a response that already carries Content-Encoding.
if (extension_loaded('zlib') && !ini_get('zlib.output_compression')) {
    @ob_start('ob_gzhandler');
}
/**
 * Server-side prerender for novel and chapter pages.
 *
 * The site is a single-page app: without this, every URL returns the same empty
 * shell and the real title/description/text only appear after the browser runs
 * JavaScript. Search engines then have to render the page before they can index
 * it, which is slow and unreliable — so a freshly published chapter could take
 * days to show up, or never rank at all.
 *
 * This script serves the SAME index.html (so the app still boots normally for
 * readers) but with the correct <title>, description, canonical, Open Graph and
 * schema.org data filled in, plus the actual chapter text inside #root. Crawlers
 * get complete, indexable content on the very first request; React clears the
 * placeholder and takes over for humans.
 */

$SITE = 'https://berrymist.online';
require_once __DIR__ . '/storage.php';
berry_migrate_legacy();
$DB_FILE = berry_db_file();
$INDEX = dirname(__DIR__) . '/index.html';

if (!file_exists($INDEX)) {
    http_response_code(404);
    exit('index.html missing');
}
$html = file_get_contents($INDEX);

// Mirror of the client's slugify(): keep Arabic and Latin letters and digits,
// collapse everything else to single dashes. The novel segment prefers the
// Arabic title, exactly like the app, so sitemap URLs match real app URLs.
function slugify_title($raw) {
    if (!is_string($raw) || $raw === '') return '';
    $s = trim(function_exists('mb_strtolower') ? mb_strtolower($raw, 'UTF-8') : strtolower($raw));
    $s = preg_replace('/[^\p{L}\p{N}\s-]/u', '', $s);
    $s = preg_replace('/\s+/u', '-', $s);
    $s = preg_replace('/-+/u', '-', $s);
    return trim($s, '-');
}
function novel_slug($n) {
    $s = slugify_title(isset($n['titleAr']) ? $n['titleAr'] : '');
    if ($s === '') $s = slugify_title(isset($n['titleEn']) ? $n['titleEn'] : '');
    if ($s === '' && isset($n['id'])) $s = $n['id'];
    return $s;
}
function chapter_number_of($c) {
    $n = isset($c['number']) ? $c['number'] : (isset($c['chapterNumber']) ? $c['chapterNumber'] : null);
    return is_numeric($n) ? (int)$n : null;
}
// Chapter bodies embed base64 images; strip tags entirely so the prerendered
// page stays small and text-only.
function plain_text($raw, $limit = 6000) {
    if (!is_string($raw)) return '';
    $t = preg_replace('/<img[^>]*>/i', '', $raw);
    $t = preg_replace('/<[^>]+>/', ' ', $t);
    $t = html_entity_decode($t, ENT_QUOTES, 'UTF-8');
    $t = preg_replace('/\s+/u', ' ', $t);
    $t = trim($t);
    if (function_exists('mb_substr')) {
        if (mb_strlen($t, 'UTF-8') > $limit) $t = mb_substr($t, 0, $limit, 'UTF-8') . '…';
    } elseif (strlen($t) > $limit) {
        $t = substr($t, 0, $limit) . '…';
    }
    return $t;
}
function clip($t, $limit) {
    if (function_exists('mb_substr')) {
        return mb_strlen($t, 'UTF-8') > $limit ? mb_substr($t, 0, $limit, 'UTF-8') . '…' : $t;
    }
    return strlen($t) > $limit ? substr($t, 0, $limit) . '…' : $t;
}

// A JSON-LD block is written INSIDE a <script> element, so the encoder must
// never be allowed to emit a literal "</script>" — a novel title or author
// name containing one would close the tag early and everything after it would
// run as page script. JSON_HEX_TAG escapes < and > as \u003C / \u003E, which
// is still valid JSON that search engines parse normally, and JSON_HEX_AMP
// does the same for &. (JSON_UNESCAPED_SLASHES is deliberately NOT used here.)
function json_ld_encode($data) {
    return json_encode($data, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS);
}

// Leftover test records from the first deploy: the "deploy-survival-marker"
// probe row and the "اختبار النظام" test novel. They must never be rendered,
// listed, or handed to crawlers — the app also strips them from the shared DB
// the next time a signed-in member loads the site.
function berry_is_junk_novel($n) {
    if (!is_array($n)) return true;
    $id = isset($n['id']) ? (string)$n['id'] : '';
    if ($id !== '' && strpos($id, 'deploy-survival-marker') === 0) return true;
    $ar = isset($n['titleAr']) ? trim((string)$n['titleAr']) : '';
    if ($ar === 'اختبار النظام' || slugify_title($ar) === 'اختبار-النظام') return true;
    return false;
}

// Chapter titles are stored as "الفصل N: <subtitle>", but some were saved with
// the placeholder itself as the subtitle, producing "الفصل N: الفصل N".
// Extract only the real subtitle; '' when there is none.
function chapter_subtitle($raw, $num) {
    if (!is_string($raw)) return '';
    $t = trim($raw);
    if ($t === '') return '';
    $bare = '/^الفصل\s*[#№]?\s*\d+\s*[:：.\-–—]?\s*$/u';
    if (preg_match($bare, $t)) return '';
    $pos = mb_strpos($t, ':', 0, 'UTF-8');
    $sub = $pos === false ? $t : trim(mb_substr($t, $pos + 1, null, 'UTF-8'));
    if ($sub === '' || preg_match($bare, $sub)) return '';
    return $sub;
}

// preg_replace() treats $1 / \1 in the REPLACEMENT string as backreferences,
// so a title containing "$1" (or a stray backslash) came out mangled. Escape
// those two characters so the replacement is always taken literally.
function rep_literal($s) {
    return str_replace(array('\\', '$'), array('\\\\', '\$'), $s);
}

// ---- Which screen was requested? -----------------------------------------
$reqPath = parse_url(isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/', PHP_URL_PATH);
$segs = array_values(array_filter(explode('/', trim((string)$reqPath, '/')), 'strlen'));
// Expected shapes: novel/<slug>[/chapter-<n>] or a plain app page (<page>).
$isNovelRoute = (isset($segs[0]) && $segs[0] === 'novel' && isset($segs[1]));
$slugOrPage = $isNovelRoute ? rawurldecode($segs[1]) : '';
// Chapters are addressed as /chapter-<n>, matching the app's URLs.
$chapterSeg = null;
if ($isNovelRoute && isset($segs[2]) && preg_match('/^chapter-(\d+)$/', $segs[2], $cm)) $chapterSeg = (int)$cm[1];

$siteName = 'BerryMist';
$title = $siteName . ' | المنصة العربية الفاخرة للروايات المترجمة والأصلية';
$description = 'منصة عربية فاخرة لقراءة وكتابة وترجمة الروايات الخفيفة وروايات الفانتازيا والويب، بفصول جديدة تنزل يومياً.';
$canonical = $SITE . (string)$reqPath;
$bodyHtml = '';
$jsonLd = '';
$notFound = false;

// Screens that exist in the app (client-side routes). Everything else is a
// real 404, not the homepage with a 200 — serving 200 for unknown URLs is the
// "soft 404" pattern search engines penalise site-wide.
$KNOWN_APP_PAGES = array('', 'home','library','explore','suggestions','teams','notifications','profile','translator','admin','ads','privacy','terms','contact','contact-us','privacy-policy','terms-of-service');

if (!$isNovelRoute) {
    $first = isset($segs[0]) ? rawurldecode($segs[0]) : '';
    if (!in_array($first, $KNOWN_APP_PAGES, true)) {
        $notFound = true;
    }
}

if ($isNovelRoute && $slugOrPage !== '' && file_exists($DB_FILE)) {
    $db = json_decode(file_get_contents($DB_FILE), true);
    if (is_array($db) && isset($db['novels']) && is_array($db['novels'])) {
        if (isset($db['site_name']) && is_string($db['site_name']) && trim($db['site_name']) !== '') {
            $siteName = trim($db['site_name']);
        }
        // Find the novel by its English-title slug (id as a fallback).
        $novel = null;
        foreach ($db['novels'] as $n) {
            if (!is_array($n) || berry_is_junk_novel($n)) continue;
            // Match the app's slug (Arabic title first), and still accept the
            // English-title slug or the raw id so older links keep resolving.
            $arSlug = slugify_title(isset($n['titleAr']) ? $n['titleAr'] : '');
            $enSlug = slugify_title(isset($n['titleEn']) ? $n['titleEn'] : '');
            if ($slugOrPage !== '' && ($arSlug === $slugOrPage || $enSlug === $slugOrPage
                || (isset($n['id']) && $n['id'] === $slugOrPage))) { $novel = $n; break; }
        }
        if ($novel === null) {
            // Unknown novel slug — an honest 404, not the homepage with a 200.
            $notFound = true;
        }
        if ($novel !== null) {
            $status = isset($novel['status']) ? $novel['status'] : '';
            $isPublic = ($status !== 'CANCELLED' && $status !== 'PENDING' && $status !== 'PENDING_APPROVAL');
            $titleEn = isset($novel['titleEn']) ? $novel['titleEn'] : '';
            $titleAr = isset($novel['titleAr']) ? $novel['titleAr'] : '';
            $display = $titleAr !== '' ? $titleAr : $titleEn;
            $author = isset($novel['author']) ? $novel['author'] : '';
            $slug = novel_slug($novel);

            if (!$isPublic) {
                header('X-Robots-Tag: noindex');
            }

            // Published chapters of this novel, ordered by number.
            $now = time();
            $chapters = array();
            if (isset($db['chapters']) && is_array($db['chapters'])) {
                foreach ($db['chapters'] as $c) {
                    if (!is_array($c) || !isset($c['novelId']) || $c['novelId'] !== $novel['id']) continue;
                    if (!empty($c['deleted'])) continue;
                    if (!empty($c['publishAt'])) {
                        $pt = strtotime($c['publishAt']);
                        if ($pt !== false && $pt > $now) continue;
                    }
                    if (chapter_number_of($c) === null) continue;
                    $chapters[] = $c;
                }
            }
            usort($chapters, function ($a, $b) { return chapter_number_of($a) - chapter_number_of($b); });

            if ($chapterSeg !== null) {
                // ---------- Chapter page ----------
                $chapter = null;
                foreach ($chapters as $c) { if (chapter_number_of($c) === $chapterSeg) { $chapter = $c; break; } }
                if ($chapter !== null) {
                    $chTitleRaw = isset($chapter['title']) ? $chapter['title'] : '';
                    $chSub = chapter_subtitle($chTitleRaw, $chapterSeg);
                    $title = 'الفصل ' . $chapterSeg . ($chSub !== '' ? ': ' . $chSub : '') . ' من رواية ' . $display . ' | ' . $siteName;
                    $text = plain_text(isset($chapter['content']) ? $chapter['content'] : '');
                    $description = clip($text !== '' ? $text : ('اقرأ الفصل ' . $chapterSeg . ' من رواية ' . $display . ' على ' . $siteName . '.'), 300);
                    $canonical = $SITE . '/novel/' . rawurlencode($slug) . '/chapter-' . $chapterSeg;

                    $published = isset($chapter['publishAt']) && $chapter['publishAt'] ? $chapter['publishAt'] : (isset($chapter['createdAt']) ? $chapter['createdAt'] : '');
                    $ld = array(
                        '@context' => 'https://schema.org',
                        '@type' => 'Article',
                        'headline' => clip($title, 110),
                        'articleSection' => 'الفصل ' . $chapterSeg,
                        'inLanguage' => 'ar',
                        'url' => $canonical,
                        'isPartOf' => array('@type' => 'Book', 'name' => $display, 'url' => $SITE . '/novel/' . rawurlencode($slug)),
                        'publisher' => array('@type' => 'Organization', 'name' => $siteName),
                    );
                    if ($published) { $ld['datePublished'] = gmdate('c', strtotime($published)); }
                    if ($author !== '') { $ld['author'] = array('@type' => 'Person', 'name' => $author); }
                    $jsonLd = json_ld_encode($ld);

                    // Previous/next links give crawlers a path through every chapter.
                    $prev = null; $next = null;
                    foreach ($chapters as $c) {
                        $n2 = chapter_number_of($c);
                        if ($n2 < $chapterSeg) { $prev = $n2; }
                        if ($n2 > $chapterSeg && $next === null) { $next = $n2; }
                    }
                    $nav = '';
                    if ($prev !== null) $nav .= '<a href="/novel/' . rawurlencode($slug) . '/chapter-' . $prev . '">الفصل السابق</a> ';
                    if ($next !== null) $nav .= '<a href="/novel/' . rawurlencode($slug) . '/chapter-' . $next . '">الفصل التالي</a>';

                    $bodyHtml =
                        '<article>' .
                        '<h1>' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</h1>' .
                        '<p><a href="/novel/' . rawurlencode($slug) . '">' . htmlspecialchars($display, ENT_QUOTES, 'UTF-8') . '</a>' .
                        ($author !== '' ? ' — ' . htmlspecialchars($author, ENT_QUOTES, 'UTF-8') : '') . '</p>' .
                        '<div>' . nl2br(htmlspecialchars($text, ENT_QUOTES, 'UTF-8')) . '</div>' .
                        '<nav>' . $nav . '</nav>' .
                        '</article>';
                } else {
                    // The novel exists but this chapter number does not.
                    $notFound = true;
                }
            } else {
                // ---------- Novel page ----------
                $title = 'رواية ' . $display . ($titleEn !== '' && $titleEn !== $display ? ' (' . $titleEn . ')' : '') . ' | ' . $siteName;
                $desc = plain_text(isset($novel['description']) ? $novel['description'] : '', 400);
                $description = clip($desc !== '' ? $desc : ('اقرأ رواية ' . $display . ' على ' . $siteName . ' — فصول جديدة تُنشر باستمرار.'), 300);
                $canonical = $SITE . '/novel/' . rawurlencode($slug);

                $ld = array(
                    '@context' => 'https://schema.org',
                    '@type' => 'Book',
                    'name' => $display,
                    'inLanguage' => 'ar',
                    'url' => $canonical,
                    'numberOfPages' => count($chapters),
                    'publisher' => array('@type' => 'Organization', 'name' => $siteName),
                );
                if ($titleAr !== '') $ld['alternateName'] = $titleAr;
                if ($author !== '') $ld['author'] = array('@type' => 'Person', 'name' => $author);
                if (!empty($novel['genres']) && is_array($novel['genres'])) $ld['genre'] = array_values($novel['genres']);
                if (!empty($novel['ratingCount'])) {
                    $ld['aggregateRating'] = array('@type' => 'AggregateRating',
                        'ratingValue' => isset($novel['rating']) ? $novel['rating'] : 0,
                        'ratingCount' => (int)$novel['ratingCount'], 'bestRating' => 5);
                }
                $jsonLd = json_ld_encode($ld);

                // Link every chapter so crawlers can reach them from the novel page.
                $links = '';
                $ordered = array_reverse($chapters);
                foreach ($ordered as $c) {
                    $n2 = chapter_number_of($c);
                    $csub = chapter_subtitle(isset($c['title']) ? $c['title'] : '', $n2);
                    $ct = 'الفصل ' . $n2 . ($csub !== '' ? ': ' . $csub : '');
                    $links .= '<li><a href="/novel/' . rawurlencode($slug) . '/chapter-' . $n2 . '">' . htmlspecialchars($ct, ENT_QUOTES, 'UTF-8') . '</a></li>';
                }
                $bodyHtml =
                    '<article>' .
                    '<h1>' . htmlspecialchars($display, ENT_QUOTES, 'UTF-8') . '</h1>' .
                    ($author !== '' ? '<p>' . htmlspecialchars($author, ENT_QUOTES, 'UTF-8') . '</p>' : '') .
                    '<p>' . htmlspecialchars($desc, ENT_QUOTES, 'UTF-8') . '</p>' .
                    '<h2>الفصول (' . count($chapters) . ')</h2><ul>' . $links . '</ul>' .
                    '</article>';
            }
        }
    } else {
        // Novel/chapter route but the database file is unreadable or corrupt.
        $notFound = true;
    }
} elseif ($isNovelRoute) {
    // Novel/chapter route but the shared database is unavailable.
    $notFound = true;
}

// ---- Honest 404 for unknown paths ----------------------------------------
// The app shell is still served (status 404) so the visitor sees the friendly
// Arabic "not found" screen with working navigation, while crawlers get the
// real 404 status plus noindex — never a homepage-in-disguise 200.
if ($notFound) {
    http_response_code(404);
    header('X-Robots-Tag: noindex, nofollow');
    $title = 'الصفحة غير موجودة (404) | ' . $siteName;
    $description = 'عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها. تصفح مكتبة الروايات من الصفحة الرئيسية.';
    $jsonLd = '';
    $bodyHtml =
        '<article>' .
        '<h1>الصفحة غير موجودة (404)</h1>' .
        '<p>عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.</p>' .
        '<nav><a href="/">العودة إلى الصفحة الرئيسية</a> <a href="/library">تصفح المكتبة</a></nav>' .
        '</article>';
}

// ---- Inject into the shipped index.html ----------------------------------
$titleEsc = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
$descEsc = htmlspecialchars($description, ENT_QUOTES, 'UTF-8');
$canonEsc = htmlspecialchars($canonical, ENT_QUOTES, 'UTF-8');

$html = preg_replace('#<title>.*?</title>#is', '<title>' . rep_literal($titleEsc) . '</title>', $html, 1);
$html = preg_replace('#<meta\s+name="description"\s+content="[^"]*"\s*/?>#i', '<meta name="description" content="' . rep_literal($descEsc) . '" />', $html, 1);
$html = preg_replace('#<meta\s+property="og:title"\s+content="[^"]*"\s*/?>#i', '<meta property="og:title" content="' . rep_literal($titleEsc) . '" />', $html, 1);
$html = preg_replace('#<meta\s+property="og:description"\s+content="[^"]*"\s*/?>#i', '<meta property="og:description" content="' . rep_literal($descEsc) . '" />', $html, 1);
$html = preg_replace('#<meta\s+property="og:url"\s+content="[^"]*"\s*/?>#i', '<meta property="og:url" content="' . rep_literal($canonEsc) . '" />', $html, 1);
$html = preg_replace('#<meta\s+property="twitter:title"\s+content="[^"]*"\s*/?>#i', '<meta property="twitter:title" content="' . rep_literal($titleEsc) . '" />', $html, 1);
$html = preg_replace('#<meta\s+property="twitter:description"\s+content="[^"]*"\s*/?>#i', '<meta property="twitter:description" content="' . rep_literal($descEsc) . '" />', $html, 1);
$html = preg_replace('#<meta\s+property="twitter:url"\s+content="[^"]*"\s*/?>#i', '<meta property="twitter:url" content="' . rep_literal($canonEsc) . '" />', $html, 1);
$html = preg_replace('#<link\s+rel="canonical"[^>]*>#i', '<link rel="canonical" href="' . rep_literal($canonEsc) . '" />', $html, 1);

if ($notFound) {
    // A 404 page must not carry the template's "index, follow" robots meta.
    $html = preg_replace('#<meta\s+name="robots"\s+content="[^"]*"\s*/?>#i', '<meta name="robots" content="noindex, nofollow" />', $html, 1);
    $html = preg_replace('#<meta\s+name="googlebot"\s+content="[^"]*"\s*/?>#i', '<meta name="googlebot" content="noindex, nofollow" />', $html, 1);
}

if ($jsonLd) {
    $html = str_replace('</head>', '  <script type="application/ld+json">' . $jsonLd . "</script>\n  </head>", $html);
}
if ($bodyHtml !== '') {
    // React clears #root on mount, so this is crawler-facing only.
    $html = preg_replace('#<div id="root">\s*</div>#i', '<div id="root">' . $bodyHtml . '</div>', $html, 1);
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate');
echo $html;
