<?php
// Compress this response when the browser accepts it — see api/db.php for why
// this matters on a first visit over mobile data. Safe alongside mod_deflate:
// nothing re-compresses a response that already carries Content-Encoding.
if (extension_loaded('zlib') && !ini_get('zlib.output_compression')) {
    @ob_start('ob_gzhandler');
}
/**
 * RSS feed of the newest published chapters.
 *
 * A feed is the standard "something new is here" channel: readers subscribe in
 * a feed reader and aggregators/bots poll it far more often than they re-crawl
 * a site, so a chapter published now is picked up in minutes rather than
 * whenever the next full crawl happens. Generated live from the shared
 * database, so it is never stale.
 */

header('Content-Type: application/rss+xml; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate');

$SITE = 'https://berrymist.online';
$DB_FILE = __DIR__ . '/berry_db.json';
$LIMIT = 50;

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
function plain_text($raw, $limit = 400) {
    if (!is_string($raw)) return '';
    $t = preg_replace('/<img[^>]*>/i', '', $raw);
    $t = preg_replace('/<[^>]+>/', ' ', $t);
    $t = html_entity_decode($t, ENT_QUOTES, 'UTF-8');
    $t = trim(preg_replace('/\s+/u', ' ', $t));
    if (function_exists('mb_substr') && mb_strlen($t, 'UTF-8') > $limit) {
        $t = mb_substr($t, 0, $limit, 'UTF-8') . '…';
    } elseif (strlen($t) > $limit) {
        $t = substr($t, 0, $limit) . '…';
    }
    return $t;
}

$siteName = 'BerryMist';
$items = array();

if (file_exists($DB_FILE)) {
    $db = json_decode(file_get_contents($DB_FILE), true);
    if (is_array($db)) {
        if (!empty($db['site_name']) && is_string($db['site_name'])) $siteName = trim($db['site_name']);

        // Public novels, indexed by id.
        $novels = array();
        if (!empty($db['novels']) && is_array($db['novels'])) {
            foreach ($db['novels'] as $n) {
                if (!is_array($n) || empty($n['id'])) continue;
                $status = isset($n['status']) ? $n['status'] : '';
                if ($status === 'CANCELLED' || $status === 'PENDING' || $status === 'PENDING_APPROVAL') continue;
                $novels[$n['id']] = $n;
            }
        }

        $now = time();
        if (!empty($db['chapters']) && is_array($db['chapters'])) {
            foreach ($db['chapters'] as $c) {
                if (!is_array($c) || empty($c['novelId']) || !isset($novels[$c['novelId']])) continue;
                if (!empty($c['deleted'])) continue;
                $when = !empty($c['publishAt']) ? $c['publishAt'] : (isset($c['createdAt']) ? $c['createdAt'] : '');
                $ts = $when ? strtotime($when) : false;
                if ($ts === false) $ts = 0;
                // Not out yet.
                if (!empty($c['publishAt']) && $ts > $now) continue;
                $num = chapter_number_of($c);
                if ($num === null) continue;

                $n = $novels[$c['novelId']];
                $display = !empty($n['titleAr']) ? $n['titleAr'] : (isset($n['titleEn']) ? $n['titleEn'] : 'رواية');
                $slug = novel_slug($n);

                $chTitle = isset($c['title']) ? $c['title'] : ('الفصل ' . $num);
                $items[] = array(
                    'title' => $display . ' — ' . $chTitle,
                    'link' => $SITE . '/novel/' . rawurlencode($slug) . '/chapter-' . $num,
                    'desc' => plain_text(isset($c['content']) ? $c['content'] : ''),
                    'ts' => $ts,
                );
            }
        }
    }
}

usort($items, function ($a, $b) { return $b['ts'] - $a['ts']; });
$items = array_slice($items, 0, $LIMIT);
$updated = count($items) ? $items[0]['ts'] : time();

function x($s) { return htmlspecialchars($s, ENT_QUOTES | ENT_XML1, 'UTF-8'); }

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">' . "\n";
echo "<channel>\n";
echo '  <title>' . x($siteName . ' — أحدث الفصول') . "</title>\n";
echo '  <link>' . x($SITE . '/') . "</link>\n";
echo '  <description>' . x('أحدث الفصول المنشورة على ' . $siteName . '.') . "</description>\n";
echo '  <language>ar</language>' . "\n";
echo '  <lastBuildDate>' . gmdate('D, d M Y H:i:s', $updated) . " GMT</lastBuildDate>\n";
echo '  <atom:link href="' . x($SITE . '/feed.xml') . '" rel="self" type="application/rss+xml" />' . "\n";
foreach ($items as $it) {
    echo "  <item>\n";
    echo '    <title>' . x($it['title']) . "</title>\n";
    echo '    <link>' . x($it['link']) . "</link>\n";
    echo '    <guid isPermaLink="true">' . x($it['link']) . "</guid>\n";
    echo '    <pubDate>' . gmdate('D, d M Y H:i:s', $it['ts'] ?: time()) . " GMT</pubDate>\n";
    echo '    <description>' . x($it['desc']) . "</description>\n";
    echo "  </item>\n";
}
echo "</channel>\n</rss>\n";
