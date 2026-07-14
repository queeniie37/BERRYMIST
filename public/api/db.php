<?php
/**
 * Shared database endpoint for static / PHP hosting (e.g. Hostinger).
 *
 * This is a drop-in replacement for the Express `/api/db` route in server.ts,
 * so the site works on hosts that serve files + PHP but do NOT run a persistent
 * Node.js process. All visitors read and write the same berry_db.json, which is
 * what makes published novels visible to everyone.
 *
 * Behaviour mirrors server.ts exactly:
 *   GET  /api/db          -> returns the whole shared DB (private keys stripped)
 *   POST /api/db {key,value} -> stores one key (private keys rejected)
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Per-user / private keys must never be stored in or served from the shared DB.
$PRIVATE_KEYS = ['users_db', 'current_user_data', 'current_role', 'bookmarks', 'reading_history'];

// Keep the data file OUTSIDE the web root would be ideal, but next to this
// script is the most reliable writable location on shared hosting.
$DB_FILE = __DIR__ . '/berry_db.json';

function load_db($file) {
    if (file_exists($file)) {
        $raw = file_get_contents($file);
        $data = json_decode($raw, true);
        if (is_array($data)) return $data;
    }
    return array();
}

function save_db($file, $data) {
    // Atomic write: encode to a temp file first, then rename over the real
    // file. If PHP is killed mid-write (big payloads on shared hosting),
    // berry_db.json is never left half-written/corrupt for all visitors.
    $json = json_encode($data, JSON_UNESCAPED_UNICODE);
    if ($json === false) return false;
    $tmp = $file . '.tmp.' . getmypid();
    if (file_put_contents($tmp, $json, LOCK_EX) === false) {
        @unlink($tmp);
        return false;
    }
    if (!rename($tmp, $file)) {
        @unlink($tmp);
        return false;
    }
    return true;
}

/**
 * Comments are written by many visitors at once. A plain "replace the whole
 * array" write makes the last writer erase everyone else's fresh comments,
 * so the server merges instead: comments only the server knows about are
 * kept, and for comments both sides know the newest version wins. Deleted
 * comments arrive as tombstones ({deleted:true}) so deletions survive the
 * merge; tombstones older than 30 days are purged.
 */
function comment_time($c) {
    if (!is_array($c)) return 0;
    $raw = isset($c['updatedAt']) ? $c['updatedAt'] : (isset($c['createdAt']) ? $c['createdAt'] : '');
    if (!is_string($raw) || $raw === '') return 0;
    $t = strtotime($raw);
    return $t === false ? 0 : $t * 1000;
}

function merge_comments($stored, $incoming) {
    $stored = is_array($stored) ? $stored : array();
    $incoming = is_array($incoming) ? $incoming : array();
    $by_id = array();
    foreach ($stored as $c) {
        if (is_array($c) && isset($c['id']) && is_string($c['id'])) $by_id[$c['id']] = $c;
    }
    foreach ($incoming as $c) {
        if (!is_array($c) || !isset($c['id']) || !is_string($c['id'])) continue;
        $prev = isset($by_id[$c['id']]) ? $by_id[$c['id']] : null;
        if ($prev === null || comment_time($c) >= comment_time($prev)) $by_id[$c['id']] = $c;
    }
    $cutoff = (time() - 30 * 24 * 60 * 60) * 1000;
    $merged = array();
    foreach ($by_id as $c) {
        if (empty($c['deleted']) || comment_time($c) > $cutoff) $merged[] = $c;
    }
    usort($merged, function ($a, $b) {
        $ta = comment_time($a);
        $tb = comment_time($b);
        if ($ta === $tb) return 0;
        return $tb > $ta ? 1 : -1;
    });
    return $merged;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($method === 'GET') {
    // Cheap conditional polling: the client polls every couple of seconds
    // to make new comments/chapters appear for everyone almost instantly.
    // When nothing changed we answer 304 with an empty body instead of
    // re-sending the whole database file.
    $etag = file_exists($DB_FILE)
        ? '"' . md5(filemtime($DB_FILE) . '-' . filesize($DB_FILE)) . '"'
        : '"empty"';
    header('ETag: ' . $etag);
    $inm = isset($_SERVER['HTTP_IF_NONE_MATCH']) ? trim($_SERVER['HTTP_IF_NONE_MATCH']) : '';
    if ($inm !== '' && $inm === $etag) {
        http_response_code(304);
        exit;
    }

    $db = load_db($DB_FILE);
    foreach ($PRIVATE_KEYS as $k) {
        unset($db[$k]);
    }
    // Always emit a JSON object (never a bare []) so the client can safely
    // do `key in serverDb`, matching the Express server's behaviour.
    if (empty($db)) {
        echo '{}';
    } else {
        echo json_encode($db, JSON_UNESCAPED_UNICODE);
    }
    exit;
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');

    // A payload larger than post_max_size arrives truncated or empty.
    // Reject it explicitly so the client keeps the write pending and
    // retries, instead of silently losing the published novel.
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        http_response_code(400);
        echo json_encode(array('error' => 'Invalid or truncated JSON payload (possibly exceeds post_max_size)'));
        exit;
    }
    $key = isset($body['key']) ? $body['key'] : null;

    if (!$key || !is_string($key)) {
        http_response_code(400);
        echo json_encode(array('error' => 'Missing key'));
        exit;
    }
    if (in_array($key, $PRIVATE_KEYS, true)) {
        http_response_code(403);
        echo json_encode(array('error' => 'This key is private and cannot be synced'));
        exit;
    }

    $db = load_db($DB_FILE);

    // Rotating hourly backup BEFORE applying the write, so the site's data
    // can always be restored if a bug or a malicious visitor wipes content
    // (the API is writable by design — every publish comes from a browser).
    // Keeps the newest 24 hourly snapshots in api/backups/.
    $backupDir = __DIR__ . '/backups';
    if (!is_dir($backupDir)) { @mkdir($backupDir, 0755, true); }
    if (is_dir($backupDir) && file_exists($DB_FILE)) {
        $stampFile = $backupDir . '/berry_db-' . gmdate('Ymd-H') . '.json';
        if (!file_exists($stampFile)) {
            @copy($DB_FILE, $stampFile);
            $old = glob($backupDir . '/berry_db-*.json');
            if ($old && count($old) > 24) {
                sort($old);
                foreach (array_slice($old, 0, count($old) - 24) as $f) { @unlink($f); }
            }
        }
    }

    $value = isset($body['value']) ? $body['value'] : null;
    if ($key === 'comments') {
        $value = merge_comments(isset($db[$key]) ? $db[$key] : array(), $value);
    }
    $db[$key] = $value;
    if (!save_db($DB_FILE, $db)) {
        http_response_code(500);
        echo json_encode(array('error' => 'Failed to write database file'));
        exit;
    }
    echo json_encode(array('success' => true));
    exit;
}

http_response_code(405);
echo json_encode(array('error' => 'Method not allowed'));
