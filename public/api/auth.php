<?php
/**
 * Member account endpoint for static / PHP hosting (Hostinger).
 *
 * Accounts are stored in berry_users.json — a file that is:
 *   - NEVER returned by /api/db (it lives outside that database entirely), and
 *   - blocked from direct HTTP access by .htaccess (Require all denied).
 *
 * The browser only ever sends a salted SHA-256 password HASH (computed in
 * utils/auth.ts); the plaintext password never leaves the device. This
 * endpoint stores/compares that hash and returns only the PUBLIC user object
 * (hash stripped), so registering once lets a reader sign in from any device
 * without exposing anyone's credentials to other visitors.
 *
 *   POST {action:'register', account:{email,username,passwordHash,...}}
 *   POST {action:'login',    email, passwordHash}
 *   POST {action:'update',   email, passwordHash, profile:{avatar,bio,...}}
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

$USERS_FILE = __DIR__ . '/berry_users.json';
$OWNER_EMAIL = 'berrymist11@gmail.com';

function load_users($f) {
    if (file_exists($f)) {
        $d = json_decode(file_get_contents($f), true);
        if (is_array($d)) return $d;
    }
    return array();
}

function save_users($f, $data) {
    $json = json_encode(array_values($data), JSON_UNESCAPED_UNICODE);
    if ($json === false) return false;
    $tmp = $f . '.tmp.' . getmypid();
    if (file_put_contents($tmp, $json, LOCK_EX) === false) { @unlink($tmp); return false; }
    if (!rename($tmp, $f)) { @unlink($tmp); return false; }
    return true;
}

// Strip the secret hash before anything is sent back to a browser.
function public_user($u) {
    unset($u['passwordHash']);
    unset($u['password']);
    return $u;
}

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'OPTIONS') { http_response_code(204); exit; }
if ($method !== 'POST') { http_response_code(405); echo json_encode(array('error' => 'method_not_allowed')); exit; }

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) { http_response_code(400); echo json_encode(array('error' => 'invalid_json')); exit; }
$action = isset($body['action']) ? $body['action'] : '';

$users = load_users($USERS_FILE);

if ($action === 'register') {
    $acc = isset($body['account']) && is_array($body['account']) ? $body['account'] : array();
    $email = isset($acc['email']) ? strtolower(trim($acc['email'])) : '';
    $username = isset($acc['username']) ? trim($acc['username']) : '';
    $hash = isset($acc['passwordHash']) ? (string)$acc['passwordHash'] : '';
    if ($email === '' || $username === '' || $hash === '') {
        http_response_code(400); echo json_encode(array('error' => 'missing_fields')); exit;
    }
    if ($email === $OWNER_EMAIL) {
        http_response_code(403); echo json_encode(array('error' => 'reserved')); exit;
    }
    foreach ($users as $u) {
        if (isset($u['email']) && strtolower($u['email']) === $email) {
            http_response_code(409); echo json_encode(array('error' => 'exists')); exit;
        }
    }
    $acc['email'] = $email;
    $acc['role'] = 'MEMBER';
    if (!isset($acc['id']) || $acc['id'] === '') $acc['id'] = 'user-' . time() . '-' . substr(md5($email), 0, 6);
    if (!isset($acc['createdAt'])) $acc['createdAt'] = gmdate('c');
    $users[] = $acc;
    if (!save_users($USERS_FILE, $users)) { http_response_code(500); echo json_encode(array('error' => 'write_failed')); exit; }
    echo json_encode(array('user' => public_user($acc)));
    exit;
}

if ($action === 'login') {
    $email = isset($body['email']) ? strtolower(trim($body['email'])) : '';
    $hash = isset($body['passwordHash']) ? (string)$body['passwordHash'] : '';
    if ($email === '' || $hash === '') { http_response_code(400); echo json_encode(array('error' => 'missing_fields')); exit; }
    foreach ($users as $u) {
        if (isset($u['email']) && strtolower($u['email']) === $email
            && isset($u['passwordHash']) && hash_equals((string)$u['passwordHash'], $hash)) {
            echo json_encode(array('user' => public_user($u)));
            exit;
        }
    }
    http_response_code(401); echo json_encode(array('error' => 'invalid'));
    exit;
}

if ($action === 'update') {
    $email = isset($body['email']) ? strtolower(trim($body['email'])) : '';
    $hash = isset($body['passwordHash']) ? (string)$body['passwordHash'] : '';
    $profile = isset($body['profile']) && is_array($body['profile']) ? $body['profile'] : array();
    $updated = null;
    foreach ($users as $i => $u) {
        if (isset($u['email']) && strtolower($u['email']) === $email
            && isset($u['passwordHash']) && hash_equals((string)$u['passwordHash'], $hash)) {
            // Only display fields — never role, email, or the hash via this path.
            foreach (array('username', 'avatar', 'bio', 'banner', 'customStatus') as $field) {
                if (array_key_exists($field, $profile)) $users[$i][$field] = $profile[$field];
            }
            $updated = $users[$i];
            break;
        }
    }
    if ($updated === null) { http_response_code(401); echo json_encode(array('error' => 'invalid')); exit; }
    if (!save_users($USERS_FILE, $users)) { http_response_code(500); echo json_encode(array('error' => 'write_failed')); exit; }
    echo json_encode(array('user' => public_user($updated)));
    exit;
}

http_response_code(400);
echo json_encode(array('error' => 'unknown_action'));
