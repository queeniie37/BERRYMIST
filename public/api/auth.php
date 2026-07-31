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

/**
 * ---------------------------------------------------------------------------
 * Account-endpoint safety rails
 * ---------------------------------------------------------------------------
 * register/login/update are all read-modify-write over one shared file, and
 * they are the only endpoint that touches credentials, so they need three
 * things the first version did not have:
 *
 *  1. A LOCK. Two people registering at the same instant both read the same
 *     user list, both pass the "email already taken" check, and the second
 *     save silently overwrites the first — the earlier account simply ceases
 *     to exist. Serialize the whole operation on a sidecar lock file.
 *
 *  2. INPUT LIMITS. Every field arrives from a browser. Without caps one
 *     request can push a multi-megabyte "bio" into the accounts file, which
 *     every later login then has to read and rewrite; a malformed address can
 *     also permanently occupy an email nobody can recover.
 *
 *  3. A BRUTE-FORCE BRAKE. The password hash is computed in the browser, so
 *     login is a plain hash comparison an attacker can hammer offline-fast.
 *     Throttle repeated failures per email+IP.
 */
function auth_lock($file) {
    $fh = @fopen($file . '.lock', 'c');
    if ($fh) { @flock($fh, LOCK_EX); }
    return $fh;
}
function auth_unlock($fh) {
    if ($fh) { @flock($fh, LOCK_UN); @fclose($fh); }
}

// Migration also comes through 'register': signing in with a legacy local
// account pushes it up so it works on every device. Its earned progress must
// survive that trip — hard-zeroing xp/level here would wipe the reading
// history of every member who predates the account server. Accept the values
// but clamp them to sane integers so they can't be inflated arbitrarily.
function auth_progress($raw, $min, $max) {
    $n = is_numeric($raw) ? (int)$raw : $min;
    if ($n < $min) $n = $min;
    if ($n > $max) $n = $max;
    return $n;
}

function valid_email($email) {
    return is_string($email)
        && strlen($email) <= 190
        && filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

// Longest value accepted per field. Avatars and banners are base64 data URIs
// produced by the client-side image compressor, so they get a larger budget
// than text fields but are still bounded.
function auth_field_limit($field) {
    if ($field === 'avatar' || $field === 'banner') return 1500000;
    if ($field === 'bio') return 1000;
    if ($field === 'username') return 40;
    return 300;
}
function auth_clip($field, $value) {
    if (!is_string($value)) return $value;
    $max = auth_field_limit($field);
    if (function_exists('mb_substr') && mb_strlen($value, 'UTF-8') > $max) {
        return mb_substr($value, 0, $max, 'UTF-8');
    }
    if (strlen($value) > $max) return substr($value, 0, $max);
    return $value;
}

// Failed-login throttle: at most AUTH_MAX_FAILS failures per email+IP inside
// AUTH_WINDOW seconds. Counters live in a small sidecar file and expire on
// their own, so nothing has to be cleaned up by hand.
define('AUTH_MAX_FAILS', 10);
define('AUTH_WINDOW', 900);

function throttle_file($usersFile) { return $usersFile . '.throttle.json'; }
function throttle_key($email) {
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '0';
    return md5(strtolower((string)$email) . '|' . $ip);
}
function throttle_load($usersFile) {
    $f = throttle_file($usersFile);
    if (!file_exists($f)) return array();
    $d = json_decode(@file_get_contents($f), true);
    if (!is_array($d)) return array();
    $now = time();
    foreach ($d as $k => $v) {
        if (!is_array($v) || !isset($v['at']) || ($now - (int)$v['at']) > AUTH_WINDOW) unset($d[$k]);
    }
    return $d;
}
function throttle_blocked($usersFile, $email) {
    $d = throttle_load($usersFile);
    $k = throttle_key($email);
    return isset($d[$k]) && (int)$d[$k]['n'] >= AUTH_MAX_FAILS;
}
function throttle_fail($usersFile, $email) {
    $d = throttle_load($usersFile);
    $k = throttle_key($email);
    $n = isset($d[$k]) ? (int)$d[$k]['n'] + 1 : 1;
    $d[$k] = array('n' => $n, 'at' => time());
    @file_put_contents(throttle_file($usersFile), json_encode($d), LOCK_EX);
}
function throttle_clear($usersFile, $email) {
    $d = throttle_load($usersFile);
    unset($d[throttle_key($email)]);
    @file_put_contents(throttle_file($usersFile), json_encode($d), LOCK_EX);
}

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'OPTIONS') { http_response_code(204); exit; }
if ($method !== 'POST') { http_response_code(405); echo json_encode(array('error' => 'method_not_allowed')); exit; }

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) { http_response_code(400); echo json_encode(array('error' => 'invalid_json')); exit; }
$action = isset($body['action']) ? $body['action'] : '';

// Hold the lock for the whole read-modify-write: without it two simultaneous
// registrations both see the email as free and the second save erases the
// first account outright.
$lock = auth_lock($USERS_FILE);
$users = load_users($USERS_FILE);

if ($action === 'register') {
    $acc = isset($body['account']) && is_array($body['account']) ? $body['account'] : array();
    $email = isset($acc['email']) ? strtolower(trim($acc['email'])) : '';
    $username = isset($acc['username']) ? trim($acc['username']) : '';
    $hash = isset($acc['passwordHash']) ? (string)$acc['passwordHash'] : '';
    if ($email === '' || $username === '' || $hash === '') {
        auth_unlock($lock);
        http_response_code(400); echo json_encode(array('error' => 'missing_fields')); exit;
    }
    if (!valid_email($email)) {
        auth_unlock($lock);
        http_response_code(400); echo json_encode(array('error' => 'invalid_email')); exit;
    }
    if ($email === $OWNER_EMAIL) {
        auth_unlock($lock);
        http_response_code(403); echo json_encode(array('error' => 'reserved')); exit;
    }
    $takenIds = array();
    foreach ($users as $u) {
        if (isset($u['email']) && strtolower($u['email']) === $email) {
            auth_unlock($lock);
            http_response_code(409); echo json_encode(array('error' => 'exists')); exit;
        }
        if (isset($u['id'])) $takenIds[$u['id']] = true;
    }
    // Store only known account fields. The raw request body used to be saved
    // as-is, so a crafted request could plant arbitrary extra properties on a
    // member record; and an id copied from another member would collide
    // everywhere the site looks a member up by id.
    $wantedId = isset($acc['id']) && is_string($acc['id']) ? trim($acc['id']) : '';
    if ($wantedId === '' || isset($takenIds[$wantedId])) {
        $wantedId = 'user-' . time() . '-' . substr(md5(uniqid($email, true)), 0, 6);
    }
    $account = array(
        'id' => $wantedId,
        'username' => auth_clip('username', $username),
        'email' => $email,
        'role' => 'MEMBER',
        'xp' => auth_progress(isset($acc['xp']) ? $acc['xp'] : 0, 0, 100000000),
        'level' => auth_progress(isset($acc['level']) ? $acc['level'] : 1, 1, 1000),
        'avatar' => isset($acc['avatar']) ? auth_clip('avatar', $acc['avatar']) : '',
        'bio' => isset($acc['bio']) ? auth_clip('bio', $acc['bio']) : '',
        'passwordHash' => $hash,
        'createdAt' => isset($acc['createdAt']) && is_string($acc['createdAt']) ? $acc['createdAt'] : gmdate('c'),
    );
    $users[] = $account;
    $saved = save_users($USERS_FILE, $users);
    auth_unlock($lock);
    if (!$saved) { http_response_code(500); echo json_encode(array('error' => 'write_failed')); exit; }
    echo json_encode(array('user' => public_user($account)));
    exit;
}

if ($action === 'login') {
    $email = isset($body['email']) ? strtolower(trim($body['email'])) : '';
    $hash = isset($body['passwordHash']) ? (string)$body['passwordHash'] : '';
    if ($email === '' || $hash === '') {
        auth_unlock($lock);
        http_response_code(400); echo json_encode(array('error' => 'missing_fields')); exit;
    }
    if (throttle_blocked($USERS_FILE, $email)) {
        auth_unlock($lock);
        http_response_code(429); echo json_encode(array('error' => 'too_many_attempts')); exit;
    }
    foreach ($users as $u) {
        if (isset($u['email']) && strtolower($u['email']) === $email
            && isset($u['passwordHash']) && hash_equals((string)$u['passwordHash'], $hash)) {
            $out = public_user($u);
            auth_unlock($lock);
            throttle_clear($USERS_FILE, $email);
            echo json_encode(array('user' => $out));
            exit;
        }
    }
    auth_unlock($lock);
    throttle_fail($USERS_FILE, $email);
    http_response_code(401); echo json_encode(array('error' => 'invalid'));
    exit;
}

if ($action === 'update') {
    $email = isset($body['email']) ? strtolower(trim($body['email'])) : '';
    $hash = isset($body['passwordHash']) ? (string)$body['passwordHash'] : '';
    $profile = isset($body['profile']) && is_array($body['profile']) ? $body['profile'] : array();
    if (throttle_blocked($USERS_FILE, $email)) {
        auth_unlock($lock);
        http_response_code(429); echo json_encode(array('error' => 'too_many_attempts')); exit;
    }
    $updated = null;
    foreach ($users as $i => $u) {
        if (isset($u['email']) && strtolower($u['email']) === $email
            && isset($u['passwordHash']) && hash_equals((string)$u['passwordHash'], $hash)) {
            // Only display fields — never role, email, or the hash via this path.
            foreach (array('username', 'avatar', 'bio', 'banner', 'customStatus') as $field) {
                if (array_key_exists($field, $profile)) $users[$i][$field] = auth_clip($field, $profile[$field]);
            }
            $updated = $users[$i];
            break;
        }
    }
    if ($updated === null) {
        auth_unlock($lock);
        throttle_fail($USERS_FILE, $email);
        http_response_code(401); echo json_encode(array('error' => 'invalid')); exit;
    }
    throttle_clear($USERS_FILE, $email);
    $saved = save_users($USERS_FILE, $users);
    auth_unlock($lock);
    if (!$saved) { http_response_code(500); echo json_encode(array('error' => 'write_failed')); exit; }
    echo json_encode(array('user' => public_user($updated)));
    exit;
}

auth_unlock($lock);
http_response_code(400);
echo json_encode(array('error' => 'unknown_action'));
