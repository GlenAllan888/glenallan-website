<?php

function handle_resources_list(array $cfg, array $license): never {
    $folder_index = (int) ($_GET['folder'] ?? 0);
    $upload_folder = require_resource_folder($cfg, $folder_index, $license);
    $uploads_path = $upload_folder['path'];
    $uploads_url = rtrim($upload_folder['url'], '/');
    $allowed_img = $cfg['allowed_image_types'];
    $subpath = $_GET['subpath'] ?? '';
    $is_licensed = !empty($license['valid']);

    if ($subpath !== '' && !$is_licensed) {
        json_error('License required to browse subfolders.', 403);
    }

    $resolved = safe_subpath($uploads_path, $subpath);
    if ($resolved === false) {
        json_error('Invalid subpath.', 400);
    }

    $files = [];
    $dirs = [];
    if (is_dir($resolved)) {
        foreach (scandir($resolved) as $entry) {
            if ($entry[0] === '.') continue;
            $full = $resolved . '/' . $entry;
            if (is_dir($full) && $is_licensed) {
                $dirs[] = ['name' => $entry, 'type' => 'dir'];
            } elseif (is_file($full)) {
                $files[] = resource_info($resolved, $uploads_url, $allowed_img, $entry, $subpath);
            }
        }
        usort($dirs, fn($a, $b) => strcasecmp($a['name'], $b['name']));
        usort($files, fn($a, $b) => $b['modified'] - $a['modified']);
    }

    json_response([
        'folder' => [
            'index' => $folder_index,
            'label' => $upload_folder['label'],
        ],
        'subpath' => $subpath,
        'dirs'    => $dirs,
        'files'   => $files,
        'license' => ['valid' => $license['valid']],
    ]);
}

function handle_resources_upload(array $cfg, array $license): never {
    require_post();
    verify_csrf();

    $folder_index = (int) ($_POST['folder'] ?? $_GET['folder'] ?? 0);
    $upload_folder = require_resource_folder($cfg, $folder_index, $license);
    $uploads_path = $upload_folder['path'];
    $uploads_url = rtrim($upload_folder['url'], '/');
    $allowed_img = $cfg['allowed_image_types'];
    $max_bytes = $cfg['max_upload_bytes'];
    $blocked_ext = ['php', 'phtml', 'php3', 'php4', 'php5', 'shtml'];
    $subpath = $_POST['subpath'] ?? $_GET['subpath'] ?? '';

    if ($subpath !== '' && empty($license['valid'])) {
        json_error('License required to upload to subfolders.', 403);
    }

    $resolved = safe_subpath($uploads_path, $subpath);
    if ($resolved === false) {
        json_error('Invalid subpath.', 400);
    }

    if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        json_error('No file uploaded or upload error.');
    }

    if ($_FILES['file']['size'] > $max_bytes) {
        json_error('File exceeds maximum size of ' . round($max_bytes / 1024 / 1024) . ' MB.');
    }

    $file = $_FILES['file'];
    $ext = mb_strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

    if (in_array($ext, $blocked_ext, true)) {
        json_error('File type not allowed.');
    }

    $original = sanitize_upload_name(pathinfo($file['name'], PATHINFO_FILENAME));
    if ($original === '') $original = 'file';
    $ext_suffix = $ext ? '.' . preg_replace('/[^a-z0-9]/', '', $ext) : '';

    $filename = $original . '-' . uniqid() . $ext_suffix;
    $dest = $resolved . '/' . $filename;

    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        json_error('Failed to save file.', 500);
    }

    $resize_cfg = $upload_folder['image_resize'] ?? [];
    if (!empty($resize_cfg['enabled']) && !empty($license['valid'])) {
        resize_image($dest, $resize_cfg);
    }

    json_response(resource_info($resolved, $uploads_url, $allowed_img, $filename, $subpath));
}

/**
 * One-shot multipart upload authenticated by a ticket minted via the
 * `resources_upload_request` MCP tool. Skips CSRF + session because the
 * ticket is the credential. Reuses mcp_write_bytes() for the actual
 * file write so the pipeline matches the inline-b64 path.
 */
function handle_upload_with_ticket(array $cfg, array $license): never {
    require_post();

    $ticket_id = trim((string) ($_GET['ticket'] ?? ''));
    if ($ticket_id === '' || !ctype_xdigit($ticket_id)) {
        json_error('Missing or malformed ticket.', 400);
    }

    $ticket = mcp_consume_upload_ticket($cfg, $ticket_id);
    if ($ticket === null) {
        json_error('Upload ticket is invalid, expired, or already used.', 410);
    }

    $folder = require_resource_folder($cfg, (int) $ticket['folder'], $license);

    if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        json_error('No file uploaded or upload error.', 400);
    }

    $bytes = file_get_contents($_FILES['file']['tmp_name']);
    if ($bytes === false) {
        json_error('Failed to read uploaded file.', 500);
    }

    $filename = (string) ($ticket['filename'] ?? $_FILES['file']['name']);
    $result = mcp_write_bytes(
        $bytes,
        $cfg,
        $license,
        $folder,
        $filename,
        (string) ($ticket['subpath'] ?? ''),
        !empty($ticket['image_only'])
    );

    if (is_array($result) && !empty($result['__mcp_native_error'])) {
        json_error($result['message'] ?? 'Upload failed.', (int) ($result['status'] ?? 400));
    }

    json_response($result);
}

function handle_resources_delete(array $cfg, array $license): never {
    require_post();
    verify_csrf();

    $input = get_json_body();
    $folder_index = (int) ($input['folder'] ?? $_POST['folder'] ?? 0);
    $upload_folder = require_resource_folder($cfg, $folder_index, $license);
    $uploads_path = $upload_folder['path'];
    $filename = $input['file'] ?? $_POST['file'] ?? '';
    $subpath = $input['subpath'] ?? $_POST['subpath'] ?? '';

    if ($subpath !== '' && empty($license['valid'])) {
        json_error('License required to delete from subfolders.', 403);
    }

    $resolved = safe_subpath($uploads_path, $subpath);
    if ($resolved === false) {
        json_error('Invalid subpath.', 400);
    }

    $filepath = safe_resource_path($resolved, $filename);
    if ($filepath === false || !file_exists($filepath)) {
        json_error('File not found.', 404);
    }

    unlink($filepath);
    json_ok('File deleted.');
}

function handle_resources_rename(array $cfg, array $license): never {
    require_post();
    verify_csrf();

    $input = get_json_body();
    $folder_index = (int) ($input['folder'] ?? 0);
    $upload_folder = require_resource_folder($cfg, $folder_index, $license);
    $uploads_path = $upload_folder['path'];
    $uploads_url = rtrim($upload_folder['url'], '/');
    $allowed_img = $cfg['allowed_image_types'];
    $filename = $input['file'] ?? '';
    $new_name = $input['newName'] ?? '';
    $subpath = $input['subpath'] ?? '';

    if ($subpath !== '' && empty($license['valid'])) {
        json_error('License required to rename files in subfolders.', 403);
    }

    $resolved = safe_subpath($uploads_path, $subpath);
    if ($resolved === false) {
        json_error('Invalid subpath.', 400);
    }

    $filepath = safe_resource_path($resolved, $filename);
    if ($filepath === false || !file_exists($filepath)) {
        json_error('File not found.', 404);
    }

    $ext = mb_strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    $sanitized = sanitize_upload_name($new_name);
    if ($sanitized === '') $sanitized = 'file';

    $ext_suffix = $ext ? '.' . preg_replace('/[^a-z0-9]/', '', $ext) : '';
    $new_filename = $sanitized . $ext_suffix;

    // No-op if the name hasn't changed
    if ($new_filename === $filename) {
        json_response(resource_info($resolved, $uploads_url, $allowed_img, $filename, $subpath));
    }

    // Check for collision
    $new_path = $resolved . '/' . $new_filename;
    if (file_exists($new_path)) {
        json_error('A file with that name already exists.', 409);
    }

    if (!rename($filepath, $new_path)) {
        json_error('Failed to rename file.', 500);
    }

    json_response(resource_info($resolved, $uploads_url, $allowed_img, $new_filename, $subpath));
}

function handle_resources_move(array $cfg, array $license): never {
    require_post();
    verify_csrf();

    $input = get_json_body();
    $folder_index = (int) ($input['folder'] ?? 0);
    $upload_folder = require_resource_folder($cfg, $folder_index, $license);
    $uploads_path = $upload_folder['path'];
    $uploads_url = rtrim($upload_folder['url'], '/');
    $allowed_img = $cfg['allowed_image_types'];

    $filename = $input['file'] ?? '';
    $subpath = $input['subpath'] ?? '';
    $dest_subpath = array_key_exists('dest_subpath', $input) ? $input['dest_subpath'] : $subpath;
    $new_filename = $input['new_filename'] ?? '';

    if (($subpath !== '' || $dest_subpath !== '') && empty($license['valid'])) {
        json_error('License required to move files to or from subfolders.', 403);
    }

    $src_dir = safe_subpath($uploads_path, $subpath);
    if ($src_dir === false) {
        json_error('Invalid subpath.', 400);
    }

    $src_path = safe_resource_path($src_dir, $filename);
    if ($src_path === false || !file_exists($src_path)) {
        json_error('File not found.', 404);
    }

    $dest_dir = safe_subpath($uploads_path, $dest_subpath);
    if ($dest_dir === false) {
        json_error('Destination folder not found. Create it first with resources_create_folder.', 400);
    }

    $ext = mb_strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    if (in_array($ext, ['php', 'phtml', 'php3', 'php4', 'php5', 'shtml'], true)) {
        json_error('File type not allowed.');
    }
    $ext_suffix = $ext ? '.' . preg_replace('/[^a-z0-9]/', '', $ext) : '';

    if ($new_filename !== '') {
        $base = sanitize_upload_name(pathinfo($new_filename, PATHINFO_FILENAME));
        if ($base === '') $base = 'file';
    } else {
        $base = pathinfo($filename, PATHINFO_FILENAME);
    }
    $final_name = $base . $ext_suffix;

    $dest_path = $dest_dir . '/' . $final_name;
    if ($dest_path === $src_path) {
        json_response(resource_info($dest_dir, $uploads_url, $allowed_img, $final_name, $dest_subpath));
    }

    if (file_exists($dest_path)) {
        json_error('A file with that name already exists at the destination.', 409);
    }

    if (!rename($src_path, $dest_path)) {
        json_error('Failed to move file.', 500);
    }

    json_response(resource_info($dest_dir, $uploads_url, $allowed_img, $final_name, $dest_subpath));
}

function handle_resources_create_folder(array $cfg, array $license): never {
    require_post();
    verify_csrf();

    if (empty($license['valid'])) {
        json_error('License required to create subfolders.', 403);
    }

    $input = get_json_body();
    $folder_index = (int) ($input['folder'] ?? 0);
    $upload_folder = require_resource_folder($cfg, $folder_index, $license);
    $uploads_path = $upload_folder['path'];
    $subpath = $input['subpath'] ?? '';
    $name = trim($input['name'] ?? '');

    $resolved = safe_subpath($uploads_path, $subpath);
    if ($resolved === false) {
        json_error('Invalid subpath.', 400);
    }

    if ($name === '' || !preg_match('/^[\w\-]+$/', $name)) {
        json_error('Invalid folder name. Use only letters, numbers, hyphens, and underscores.');
    }

    $new_dir = $resolved . '/' . $name;
    if (file_exists($new_dir)) {
        json_error('A folder with that name already exists.');
    }

    if (!mkdir($new_dir, 0755)) {
        json_error('Failed to create folder.', 500);
    }

    json_response([
        'name'    => $name,
        'message' => 'Folder created.',
    ]);
}
