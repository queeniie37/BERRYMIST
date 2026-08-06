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

require_once __DIR__ . '/storage.php';
berry_migrate_legacy();
$DB_FILE = berry_db_file();
// Snapshots live outside the web root so deploys cannot wipe them; the old
// in-API folder is scanned too, for backups created before the move.
$BACKUP_DIRS = array_unique(array(berry_backup_dir(), __DIR__ . '/backups'));

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
$files = array();
foreach ($BACKUP_DIRS as $bd) {
    $g = glob($bd . '/berry_db-*.json');
    if (is_array($g)) $files = array_merge($files, $g);
}
$files = array_unique($files);
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
