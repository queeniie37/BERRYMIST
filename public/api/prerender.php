<?php
// Server-rendered novel and chapter pages.
//
// The site is a single-page app: without this, every chapter shares the
// homepage's HTML and its real title/text only appear after JavaScript runs.
// Google can eventually render that, but slowly — and Bing, Yandex, Naver,
// DuckDuckGo and most social/preview bots barely run JS at all, so chapters
// were effectively invisible to them.
//
// This handler answers /novel/<slug> and /novel/<slug>/chapter-<n> with the
// SAME index.html the app always served, plus the page's real metadata and a
// readable copy of the text already inside #root. Crawlers get the content in
// the first response; visitors get it painted instantly and then React mounts
// and replaces it with the live app (createRoot clears the container), so the
// interactive experience is unchanged.

require_once __DIR__ . '/seo_lib.php';

$shell = @file_get_contents(__DIR__ . '/../index.html');
if ($shell === false) {
    http_response_code(500);
    echo 'index.html missing';
    exit;
}

$origin = seo_site_origin();
$path = parse_url(isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/', PHP_URL_PATH);
$path = is_string($path) ? $path : '/';

$slug = null;
$chapterNumber = null;
if (preg_match('#^/novel/([^/]+)/chapter-(\d+)/?$#u', $path, $m)) {
    $slug = $m[1];
    $chapterNumber = (int)$m[2];
} elseif (preg_match('#^/novel/([^/]+)/?$#u', $path, $m)) {
    $slug = $m[1];
}

$db = seo_load_db();
$novels = seo_novels($db);
$novel = $slug !== null ? seo_find_novel_by_slug($novels, $slug) : null;

function seo_text($s) {
    // Chapter text may carry inline markup (<b>, <img>, …); crawlers want the
    // words, so reduce it to plain text.
    $s = preg_replace('#<br\s*/?>#i', "\n", (string)$s);
    $s = strip_tags($s);
    return html_entity_decode($s, ENT_QUOTES, 'UTF-8');
}

function seo_excerpt($s, $len = 160) {
    $s = trim(preg_replace('/\s+/u', ' ', seo_text($s)));
    if (function_exists('mb_strlen') && mb_strlen($s, 'UTF-8') > $len) {
        return mb_substr($s, 0, $len - 1, 'UTF-8') . '…';
    }
    return $s;
}

function seo_attr($s) {
    return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
}

// Chapter titles are stored as "الفصل N: العنوان"; the readable part is
// whatever follows the first colon.
function seo_chapter_title($chapter) {
    $t = isset($chapter['title']) ? (string)$chapter['title'] : '';
    $parts = explode(':', $t);
    if (count($parts) > 1) {
        $rest = trim(implode(':', array_slice($parts, 1)));
        if ($rest !== '') return $rest;
    }
    return $t;
}

$siteName = 'بيري ميست';
$title = null;
$description = null;
$canonical = null;
$ogType = 'website';
$jsonLd = null;
$body = '';
$notFound = false;

if ($novel === null) {
    // A link to a novel that no longer exists must not be indexed as a real
    // page — tell crawlers plainly instead of showing them the homepage.
    $notFound = true;
    http_response_code(404);
    $title = 'الصفحة غير موجودة | ' . $siteName;
    $description = 'الرواية أو الفصل المطلوب لم يعد متاحاً على ' . $siteName . '.';
    $canonical = $origin . '/';
    $body = '<h1>الصفحة غير موجودة</h1><p>الرواية أو الفصل المطلوب لم يعد متاحاً.</p>'
          . '<p><a href="/">العودة إلى الصفحة الرئيسية</a></p>';
} else {
    $novelTitle = isset($novel['titleAr']) && $novel['titleAr'] !== '' ? $novel['titleAr'] : (isset($novel['titleEn']) ? $novel['titleEn'] : '');
    $translator = isset($novel['translatorName']) ? $novel['translatorName'] : '';
    $cover = isset($novel['cover']) ? $novel['cover'] : '';
    $chapters = seo_published_chapters($db, isset($novel['id']) ? $novel['id'] : null);
    usort($chapters, function ($a, $b) {
        $x = isset($a['number']) ? (int)$a['number'] : 0;
        $y = isset($b['number']) ? (int)$b['number'] : 0;
        return $x - $y;
    });

    if ($chapterNumber !== null) {
        $chapter = null;
        foreach ($chapters as $c) {
            if ((int)$c['number'] === $chapterNumber) { $chapter = $c; break; }
        }
        if ($chapter === null) {
            // Scheduled or removed chapter: readable page does not exist yet.
            $notFound = true;
            http_response_code(404);
            $title = 'الفصل غير متاح | ' . $siteName;
            $description = 'هذا الفصل غير متاح للقراءة حالياً على ' . $siteName . '.';
            $canonical = $origin . seo_novel_url($novel);
            $body = '<h1>الفصل غير متاح</h1>'
                  . '<p><a href="' . seo_attr(seo_novel_url($novel)) . '">' . seo_attr($novelTitle) . '</a></p>';
        } else {
            $chTitle = seo_chapter_title($chapter);
            $ogType = 'article';
            $title = 'الفصل ' . $chapterNumber . ($chTitle !== '' ? ': ' . $chTitle : '') . ' — ' . $novelTitle . ' | ' . $siteName;
            $description = seo_excerpt(isset($chapter['content']) ? $chapter['content'] : '')
                ?: ('اقرأ الفصل ' . $chapterNumber . ' من رواية ' . $novelTitle . ' مترجماً على ' . $siteName . '.');
            $canonical = $origin . seo_chapter_url($novel, $chapter);

            $published = seo_lastmod($chapter);
            $jsonLd = array(
                '@context' => 'https://schema.org',
                '@type' => 'Article',
                'headline' => 'الفصل ' . $chapterNumber . ($chTitle !== '' ? ': ' . $chTitle : ''),
                'inLanguage' => 'ar',
                'isPartOf' => array('@type' => 'Book', 'name' => $novelTitle, 'url' => $origin . seo_novel_url($novel)),
                'mainEntityOfPage' => $canonical,
                'publisher' => array('@type' => 'Organization', 'name' => $siteName, 'url' => $origin . '/'),
                'description' => $description,
            );
            if ($published) {
                $jsonLd['datePublished'] = gmdate('c', $published);
                $jsonLd['dateModified'] = gmdate('c', $published);
            }
            if ($translator !== '') $jsonLd['author'] = array('@type' => 'Person', 'name' => $translator);

            $paragraphs = preg_split('/\n\s*\n/u', trim(seo_text(isset($chapter['content']) ? $chapter['content'] : '')));
            $html = '<article>';
            $html .= '<h1>' . seo_attr('الفصل ' . $chapterNumber . ($chTitle !== '' ? ': ' . $chTitle : '')) . '</h1>';
            $html .= '<p><a href="' . seo_attr(seo_novel_url($novel)) . '">' . seo_attr($novelTitle) . '</a>';
            if ($translator !== '') $html .= ' — ' . seo_attr('ترجمة: ' . $translator);
            $html .= '</p>';
            foreach ($paragraphs as $para) {
                $para = trim($para);
                if ($para === '') continue;
                $html .= '<p>' . nl2br(seo_attr($para)) . '</p>';
            }
            // Prev/next links let a crawler walk the whole novel from any
            // chapter it happens to find first.
            $nav = '';
            foreach ($chapters as $c) {
                $n = (int)$c['number'];
                if ($n === $chapterNumber - 1) {
                    $nav .= '<a href="' . seo_attr(seo_chapter_url($novel, $c)) . '">' . seo_attr('الفصل السابق (' . $n . ')') . '</a> ';
                }
                if ($n === $chapterNumber + 1) {
                    $nav .= '<a href="' . seo_attr(seo_chapter_url($novel, $c)) . '">' . seo_attr('الفصل التالي (' . $n . ')') . '</a>';
                }
            }
            if ($nav !== '') $html .= '<nav>' . $nav . '</nav>';
            $html .= '</article>';
            $body = $html;
        }
    } else {
        $ogType = 'book';
        $title = $novelTitle . ($novel['titleEn'] ?? '' ? ' (' . $novel['titleEn'] . ')' : '') . ' | ' . $siteName;
        $description = seo_excerpt(isset($novel['description']) ? $novel['description'] : '')
            ?: ('اقرأ رواية ' . $novelTitle . ' مترجمة بجودة عالية على ' . $siteName . '.');
        $canonical = $origin . seo_novel_url($novel);

        $jsonLd = array(
            '@context' => 'https://schema.org',
            '@type' => 'Book',
            'name' => $novelTitle,
            'inLanguage' => 'ar',
            'url' => $canonical,
            'description' => $description,
            'numberOfPages' => count($chapters),
        );
        if ($cover !== '' && strpos($cover, 'data:') !== 0) $jsonLd['image'] = $cover;
        if (!empty($novel['author'])) $jsonLd['author'] = array('@type' => 'Person', 'name' => $novel['author']);
        if ($translator !== '') $jsonLd['translator'] = array('@type' => 'Person', 'name' => $translator);

        $html = '<article><h1>' . seo_attr($novelTitle) . '</h1>';
        if (!empty($novel['titleEn'])) $html .= '<h2>' . seo_attr($novel['titleEn']) . '</h2>';
        if (!empty($novel['author'])) $html .= '<p>' . seo_attr('الكاتب: ' . $novel['author']) . '</p>';
        if ($translator !== '') $html .= '<p>' . seo_attr('المترجم: ' . $translator) . '</p>';
        if (!empty($novel['description'])) $html .= '<p>' . nl2br(seo_attr(seo_text($novel['description']))) . '</p>';
        if ($chapters) {
            $html .= '<h2>' . seo_attr('الفصول (' . count($chapters) . ')') . '</h2><ul>';
            foreach ($chapters as $c) {
                $chTitle = seo_chapter_title($c);
                $label = 'الفصل ' . (int)$c['number'] . ($chTitle !== '' ? ': ' . $chTitle : '');
                $html .= '<li><a href="' . seo_attr(seo_chapter_url($novel, $c)) . '">' . seo_attr($label) . '</a></li>';
            }
            $html .= '</ul>';
        }
        $html .= '</article>';
        $body = $html;
    }
}

// ---- Rewrite the shell's metadata for this page ----
$out = $shell;

$out = preg_replace('#<title>.*?</title>#is', '<title>' . seo_attr($title) . '</title>', $out, 1);

$replaceMeta = function ($html, $attr, $name, $value) {
    $pattern = '#(<meta\s+' . $attr . '=["\']' . preg_quote($name, '#') . '["\'][^>]*content=["\'])(.*?)(["\'])#is';
    $replaced = preg_replace($pattern, '${1}' . str_replace('$', '\$', seo_attr($value)) . '${3}', $html, 1);
    return $replaced === null ? $html : $replaced;
};

$out = $replaceMeta($out, 'name', 'title', $title);
$out = $replaceMeta($out, 'name', 'description', $description);
$out = $replaceMeta($out, 'property', 'og:title', $title);
$out = $replaceMeta($out, 'property', 'og:description', $description);
$out = $replaceMeta($out, 'property', 'og:url', $canonical);
$out = $replaceMeta($out, 'property', 'og:type', $ogType);
$out = $replaceMeta($out, 'property', 'twitter:title', $title);
$out = $replaceMeta($out, 'property', 'twitter:description', $description);
$out = $replaceMeta($out, 'property', 'twitter:url', $canonical);

$out = preg_replace(
    '#<link\s+rel=["\']canonical["\'][^>]*>#is',
    '<link rel="canonical" href="' . seo_attr($canonical) . '" />',
    $out,
    1
);

if ($notFound) {
    // Keep unavailable pages out of the index entirely.
    $out = preg_replace(
        '#<meta\s+name=["\']robots["\'][^>]*>#is',
        '<meta name="robots" content="noindex, follow" />',
        $out,
        1
    );
}

if ($jsonLd !== null) {
    $script = '<script type="application/ld+json">'
        . json_encode($jsonLd, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        . '</script>';
    $out = preg_replace('#</head>#i', $script . "\n  </head>", $out, 1);
}

// Put the readable copy inside #root. React's createRoot() clears the
// container when it mounts, so this is what crawlers read and what visitors
// see for the instant before the app takes over.
$out = preg_replace(
    '#(<div\s+id=["\']root["\'][^>]*>)(</div>)#is',
    '${1}' . str_replace('$', '\$', $body) . '${2}',
    $out,
    1
);

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: public, max-age=300');
echo $out;
