<?php
/**
 * IndexNow: tell search engines about a URL the moment it is published.
 *
 * Sitemaps are how engines DISCOVER pages, but they are polled on the engine's
 * own schedule. IndexNow is a push instead: one request and Bing, Yandex,
 * Seznam and Naver fetch the URL right away (they share submissions with each
 * other). Google does not participate in IndexNow — for Google the fast path is
 * the sitemap plus Search Console, which is why chapters are now listed there.
 *
 * POST /api/indexnow  {"url": "https://berrymist.online/novel/slug/12"}
 *   or {"urls": ["...", "..."]}
 *
 * The protocol requires proving ownership by hosting <key>.txt at the site
 * root containing the key; this script creates that file automatically on
 * first use, so there is nothing to configure by hand.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(array('error' => 'Method not allowed'));
    exit;
}

$HOST = 'berrymist.online';
$SITE = 'https://' . $HOST;
$KEY_STORE = __DIR__ . '/indexnow_key.txt';
$WEB_ROOT = dirname(__DIR__);

// Stable per-site key, created once.
$key = file_exists($KEY_STORE) ? trim(file_get_contents($KEY_STORE)) : '';
if ($key === '' || !preg_match('/^[a-f0-9]{32}$/', $key)) {
    $key = md5(uniqid('mistvil', true) . microtime(true));
    @file_put_contents($KEY_STORE, $key);
}
// The engines verify ownership by fetching https://<host>/<key>.txt
$keyFile = $WEB_ROOT . '/' . $key . '.txt';
if (!file_exists($keyFile)) { @file_put_contents($keyFile, $key); }

$body = json_decode(file_get_contents('php://input'), true);
$urls = array();
if (is_array($body)) {
    if (!empty($body['url']) && is_string($body['url'])) $urls[] = $body['url'];
    if (!empty($body['urls']) && is_array($body['urls'])) {
        foreach ($body['urls'] as $u) { if (is_string($u)) $urls[] = $u; }
    }
}
// Only ever submit URLs belonging to this site.
$clean = array();
foreach ($urls as $u) {
    $u = trim($u);
    if (strpos($u, $SITE . '/') === 0 && !in_array($u, $clean, true)) $clean[] = $u;
}
if (!count($clean)) {
    http_response_code(400);
    echo json_encode(array('error' => 'No valid URLs for this site'));
    exit;
}
$clean = array_slice($clean, 0, 100);

$payload = json_encode(array(
    'host' => $HOST,
    'key' => $key,
    'keyLocation' => $SITE . '/' . $key . '.txt',
    'urlList' => $clean,
), JSON_UNESCAPED_SLASHES);

$status = 0;
$err = '';
if (function_exists('curl_init')) {
    $ch = curl_init('https://api.indexnow.org/indexnow');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json; charset=utf-8'));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 8);
    $res = curl_exec($ch);
    if ($res === false) $err = curl_error($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
} else {
    $ctx = stream_context_create(array('http' => array(
        'method' => 'POST',
        'header' => "Content-Type: application/json; charset=utf-8\r\n",
        'content' => $payload,
        'timeout' => 8,
        'ignore_errors' => true,
    )));
    $res = @file_get_contents('https://api.indexnow.org/indexnow', false, $ctx);
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
        $status = (int)$m[1];
    }
    if ($res === false) $err = 'stream request failed';
}

// 200/202 mean accepted. Anything else is reported but never breaks publishing —
// the sitemap still carries the URL.
echo json_encode(array(
    'submitted' => count($clean),
    'status' => $status,
    'ok' => ($status === 200 || $status === 202),
    'error' => $err,
));
