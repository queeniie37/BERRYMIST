<?php
// Instant "this page is new" notification to the search engines.
//
// A sitemap only helps once a crawler decides to come back. IndexNow flips
// that around: the moment a chapter is published, the site pushes its URL and
// the participating engines (Bing, Yandex, Naver, Seznam — submissions are
// shared between them) fetch it right away. Google does not join IndexNow, so
// it is nudged with a sitemap ping instead.
//
// Called by the app right after a chapter goes live. It is deliberately
// tolerant: a search engine being slow or unreachable must never make
// publishing a chapter look like it failed.

require_once __DIR__ . '/seo_lib.php';

header('Content-Type: application/json; charset=utf-8');

// Public by design — IndexNow keys are verified by hosting a matching
// <key>.txt at the site root, so the key is not a secret.
$INDEXNOW_KEY = '5f536f669fb8ff3175456da02102ac9a';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(array('error' => 'POST required'));
    exit;
}

$raw = file_get_contents('php://input');
$body = json_decode($raw, true);
if (!is_array($body)) $body = array();

$origin = seo_site_origin();
$host = preg_replace('#^https?://#', '', $origin);

// Build the list of URLs to announce. The caller may name a novel and an
// optional chapter; both that page and the pages that link to it are worth
// refreshing so the new chapter is discovered from every direction.
$urls = array();
$push = function ($u) use (&$urls, $origin) {
    $full = strpos($u, 'http') === 0 ? $u : $origin . $u;
    if (!in_array($full, $urls, true)) $urls[] = $full;
};

if (!empty($body['urls']) && is_array($body['urls'])) {
    foreach ($body['urls'] as $u) {
        if (is_string($u) && $u !== '') $push($u);
    }
}

if (!empty($body['novelId'])) {
    $db = seo_load_db();
    $novel = null;
    foreach (seo_novels($db) as $n) {
        if (isset($n['id']) && $n['id'] === $body['novelId']) { $novel = $n; break; }
    }
    if ($novel !== null) {
        if (isset($body['chapterNumber']) && $body['chapterNumber'] !== '') {
            $push(seo_novel_url($novel) . '/chapter-' . (int)$body['chapterNumber']);
        }
        $push(seo_novel_url($novel));
    }
}

// The homepage and library both list the newest chapters, so they changed too.
$push('/');
$push('/library');

if (!$urls) {
    echo json_encode(array('ok' => false, 'reason' => 'no urls'));
    exit;
}

// IndexNow caps a single submission; stay well inside it.
$urls = array_slice($urls, 0, 100);

$results = array();

// ---- IndexNow (Bing / Yandex / Naver / Seznam share submissions) ----
$payload = json_encode(array(
    'host' => $host,
    'key' => $INDEXNOW_KEY,
    'keyLocation' => $origin . '/' . $INDEXNOW_KEY . '.txt',
    'urlList' => $urls,
), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

if (function_exists('curl_init')) {
    $ch = curl_init('https://api.indexnow.org/indexnow');
    curl_setopt_array($ch, array(
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => array('Content-Type: application/json; charset=utf-8'),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 8,
    ));
    curl_exec($ch);
    $results['indexnow'] = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
} else {
    $ctx = stream_context_create(array('http' => array(
        'method' => 'POST',
        'header' => "Content-Type: application/json; charset=utf-8\r\n",
        'content' => $payload,
        'timeout' => 8,
        'ignore_errors' => true,
    )));
    $results['indexnow'] = @file_get_contents('https://api.indexnow.org/indexnow', false, $ctx) !== false ? 200 : 0;
}

// ---- Google: no IndexNow support, so refresh the sitemap instead ----
$sitemap = urlencode($origin . '/sitemap.xml');
$ping = function ($url) {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, array(
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 8,
            CURLOPT_FOLLOWLOCATION => true,
        ));
        curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return $code;
    }
    $ctx = stream_context_create(array('http' => array('timeout' => 8, 'ignore_errors' => true)));
    return @file_get_contents($url, false, $ctx) !== false ? 200 : 0;
};
$results['google_sitemap'] = $ping('https://www.google.com/ping?sitemap=' . $sitemap);

echo json_encode(array('ok' => true, 'submitted' => count($urls), 'results' => $results), JSON_UNESCAPED_SLASHES);
