<?php

function handle_media_list(array $cfg, array $license): never {
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
                $info = resource_info($resolved, $uploads_url, $allowed_img, $entry, $subpath);
                if ($info['is_image']) {
                    $files[] = $info;
                }
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
    ]);
}

function handle_media_upload(array $cfg, array $license): never {
    require_post();
    verify_csrf();

    $folder_index = (int) ($_POST['folder'] ?? $_GET['folder'] ?? 0);
    $upload_folder = require_resource_folder($cfg, $folder_index, $license);
    $uploads_path = $upload_folder['path'];
    $uploads_url = rtrim($upload_folder['url'], '/');
    $allowed_img = $cfg['allowed_image_types'];
    $max_bytes = $cfg['max_upload_bytes'];
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

    $mime = detect_file_mime($_FILES['file']['tmp_name']);
    $mime_error = image_mime_validation_error($mime, $allowed_img);
    if ($mime_error !== null) {
        json_error($mime_error, $mime === null ? 500 : 400);
    }

    $file = $_FILES['file'];
    $ext = mb_strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $original = sanitize_upload_name(pathinfo($file['name'], PATHINFO_FILENAME));
    if ($original === '') $original = 'image';
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
