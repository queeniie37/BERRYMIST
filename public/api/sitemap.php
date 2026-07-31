<?php
/**
 * Dynamic sitemap for search engines.
 *
 * The static sitemap.xml only lists the fixed pages; this endpoint reads the
 * live shared database and adds one URL per published novel (using the same
 * English-title slug the site's clean URLs use), so every novel is announced
 * to search engines automatically the moment it exists — no rebuild needed.
 */

header('Content-Type: application/xml; charset=utf-8');

$SITE = 'https://berrymist.com';
$DB_FILE = __DIR__ . '/berry_db.json';

// Mirror of the client's slugifyTitle(): lowercase latin, words joined by
// single hyphens; empty when the title has no latin characters.
function slugify_title($raw) {
    if (!is_string($raw) || $raw === '') return '';
    $s = strtolower($raw);
    $s = preg_replace('/[\'"`]/u', '', $s);
    $s = preg_replace('/[^a-z0-9]+/', '-', $s);
    $s = trim($s, '-');
    return substr($s, 0, 80);
}

$urls = array();
$today = gmdate('Y-m-d');

// Fixed screens
foreach (array(
    array('', 'daily', '1.0'),
    array('novel/explore', 'daily', '0.9'),
    array('novel/suggestions', 'daily', '0.7'),
    array('novel/teams', 'weekly', '0.6'),
    array('novel/ads', 'weekly', '0.5'),
    array('novel/contact-us', 'monthly', '0.4'),
    array('novel/privacy-policy', 'yearly', '0.3'),
    array('novel/terms-of-service', 'yearly', '0.3'),
) as $p) {
    $urls[] = array($SITE . '/' . $p[0], $today, $p[1], $p[2]);
}

// One URL per published novel, plus one per published CHAPTER, straight from
// the live database — so a chapter is announced to search engines the moment
// it exists, with no rebuild and no manual step.
if (file_exists($DB_FILE)) {
    $db = json_decode(file_get_contents($DB_FILE), true);
    if (is_array($db) && isset($db['novels']) && is_array($db['novels'])) {
        $now = time();

        // Group published chapters by novel so each novel's lastmod reflects
        // its newest chapter (that is the signal crawlers act on).
        $chaptersByNovel = array();
        if (isset($db['chapters']) && is_array($db['chapters'])) {
            foreach ($db['chapters'] as $c) {
                if (!is_array($c) || empty($c['novelId'])) continue;
                if (!empty($c['deleted'])) continue;
                // Scheduled chapters are not public yet.
                if (!empty($c['publishAt'])) {
                    $pt = strtotime($c['publishAt']);
                    if ($pt !== false && $pt > $now) continue;
                }
                $chaptersByNovel[$c['novelId']][] = $c;
            }
        }

        foreach ($db['novels'] as $n) {
            if (!is_array($n)) continue;
            $status = isset($n['status']) ? $n['status'] : '';
            if ($status === 'CANCELLED' || $status === 'PENDING') continue;
            $slug = slugify_title(isset($n['titleEn']) ? $n['titleEn'] : '');
            if ($slug === '' && isset($n['id']) && is_string($n['id'])) $slug = $n['id'];
            if ($slug === '') continue;

            $novelId = isset($n['id']) ? $n['id'] : '';
            $chapters = isset($chaptersByNovel[$novelId]) ? $chaptersByNovel[$novelId] : array();

            // Novel page lastmod = newest chapter date (falls back to created).
            $novelLastmod = $today;
            $newest = 0;
            foreach ($chapters as $c) {
                $t = strtotime(isset($c['publishAt']) && $c['publishAt'] ? $c['publishAt'] : (isset($c['createdAt']) ? $c['createdAt'] : ''));
                if ($t !== false && $t > $newest) $newest = $t;
            }
            if ($newest > 0) {
                $novelLastmod = gmdate('Y-m-d', $newest);
            } elseif (isset($n['createdAt']) && is_string($n['createdAt'])) {
                $t = strtotime($n['createdAt']);
                if ($t !== false) $novelLastmod = gmdate('Y-m-d', $t);
            }
            $urls[] = array($SITE . '/novel/' . rawurlencode($slug), $novelLastmod, 'daily', '0.8');

            // Every published chapter gets its own crawlable URL.
            foreach ($chapters as $c) {
                $num = isset($c['number']) ? $c['number'] : (isset($c['chapterNumber']) ? $c['chapterNumber'] : null);
                if ($num === null || !is_numeric($num)) continue;
                $num = (int)$num;
                $ct = strtotime(isset($c['publishAt']) && $c['publishAt'] ? $c['publishAt'] : (isset($c['createdAt']) ? $c['createdAt'] : ''));
                $clastmod = ($ct !== false && $ct > 0) ? gmdate('Y-m-d', $ct) : $novelLastmod;
                $urls[] = array($SITE . '/novel/' . rawurlencode($slug) . '/' . $num, $clastmod, 'weekly', '0.7');
            }
        }
    }
}

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
foreach ($urls as $u) {
    echo "  <url>\n";
    echo '    <loc>' . htmlspecialchars($u[0], ENT_XML1) . "</loc>\n";
    echo '    <lastmod>' . $u[1] . "</lastmod>\n";
    echo '    <changefreq>' . $u[2] . "</changefreq>\n";
    echo '    <priority>' . $u[3] . "</priority>\n";
    echo "  </url>\n";
}
echo '</urlset>' . "\n";
