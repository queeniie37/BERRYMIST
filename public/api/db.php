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
    if ($t === false) return 0;

// A record's timestamp decides who wins a merge. A value far in the FUTURE
// would therefore win every merge forever — no later, legitimate edit could
// ever overwrite it, and a tombstone stamped year 9999 would keep the record
// deleted permanently. Clock drift on real devices is small, so anything more
// than a day ahead is clamped to now: honest records are unaffected, and a
// poisoned one loses its permanent advantage as soon as a real edit lands.
    $cap = time() + 86400;
    if ($t > $cap) $t = $cap;
    return $t * 1000;
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

/**
 * Novels and chapters used to be stored as a whole-array replace: any device
 * holding a stale list (an old open tab, a reader whose view counter fired
 * before the first sync, another translator publishing) erased every record
 * it didn't know about — which is how freshly published novels and scheduled
 * chapters kept disappearing for visitors. Merge like comments instead:
 * records only the server knows about are KEPT, for records both sides know
 * the newest version wins, and deletions arrive as tombstones
 * ({deleted:true}) so they propagate without letting a stale client wipe
 * data; tombstones older than 30 days are purged.
 */
function merge_by_id($stored, $incoming) {
    $stored = is_array($stored) ? $stored : array();
    $incoming = is_array($incoming) ? $incoming : array();
    $by_id = array();
    foreach ($stored as $c) {
        if (is_array($c) && isset($c['id']) && is_string($c['id'])) $by_id[$c['id']] = $c;
    }
    foreach ($incoming as $c) {
        if (!is_array($c) || !isset($c['id']) || !is_string($c['id'])) continue;
        $prev = isset($by_id[$c['id']]) ? $by_id[$c['id']] : null;
        if ($prev === null) {
            $by_id[$c['id']] = $c;
        } else {
            // Newest version wins, but views are monotonic — keep the higher
            // count so a stale array push can't reset views raised by readers.
            $winner = comment_time($c) >= comment_time($prev) ? $c : $prev;
            $pv = isset($prev['views']) ? (int)$prev['views'] : 0;
            $cv = isset($c['views']) ? (int)$c['views'] : 0;
            $winner['views'] = max($pv, $cv);
            $by_id[$c['id']] = $winner;
        }
    }
    $cutoff = (time() - 30 * 24 * 60 * 60) * 1000;
    $merged = array();
    foreach ($by_id as $c) {
        if (empty($c['deleted']) || comment_time($c) > $cutoff) $merged[] = $c;
    }
    return $merged;
}

/**
 * Every write is a read-modify-write of ONE shared file. Without a lock two
 * simultaneous POSTs both read the same snapshot, each applies its own key and
 * the second rename() throws away the first one's work — a published chapter
 * or a fresh comment silently vanishes. view.php already serialized its view
 * increments on this sidecar lock file; db.php did not, so a publish landing
 * at the same moment as a view could lose either one. Use the SAME lock file
 * so all writers, whichever endpoint they arrive through, are serialized.
 */
function db_lock($file) {
    $fh = @fopen($file . '.lock', 'c');
    if ($fh) { @flock($fh, LOCK_EX); }
    return $fh;
}
function db_unlock($fh) {
    if ($fh) { @flock($fh, LOCK_UN); @fclose($fh); }
}

/**
 * Compress the response when the visitor's browser accepts it.
 *
 * This endpoint returns the WHOLE shared database, so it grows with the
 * library — and every visitor downloads it on their first entry before a
 * single chapter can be listed. Uncompressed, a real library made that a
 * multi-second wait on mobile data: the page frame appeared but the chapters
 * did not. JSON of this kind compresses several times over, so switching it
 * on is the difference between "the chapters are there when the page opens"
 * and "the chapters arrive later".
 *
 * ob_gzhandler checks Accept-Encoding itself and does nothing for a client
 * that cannot handle gzip, and Apache/LiteSpeed will not re-compress a
 * response that already carries Content-Encoding, so this is safe whether or
 * not mod_deflate is also active.
 */
function compress_output() {
    if (!extension_loaded('zlib')) return;
    if (ini_get('zlib.output_compression')) return; // already handled by PHP
    if (headers_sent()) return;
    @ob_start('ob_gzhandler');
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

    compress_output();
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

    // Hard ceiling on a single write. Covers a full novel with base64 covers
    // and chapter images, but stops one request from pushing an unbounded
    // blob into the shared file that every visitor then has to download.
    if (strlen($raw) > 40 * 1024 * 1024) {
        http_response_code(413);
        echo json_encode(array('error' => 'Payload too large'));
        exit;
    }

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

    $lock = db_lock($DB_FILE);
    $db = load_db($DB_FILE);

    // Rotating backups BEFORE applying the write, so the site's data can
    // always be restored if a bug or a malicious visitor wipes content
    // (the API is writable by design — every publish comes from a browser).
    // Two tiers in api/backups/, both readable by the owner's recovery tool:
    //   - hourly  berry_db-YYYYMMDD-HH.json    (newest 48 kept  ≈ 2 days)
    //   - daily   berry_db-daily-YYYYMMDD.json (newest 30 kept  = 1 month)
    $backupDir = __DIR__ . '/backups';
    if (!is_dir($backupDir)) { @mkdir($backupDir, 0755, true); }
    if (is_dir($backupDir) && file_exists($DB_FILE)) {
        $rotate = function ($files, $keep) {
            if ($files && count($files) > $keep) {
                sort($files);
                foreach (array_slice($files, 0, count($files) - $keep) as $f) { @unlink($f); }
            }
        };

        $hourFile = $backupDir . '/berry_db-' . gmdate('Ymd-H') . '.json';
        if (!file_exists($hourFile)) {
            @copy($DB_FILE, $hourFile);
            $hourly = glob($backupDir . '/berry_db-*.json');
            $hourly = array_values(array_filter($hourly ?: array(), function ($f) {
                return strpos(basename($f), 'daily') === false;
            }));
            $rotate($hourly, 48);
        }

        $dayFile = $backupDir . '/berry_db-daily-' . gmdate('Ymd') . '.json';
        if (!file_exists($dayFile)) {
            @copy($DB_FILE, $dayFile);
            $rotate(glob($backupDir . '/berry_db-daily-*.json'), 30);
        }
    }

    $value = isset($body['value']) ? $body['value'] : null;
    if ($key === 'comments') {
        $value = merge_comments(isset($db[$key]) ? $db[$key] : array(), $value);
    } elseif ($key === 'chapters' || $key === 'novels' || $key === 'contact_messages') {
        $value = merge_by_id(isset($db[$key]) ? $db[$key] : array(), $value);
    } elseif ($key === 'user_directory') {
        // Public profile directory: merge per-user keys so one member
        // updating their profile can never wipe another member's entry.
        $stored = isset($db[$key]) && is_array($db[$key]) ? $db[$key] : array();
        $incoming = is_array($value) ? $value : array();
        $value = array_merge($stored, $incoming);
    }
    $db[$key] = $value;
    $saved = save_db($DB_FILE, $db);
    db_unlock($lock);
    if (!$saved) {
        http_response_code(500);
        echo json_encode(array('error' => 'Failed to write database file'));
        exit;
    }
    echo json_encode(array('success' => true));
    exit;
}

http_response_code(405);
echo json_encode(array('error' => 'Method not allowed'));
