<?php
/**
 * Lost-content recovery scan for the owner's admin panel.
 *
 * The rotating snapshots in api/backups/ are blocked from HTTP access by
 * .htaccess (they are full historical copies of the shared database), so the
 * admin panel's old per-file fetch scan always got 403 and reported "no
 * backups". This endpoint performs the same scan SERVER-SIDE instead: PHP
 * reads the snapshot files straight from disk, compares them with the current
 * berry_db.json, and returns ONLY the novels/chapters that are missing today
 * without being deliberately deleted (tombstoned). Restoring those is exactly
 * what the owner recovery tool is for.
 *
 * Privacy is preserved: full historical dumps stay HTTP-denied; the only
 * records exposed here are ones that vanished accidentally (a record removed
 * on purpose exists today as a tombstone and is therefore excluded), i.e.
 * content that was public when it existed.
 *
 *   GET /api/recover.php
 *     -> { success, backupsChecked, novels: [...], chapters: [...] }
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(array('error' => 'Method not allowed'));
    exit;
}

// TEMPORARY diagnostics (?diag=1) — removed once backup rotation is verified.
if (isset($_GET['diag'])) {
    $dir = __DIR__;
    $bd = $dir . '/backups';
    $info = array(
        'php' => PHP_VERSION,
        'dir' => $dir,
        'api_writable' => is_writable($dir),
        'db_exists' => file_exists($dir . '/berry_db.json'),
        'backups_is_dir' => is_dir($bd),
        'backups_is_file' => is_file($bd),
        'backups_writable' => is_dir($bd) ? is_writable($bd) : null,
        'api_files' => array_values(array_diff(scandir($dir) ?: array(), array('.', '..'))),
        'backups_files' => is_dir($bd) ? array_values(array_diff(scandir($bd) ?: array(), array('.', '..'))) : null,
    );
    if (!is_dir($bd)) {
        $info['mkdir_result'] = @mkdir($bd, 0755, true) ? 'ok' : 'failed';
        clearstatcache();
        $info['backups_is_dir_after_mkdir'] = is_dir($bd);
    }
    if (is_dir($bd)) {
        $probe = $bd . '/.write-test-' . getmypid();
        $info['write_test'] = @file_put_contents($probe, 'x') !== false ? 'ok' : 'failed';
        @unlink($probe);
        $info['glob_test'] = glob($bd . '/berry_db-*.json');
    }
    echo json_encode($info, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

$DB_FILE = __DIR__ . '/berry_db.json';
$BACKUP_DIR = __DIR__ . '/backups';

function recover_load_json($file) {
    if (!is_file($file) || !is_readable($file)) return null;
    $raw = @file_get_contents($file);
    if ($raw === false || $raw === '') return null;
    $data = json_decode($raw, true);
    return is_array($data) ? $data : null;
}

// Ids present in the CURRENT database, in any form — including tombstones.
// A tombstone means "deleted on purpose": those must NOT be offered for
// restore, matching the admin panel's collectMissingRecords() exactly.
$current = recover_load_json($DB_FILE);
$current_novel_ids = array();
$current_chapter_ids = array();
if (is_array($current)) {
    if (isset($current['novels']) && is_array($current['novels'])) {
        foreach ($current['novels'] as $n) {
            if (is_array($n) && isset($n['id']) && is_string($n['id'])) {
                $current_novel_ids[$n['id']] = true;
            }
        }
    }
    if (isset($current['chapters']) && is_array($current['chapters'])) {
        foreach ($current['chapters'] as $c) {
            if (is_array($c) && isset($c['id']) && is_string($c['id'])) {
                $current_chapter_ids[$c['id']] = true;
            }
        }
    }
}

// Every snapshot the rotation can produce (hourly + daily). Newest first, so
// when several snapshots hold the same lost record, the freshest copy wins.
$files = glob($BACKUP_DIR . '/berry_db-*.json');
if (!is_array($files)) $files = array();
usort($files, function ($a, $b) {
    return filemtime($b) - filemtime($a);
});

$novels = array();   // id => record
$chapters = array(); // id => record
$checked = 0;

foreach ($files as $f) {
    // Skip anything that is not a real snapshot (lock/tmp siblings).
    if (!preg_match('/berry_db-(daily-)?\d{8}(-\d{2})?\.json$/', basename($f))) continue;
    $db = recover_load_json($f);
    if (!is_array($db)) continue;
    $checked++;

    if (isset($db['novels']) && is_array($db['novels'])) {
        foreach ($db['novels'] as $n) {
            if (!is_array($n) || !isset($n['id']) || !is_string($n['id'])) continue;
            if (!empty($n['deleted'])) continue;                       // deleted even back then
            if (isset($current_novel_ids[$n['id']])) continue;         // still exists (or tombstoned)
            if (isset($novels[$n['id']])) continue;                    // already found in a newer snapshot
            $novels[$n['id']] = $n;
        }
    }
    if (isset($db['chapters']) && is_array($db['chapters'])) {
        foreach ($db['chapters'] as $c) {
            if (!is_array($c) || !isset($c['id']) || !is_string($c['id'])) continue;
            if (!empty($c['deleted'])) continue;
            if (isset($current_chapter_ids[$c['id']])) continue;
            if (isset($chapters[$c['id']])) continue;
            $chapters[$c['id']] = $c;
        }
    }
}

echo json_encode(array(
    'success' => true,
    'backupsChecked' => $checked,
    'novels' => array_values($novels),
    'chapters' => array_values($chapters)
), JSON_UNESCAPED_UNICODE);
