<?php
// Always-current sitemap. Regenerated on every request straight from the
// shared database, so a chapter published a minute ago is already listed the
// next time any crawler asks — no rebuild and no redeploy needed.
require_once __DIR__ . '/api/seo_lib.php';

header('Content-Type: application/xml; charset=utf-8');
// Crawlers may fetch this often; a short cache keeps it cheap without
// delaying the discovery of a new chapter.
header('Cache-Control: public, max-age=300');

$origin = seo_site_origin();
$db = seo_load_db();
$novels = seo_novels($db);

$urls = array();
$add = function ($loc, $lastmod, $changefreq, $priority) use (&$urls, $origin) {
    $urls[] = array(
        'loc' => $origin . $loc,
        'lastmod' => $lastmod ? gmdate('Y-m-d', $lastmod) : null,
        'changefreq' => $changefreq,
        'priority' => $priority,
    );
};

// Newest chapter anywhere drives the homepage's lastmod, so engines see the
// site itself as freshly updated the moment a chapter goes live.
$allChapters = seo_published_chapters($db);
$newest = null;
foreach ($allChapters as $c) {
    $t = seo_lastmod($c);
    if ($t !== null && ($newest === null || $t > $newest)) $newest = $t;
}

$add('/', $newest, 'hourly', '1.0');
$add('/library', $newest, 'daily', '0.9');
$add('/suggestions', null, 'weekly', '0.5');
$add('/teams', null, 'weekly', '0.5');
$add('/contact', null, 'monthly', '0.3');
$add('/privacy', null, 'yearly', '0.2');
$add('/terms', null, 'yearly', '0.2');

foreach ($novels as $n) {
    $chapters = seo_published_chapters($db, isset($n['id']) ? $n['id'] : null);
    // A novel with no readable chapter yet is still worth listing (it has a
    // synopsis and cover), just at a lower priority.
    $novelMod = seo_lastmod($n);
    foreach ($chapters as $c) {
        $t = seo_lastmod($c);
        if ($t !== null && ($novelMod === null || $t > $novelMod)) $novelMod = $t;
    }
    $add(seo_novel_url($n), $novelMod, 'daily', $chapters ? '0.9' : '0.6');

    foreach ($chapters as $c) {
        $add(seo_chapter_url($n, $c), seo_lastmod($c), 'weekly', '0.8');
    }
}

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
foreach ($urls as $u) {
    echo "  <url>\n";
    echo '    <loc>' . htmlspecialchars($u['loc'], ENT_XML1, 'UTF-8') . "</loc>\n";
    if (!empty($u['lastmod'])) echo '    <lastmod>' . $u['lastmod'] . "</lastmod>\n";
    echo '    <changefreq>' . $u['changefreq'] . "</changefreq>\n";
    echo '    <priority>' . $u['priority'] . "</priority>\n";
    echo "  </url>\n";
}
echo "</urlset>\n";
