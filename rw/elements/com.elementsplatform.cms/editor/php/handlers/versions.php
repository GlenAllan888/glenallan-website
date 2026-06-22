<?php

/**
 * Version History — store timestamped snapshots of content files.
 *
 * Snapshots live in a hidden `.versions` directory next to the content files:
 *   content-folder/.versions/{basename}/{timestamp}.md
 *
 * Retention is per-tier. Free tier keeps 7 days; paid tiers carry a value
 * (or null = unlimited) inside the signed licence payload's `limits` block.
 * `MAX_VERSIONS_PER_FILE` is a hard floor that applies regardless of tier.
 */

require_once __DIR__ . '/files.php';

const MAX_VERSIONS_PER_FILE = 50;
const FREE_TIER_VERSION_DAYS = 7;

/**
 * Create a snapshot of a file's content before it is overwritten.
 * Called internally from handle_files_update — not an API endpoint.
 */
function create_version_snapshot(string $content_dir, string $filename, string $content): void {
    $basename = preg_replace('/\.md$/', '', $filename);
    $ver_dir = $content_dir . '/.versions/' . $basename;

    if (!is_dir($ver_dir)) {
        mkdir($ver_dir, 0755, true);
    }

    $ts = time();
    file_put_contents($ver_dir . '/' . $ts . '.md', $content, LOCK_EX);

    // --- Inlined paid-feature gate (retention lookup) -----------------------
    // Reads the cached licence payload directly and verifies its Ed25519
    // signature using only libsodium primitives. NOT factored into a shared
    // helper — the design intentionally requires editing each call site to
    // bypass gating, so a single PHP edit cannot disable limits everywhere.
    $_lic_path = __DIR__ . '/../.elements_license_state.json';
    $_lic_data = is_file($_lic_path) ? json_decode((string) @file_get_contents($_lic_path), true) : null;
    $_lic_entry = null;
    if (is_array($_lic_data)) foreach ($_lic_data as $_e) {
        if (!is_array($_e) || ($_e['valid'] ?? false) !== true) continue;
        if (($_e['key_id'] ?? '') !== 'v1') continue;
        $_b64 = strtr((string) ($_e['signature'] ?? ''), '-_', '+/');
        $_b64 .= str_repeat('=', (4 - strlen($_b64) % 4) % 4);
        $_sig = base64_decode($_b64, true);
        if (!is_string($_sig) || strlen($_sig) !== SODIUM_CRYPTO_SIGN_BYTES) continue;
        $_body = $_e; unset($_body['signature']);
        $_sort = function ($v) use (&$_sort) {
            if (!is_array($v)) return $v;
            $list = true; $i = 0;
            foreach ($v as $k => $_) { if ($k !== $i++) { $list = false; break; } }
            if (!$list) ksort($v);
            return array_map($_sort, $v);
        };
        $_canonical = json_encode($_sort($_body), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        // Generated from tools/license-gate-public-keys.json; run npm run sync:license-gates after rotations.
        foreach ([
            'G8OMWLmn6Mmga5u0f9r+3WN15R507VffM+lEDRKO9VY=',
        ] as $_pub_b64) {
            $_pub = base64_decode($_pub_b64, true);
            if (!is_string($_pub) || strlen($_pub) !== SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES) continue;
            try {
                if (sodium_crypto_sign_verify_detached($_sig, $_canonical, $_pub)) { $_lic_entry = $_e; break 2; }
            } catch (\SodiumException $_ex) {}
        }
    }
    $retention_days = is_array($_lic_entry['limits'] ?? null) && array_key_exists('version_history_days', $_lic_entry['limits'])
        ? $_lic_entry['limits']['version_history_days']
        : FREE_TIER_VERSION_DAYS;
    // --- end inlined gate ---------------------------------------------------

    $files = glob($ver_dir . '/*.md');
    if (!$files) return;

    // Prune by retention age first (null = unlimited).
    if ($retention_days !== null && $retention_days > 0) {
        $cutoff = $ts - ((int) $retention_days * 86400);
        foreach ($files as $f) {
            $ts_name = basename($f, '.md');
            if (ctype_digit($ts_name) && (int) $ts_name < $cutoff) {
                unlink($f);
            }
        }
        $files = glob($ver_dir . '/*.md') ?: [];
    }

    // Per-file count cap is a hard floor regardless of tier.
    if (count($files) > MAX_VERSIONS_PER_FILE) {
        sort($files, SORT_NATURAL);
        $to_remove = array_slice($files, 0, count($files) - MAX_VERSIONS_PER_FILE);
        foreach ($to_remove as $old) {
            unlink($old);
        }
    }
}

/**
 * Remove the version history directory for a deleted file.
 */
function cleanup_version_history(string $content_dir, string $filename): void {
    $basename = preg_replace('/\.md$/', '', $filename);
    $ver_dir = $content_dir . '/.versions/' . $basename;

    if (is_dir($ver_dir)) {
        $files = glob($ver_dir . '/*.md');
        if ($files) {
            array_map('unlink', $files);
        }
        rmdir($ver_dir);
    }
}

/**
 * Rename the version history directory when a file's slug changes.
 */
function rename_version_history(string $content_dir, string $old_filename, string $new_filename): void {
    $old_base = preg_replace('/\.md$/', '', $old_filename);
    $new_base = preg_replace('/\.md$/', '', $new_filename);
    $old_dir = $content_dir . '/.versions/' . $old_base;
    $new_dir = $content_dir . '/.versions/' . $new_base;

    if (is_dir($old_dir) && !file_exists($new_dir)) {
        rename($old_dir, $new_dir);
    }
}

// ---------------------------------------------------------------------------
// API Handlers
// ---------------------------------------------------------------------------

function handle_versions_list(array $cfg, array $license): never {
    $folder_index = (int) ($_GET['folder'] ?? 0);
    $folder = require_folder($cfg, $folder_index, $license);
    $filename = $_GET['file'] ?? '';
    $subpath = $_GET['subpath'] ?? '';

    $resolved = resolve_content_subpath($folder, $subpath, $license);

    $filepath = safe_path($resolved, $filename);
    if ($filepath === false || !file_exists($filepath)) {
        json_error('File not found.', 404);
    }

    $basename = preg_replace('/\.md$/', '', $filename);
    $ver_dir = $resolved . '/.versions/' . $basename;

    $versions = [];
    if (is_dir($ver_dir)) {
        foreach (glob($ver_dir . '/*.md') as $vf) {
            $ts_name = basename($vf, '.md');
            if (!ctype_digit($ts_name)) continue;
            $versions[] = [
                'timestamp' => (int) $ts_name,
                'size'      => filesize($vf),
            ];
        }
        usort($versions, fn($a, $b) => $b['timestamp'] - $a['timestamp']);
    }

    json_response([
        'versions'  => $versions,
        'current'   => [
            'modified' => filemtime($filepath),
            'size'     => filesize($filepath),
        ],
    ]);
}

function handle_versions_read(array $cfg, array $license): never {
    $folder_index = (int) ($_GET['folder'] ?? 0);
    $folder = require_folder($cfg, $folder_index, $license);
    $filename = $_GET['file'] ?? '';
    $subpath = $_GET['subpath'] ?? '';
    $timestamp = $_GET['timestamp'] ?? '';

    if (!ctype_digit($timestamp)) {
        json_error('Invalid timestamp.', 400);
    }

    $resolved = resolve_content_subpath($folder, $subpath, $license);

    $filepath = safe_path($resolved, $filename);
    if ($filepath === false || !file_exists($filepath)) {
        json_error('File not found.', 404);
    }

    $basename = preg_replace('/\.md$/', '', $filename);
    $ver_file = $resolved . '/.versions/' . $basename . '/' . $timestamp . '.md';

    if (!file_exists($ver_file)) {
        json_error('Version not found.', 404);
    }

    // Validate the version file is inside the expected directory
    $real_ver = realpath($ver_file);
    $real_dir = realpath($resolved . '/.versions/' . $basename);
    if ($real_ver === false || $real_dir === false || !str_starts_with($real_ver, $real_dir . '/')) {
        json_error('Invalid version path.', 400);
    }

    $raw = file_get_contents($ver_file);
    $parsed = parse_front_matter($raw);

    json_response([
        'timestamp' => (int) $timestamp,
        'meta'      => $parsed['meta'],
        'body'      => $parsed['body'],
        'raw'       => $raw,
    ]);
}

function handle_versions_restore(array $cfg, array $license): never {
    require_post();
    verify_csrf();

    $input = get_json_body();
    $folder_index = (int) ($input['folder'] ?? 0);
    $folder = require_folder($cfg, $folder_index, $license);
    $filename = $input['file'] ?? '';
    $subpath = $input['subpath'] ?? '';
    $timestamp = (string) ($input['timestamp'] ?? '');

    if (!ctype_digit($timestamp)) {
        json_error('Invalid timestamp.', 400);
    }

    $resolved = resolve_content_subpath($folder, $subpath, $license);

    $filepath = safe_path($resolved, $filename);
    if ($filepath === false || !file_exists($filepath)) {
        json_error('File not found.', 404);
    }

    $basename = preg_replace('/\.md$/', '', $filename);
    $ver_file = $resolved . '/.versions/' . $basename . '/' . $timestamp . '.md';

    if (!file_exists($ver_file)) {
        json_error('Version not found.', 404);
    }

    // Validate the version file is inside the expected directory
    $real_ver = realpath($ver_file);
    $real_dir = realpath($resolved . '/.versions/' . $basename);
    if ($real_ver === false || $real_dir === false || !str_starts_with($real_ver, $real_dir . '/')) {
        json_error('Invalid version path.', 400);
    }

    // Snapshot current content before restoring (so the restore is undoable)
    $current_content = file_get_contents($filepath);
    create_version_snapshot($resolved, $filename, $current_content);

    // Restore
    $version_content = file_get_contents($ver_file);
    if (file_put_contents($filepath, $version_content, LOCK_EX) === false) {
        json_error('Failed to restore version.', 500);
    }

    require_once __DIR__ . '/../webhook-dispatch.php';
    dispatch_webhooks($cfg, 'file.updated', ['filename' => $filename, 'folder' => $folder_index]);

    json_response([
        'filename' => $filename,
        'folder'   => $folder_index,
        'message'  => 'Version restored.',
    ]);
}
