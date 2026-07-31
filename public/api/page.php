<?php
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

$SITE = 'https://berrymist.com';
$DB_FILE = __DIR__ . '/berry_db.json';
$INDEX = dirname(__DIR__) . '/index.html';

if (!file_exists($INDEX)) {
    http_response_code(404);
    exit('index.html missing');
}
$html = file_get_contents($INDEX);

function slugify_title($raw) {
    if (!is_string($raw) || $raw === '') return '';
    $s = strtolower($raw);
    $s = preg_replace('/[\'"`]/u', '', $s);
    $s = preg_replace('/[^a-z0-9]+/', '-', $s);
    $s = trim($s, '-');
    return substr($s, 0, 80);
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

// ---- Which screen was requested? -----------------------------------------
$reqPath = parse_url(isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/', PHP_URL_PATH);
$segs = array_values(array_filter(explode('/', trim((string)$reqPath, '/')), 'strlen'));
// Expected shape: novel/<slug-or-page>[/<chapter-number>]
$slugOrPage = isset($segs[1]) ? rawurldecode($segs[1]) : '';
$chapterSeg = isset($segs[2]) && ctype_digit($segs[2]) ? (int)$segs[2] : null;

$siteName = 'BerryMist';
$title = $siteName . ' | المنصة العربية الفاخرة للروايات المترجمة والأصلية';
$description = 'منصة عربية فاخرة لقراءة وكتابة وترجمة الروايات الخفيفة وروايات الفانتازيا والويب، بفصول جديدة تنزل يومياً.';
$canonical = $SITE . (string)$reqPath;
$bodyHtml = '';
$jsonLd = '';

$RESERVED = array('home','explore','suggestions','teams','notifications','profile','profile-edit','translator-panel','admin','ads','privacy-policy','terms-of-service','contact-us');

if ($slugOrPage !== '' && !in_array($slugOrPage, $RESERVED, true) && file_exists($DB_FILE)) {
    $db = json_decode(file_get_contents($DB_FILE), true);
    if (is_array($db) && isset($db['novels']) && is_array($db['novels'])) {
        if (isset($db['site_name']) && is_string($db['site_name']) && trim($db['site_name']) !== '') {
            $siteName = trim($db['site_name']);
        }
        // Find the novel by its English-title slug (id as a fallback).
        $novel = null;
        foreach ($db['novels'] as $n) {
            if (!is_array($n)) continue;
            $s = slugify_title(isset($n['titleEn']) ? $n['titleEn'] : '');
            if ($s === $slugOrPage || (isset($n['id']) && $n['id'] === $slugOrPage)) { $novel = $n; break; }
        }
        if ($novel !== null) {
            $status = isset($novel['status']) ? $novel['status'] : '';
            $isPublic = ($status !== 'CANCELLED' && $status !== 'PENDING');
            $titleEn = isset($novel['titleEn']) ? $novel['titleEn'] : '';
            $titleAr = isset($novel['titleAr']) ? $novel['titleAr'] : '';
            $display = $titleAr !== '' ? $titleAr : $titleEn;
            $author = isset($novel['author']) ? $novel['author'] : '';
            $slug = slugify_title($titleEn);
            if ($slug === '') $slug = isset($novel['id']) ? $novel['id'] : $slugOrPage;

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
                    $parts = explode(':', $chTitleRaw, 2);
                    $chSub = isset($parts[1]) ? trim($parts[1]) : '';
                    $title = 'الفصل ' . $chapterSeg . ($chSub !== '' ? ': ' . $chSub : '') . ' من رواية ' . $display . ' | ' . $siteName;
                    $text = plain_text(isset($chapter['content']) ? $chapter['content'] : '');
                    $description = clip($text !== '' ? $text : ('اقرأ الفصل ' . $chapterSeg . ' من رواية ' . $display . ' على ' . $siteName . '.'), 300);
                    $canonical = $SITE . '/novel/' . rawurlencode($slug) . '/' . $chapterSeg;

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
                    $jsonLd = json_encode($ld, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

                    // Previous/next links give crawlers a path through every chapter.
                    $prev = null; $next = null;
                    foreach ($chapters as $c) {
                        $n2 = chapter_number_of($c);
                        if ($n2 < $chapterSeg) { $prev = $n2; }
                        if ($n2 > $chapterSeg && $next === null) { $next = $n2; }
                    }
                    $nav = '';
                    if ($prev !== null) $nav .= '<a href="/novel/' . rawurlencode($slug) . '/' . $prev . '">الفصل السابق</a> ';
                    if ($next !== null) $nav .= '<a href="/novel/' . rawurlencode($slug) . '/' . $next . '">الفصل التالي</a>';

                    $bodyHtml =
                        '<article>' .
                        '<h1>' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</h1>' .
                        '<p><a href="/novel/' . rawurlencode($slug) . '">' . htmlspecialchars($display, ENT_QUOTES, 'UTF-8') . '</a>' .
                        ($author !== '' ? ' — ' . htmlspecialchars($author, ENT_QUOTES, 'UTF-8') : '') . '</p>' .
                        '<div>' . nl2br(htmlspecialchars($text, ENT_QUOTES, 'UTF-8')) . '</div>' .
                        '<nav>' . $nav . '</nav>' .
                        '</article>';
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
                $jsonLd = json_encode($ld, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

                // Link every chapter so crawlers can reach them from the novel page.
                $links = '';
                $ordered = array_reverse($chapters);
                foreach ($ordered as $c) {
                    $n2 = chapter_number_of($c);
                    $ct = isset($c['title']) ? $c['title'] : ('الفصل ' . $n2);
                    $links .= '<li><a href="/novel/' . rawurlencode($slug) . '/' . $n2 . '">' . htmlspecialchars($ct, ENT_QUOTES, 'UTF-8') . '</a></li>';
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
    }
}

// ---- Inject into the shipped index.html ----------------------------------
$titleEsc = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
$descEsc = htmlspecialchars($description, ENT_QUOTES, 'UTF-8');
$canonEsc = htmlspecialchars($canonical, ENT_QUOTES, 'UTF-8');

$html = preg_replace('#<title>.*?</title>#is', '<title>' . $titleEsc . '</title>', $html, 1);
$html = preg_replace('#<meta\s+name="description"\s+content="[^"]*"\s*/?>#i', '<meta name="description" content="' . $descEsc . '" />', $html, 1);
$html = preg_replace('#<meta\s+property="og:title"\s+content="[^"]*"\s*/?>#i', '<meta property="og:title" content="' . $titleEsc . '" />', $html, 1);
$html = preg_replace('#<meta\s+property="og:description"\s+content="[^"]*"\s*/?>#i', '<meta property="og:description" content="' . $descEsc . '" />', $html, 1);
$html = preg_replace('#<meta\s+property="og:url"\s+content="[^"]*"\s*/?>#i', '<meta property="og:url" content="' . $canonEsc . '" />', $html, 1);
$html = preg_replace('#<meta\s+property="twitter:title"\s+content="[^"]*"\s*/?>#i', '<meta property="twitter:title" content="' . $titleEsc . '" />', $html, 1);
$html = preg_replace('#<meta\s+property="twitter:description"\s+content="[^"]*"\s*/?>#i', '<meta property="twitter:description" content="' . $descEsc . '" />', $html, 1);
$html = preg_replace('#<meta\s+property="twitter:url"\s+content="[^"]*"\s*/?>#i', '<meta property="twitter:url" content="' . $canonEsc . '" />', $html, 1);
$html = preg_replace('#<link\s+rel="canonical"[^>]*>#i', '<link rel="canonical" href="' . $canonEsc . '" />', $html, 1);

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
