<?php
/**
 * Atomic view-count increment for static / PHP hosting (Hostinger).
 *
 * The reader's browser calls this ONCE, after spending 30 seconds on a
 * chapter (deduped per device). Incrementing on the SERVER — instead of the
 * client pushing a whole novels/chapters array — means concurrent readers
 * each add exactly one view instead of overwriting one another's count.
 *
 * The whole read-modify-write is wrapped in an exclusive flock so two
 * simultaneous readers can't both read the same value and lose an increment.
 *
 *   POST {novelId, chapterId}
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

$DB_FILE = __DIR__ . '/berry_db.json';

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'OPTIONS') { http_response_code(204); exit; }
if ($method !== 'POST') { http_response_code(405); echo json_encode(array('error' => 'method_not_allowed')); exit; }

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) { http_response_code(400); echo json_encode(array('error' => 'invalid_json')); exit; }
$novelId = isset($body['novelId']) ? $body['novelId'] : null;
$chapterId = isset($body['chapterId']) ? $body['chapterId'] : null;

// Serialize the whole read-modify-write with an exclusive lock on a sidecar
// lock file, so concurrent increments never lose a count.
$lockPath = $DB_FILE . '.lock';
$lock = @fopen($lockPath, 'c');
if ($lock) { @flock($lock, LOCK_EX); }

$db = array();
if (file_exists($DB_FILE)) {
    $raw = file_get_contents($DB_FILE);
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) $db = $decoded;
}

if ($novelId && isset($db['novels']) && is_array($db['novels'])) {
    foreach ($db['novels'] as &$n) {
        if (is_array($n) && isset($n['id']) && $n['id'] === $novelId) {
            $n['views'] = (isset($n['views']) ? (int)$n['views'] : 0) + 1;
        }
    }
    unset($n);
}
if ($chapterId && isset($db['chapters']) && is_array($db['chapters'])) {
    foreach ($db['chapters'] as &$c) {
        if (is_array($c) && isset($c['id']) && $c['id'] === $chapterId) {
            $c['views'] = (isset($c['views']) ? (int)$c['views'] : 0) + 1;
        }
    }
    unset($c);
}

$json = json_encode($db, JSON_UNESCAPED_UNICODE);
$ok = false;
if ($json !== false) {
    $tmp = $DB_FILE . '.tmp.' . getmypid();
    if (file_put_contents($tmp, $json) !== false) {
        $ok = rename($tmp, $DB_FILE);
        if (!$ok) @unlink($tmp);
    }
}

if ($lock) { @flock($lock, LOCK_UN); @fclose($lock); }

if (!$ok) { http_response_code(500); echo json_encode(array('error' => 'write_failed')); exit; }
echo json_encode(array('success' => true));
