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
    // LOCK_EX guards against two visitors writing at the same moment.
    file_put_contents(
        $file,
        json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT),
        LOCK_EX
    );
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($method === 'GET') {
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
    $body = json_decode(file_get_contents('php://input'), true);
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
    $db[$key] = isset($body['value']) ? $body['value'] : null;
    save_db($DB_FILE, $db);
    echo json_encode(array('success' => true));
    exit;
}

http_response_code(405);
echo json_encode(array('error' => 'Method not allowed'));
