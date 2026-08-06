<?php
/**
 * Central storage location for ALL runtime data: the shared database
 * (berry_db.json), member accounts (berry_users.json), rotating backups,
 * and small sidecar state (locks, throttles, the IndexNow key).
 *
 * WHY THIS FILE EXISTS: Hostinger's Git deploy rebuilds the site and
 * replaces the ENTIRE web root on every push. Anything not in the repo —
 * including api/berry_db.json and api/backups/ — is silently deleted, which
 * is exactly why published novels and accounts kept vanishing after every
 * update. Runtime data therefore lives OUTSIDE the web root, in a sibling
 * folder the deploy never touches. As a bonus, files outside the web root
 * can never be downloaded over HTTP at all.
 *
 * Location resolution (first writable wins):
 *   1. BERRY_DATA_DIR environment variable, if set
 *   2. <domain dir>/berrymist_data  — sibling of public_html (production)
 *   3. the api/ directory itself    — legacy fallback (dev / strict hosts)
 */

function berry_ensure_writable_dir($path) {
    if (!is_dir($path)) { @mkdir($path, 0750, true); }
    return is_dir($path) && is_writable($path);
}

function berry_storage_dir() {
    static $dir = null;
    if ($dir !== null) return $dir;

    $candidates = array();
    $env = getenv('BERRY_DATA_DIR');
    if (is_string($env) && $env !== '') $candidates[] = $env;
    // .../public_html/api  ->  .../berrymist_data (sibling of the web root)
    $candidates[] = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'berrymist_data';
    $candidates[] = __DIR__; // legacy fallback

    foreach ($candidates as $cand) {
        if (berry_ensure_writable_dir($cand)) { $dir = $cand; break; }
    }
    if ($dir === null) $dir = __DIR__;
    return $dir;
}

function berry_db_file()    { return berry_storage_dir() . '/berry_db.json'; }
function berry_users_file() { return berry_storage_dir() . '/berry_users.json'; }
function berry_backup_dir() { return berry_storage_dir() . '/backups'; }

/**
 * One-time move from the legacy in-web-root locations (api/berry_db.json,
 * api/berry_users.json, api/backups/). Runs on every request but costs only
 * a couple of file_exists() calls once there is nothing left to move.
 * Copy (not rename): the legacy tree may be read-only or vanish mid-deploy.
 */
function berry_migrate_legacy() {
    static $done = false;
    if ($done) return;
    $done = true;

    $dir = berry_storage_dir();
    if (realpath($dir) === realpath(__DIR__)) return; // legacy == current

    $pairs = array(
        __DIR__ . '/berry_db.json'    => berry_db_file(),
        __DIR__ . '/berry_users.json' => berry_users_file(),
    );
    foreach ($pairs as $old => $new) {
        if (is_file($old) && !file_exists($new)) { @copy($old, $new); }
    }

    $oldBackups = __DIR__ . '/backups';
    if (is_dir($oldBackups)) {
        $files = glob($oldBackups . '/berry_db-*.json');
        if (is_array($files) && count($files)) {
            berry_ensure_writable_dir(berry_backup_dir());
            foreach ($files as $f) {
                $target = berry_backup_dir() . '/' . basename($f);
                if (!file_exists($target)) { @copy($f, $target); }
            }
        }
    }
}
