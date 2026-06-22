<?php

/**
 * Reassemble indexed dot-notation keys (e.g. gallery.0.src) from submitted
 * form data back into arrays-of-objects in the merged meta array.
 */
function reassemble_object_lists(array &$merged, array $submitted_fm): void {
    $object_lists = [];
    foreach ($submitted_fm as $k => $v) {
        if (preg_match('/^(\w+)\.(\d+)\.(.+)$/', $k, $m)) {
            $parent = $m[1];
            $idx = (int) $m[2];
            $child = $m[3];
            $object_lists[$parent][$idx][$child] = $v;
        }
    }
    foreach ($object_lists as $parent => $items) {
        ksort($items);
        $merged[$parent] = array_values($items);
    }
}

function resolve_content_subpath(array $folder, string $subpath, array $license): string {
    if ($subpath !== '' && empty($license['valid'])) {
        json_error('License required to browse subfolders.', 403);
    }
    $resolved = safe_subpath($folder['path'], $subpath);
    if ($resolved === false) {
        json_error('Invalid subpath.', 400);
    }
    return $resolved;
}

function handle_files_list(array $cfg, array $license): never {
    $folder_index = (int) ($_GET['folder'] ?? 0);
    $folder = require_folder($cfg, $folder_index, $license);
    $subpath = $_GET['subpath'] ?? '';
    $is_licensed = !empty($license['valid']);

    $resolved = resolve_content_subpath($folder, $subpath, $license);

    $files = [];
    $dirs = [];
    if (is_dir($resolved)) {
        foreach (scandir($resolved) as $entry) {
            if ($entry[0] === '.' || $entry[0] === '_') continue;
            $full = $resolved . '/' . $entry;
            if (is_dir($full) && $is_licensed) {
                $dirs[] = ['name' => $entry, 'type' => 'dir'];
            } elseif (is_file($full) && str_ends_with($entry, '.md') && !str_ends_with($entry, '.draft.md')) {
                $parsed = parse_front_matter(file_get_contents($full));
                $date = $parsed['meta']['date'] ?? '';
                if ($date === '') {
                    $date = parse_dated_filename($entry)['date'];
                }
                $files[] = [
                    'name'     => $entry,
                    'modified' => filemtime($full),
                    'size'     => filesize($full),
                    'status'   => $parsed['meta']['status'] ?? 'published',
                    'date'     => $date,
                ];
            }
        }
        usort($dirs, fn($a, $b) => strcasecmp($a['name'], $b['name']));
        usort($files, fn($a, $b) => $b['modified'] - $a['modified']);
    }

    $schema = resolve_folder_schema($folder, $subpath);

    json_response([
        'folder' => [
            'index'       => $folder_index,
            'label'       => $folder['label'],
            'field_types' => ensure_field_types($schema['field_types'], $resolved),
        ],
        'subpath' => $subpath,
        'dirs'    => $dirs,
        'files'   => $files,
        'license' => ['valid' => $license['valid']],
    ]);
}

function handle_files_read(array $cfg, array $license): never {
    $folder_index = (int) ($_GET['folder'] ?? 0);
    $folder = require_folder($cfg, $folder_index, $license);
    $filename = $_GET['file'] ?? '';
    $subpath = $_GET['subpath'] ?? '';

    $resolved = resolve_content_subpath($folder, $subpath, $license);

    $filepath = safe_path($resolved, $filename);
    if ($filepath === false || !file_exists($filepath)) {
        json_error('File not found.', 404);
    }

    $raw = file_get_contents($filepath);
    $parsed = parse_front_matter($raw);
    $meta = $parsed['meta'];
    $body = $parsed['body'];

    $schema = resolve_folder_schema($folder, $subpath);
    $field_types = ensure_field_types($schema['field_types'], $resolved, $meta);
    $field_defaults = $schema['field_defaults'];

    // Ensure all configured fields exist in meta
    foreach ($field_types as $key => $type) {
        if (is_array($type) && ($type[0] ?? '') === 'object_list') {
            if (!isset($meta[$key]) || !is_array($meta[$key])) {
                $meta[$key] = [];
            }
            continue;
        }
        if (str_contains($key, '.')) {
            [$parent, $child] = explode('.', $key, 2);
            if (!isset($meta[$parent]) || !is_array($meta[$parent])) {
                $meta[$parent] = [];
            }
            if (!isset($meta[$parent][$child])) {
                $meta[$parent][$child] = $field_defaults[$key] ?? '';
            }
        } elseif (!array_key_exists($key, $meta)) {
            $meta[$key] = $field_defaults[$key] ?? '';
        }
    }

    $file_parts = parse_dated_filename($filename);

    json_response([
        'filename'    => $filename,
        'date_prefix' => $file_parts['date'],
        'slug'        => $file_parts['slug'],
        'meta'        => $meta,
        'body'        => $body,
        'field_types' => $field_types,
        'license'     => ['valid' => $license['valid']],
    ]);
}

function handle_files_create(array $cfg, array $license): never {
    require_post();
    verify_csrf();

    $input = get_json_body();
    $folder_index = (int) ($input['folder'] ?? 0);
    $folder = require_folder($cfg, $folder_index, $license);
    $subpath = $input['subpath'] ?? '';

    $resolved = resolve_content_subpath($folder, $subpath, $license);

    $schema = resolve_folder_schema($folder, $subpath);
    $field_types = ensure_field_types($schema['field_types'], $resolved);
    $field_defaults = $schema['field_defaults'];
    $fm = $input['fm'] ?? [];
    $slug = slugify(trim($input['slug'] ?? ''));

    if ($slug === '' && !empty($fm['title'])) {
        $slug = slugify($fm['title']);
    }
    if ($slug === '') {
        json_error('A title or slug is required.');
    }

    $today = date('Y-m-d');
    $use_date_prefix = $input['date_prefix'] ?? true;
    $prefix = $use_date_prefix ? $today . '-' : '';
    $base_filename = $prefix . $slug . '.md';

    // Collision check
    $filename = $base_filename;
    $counter = 2;
    while (file_exists($resolved . '/' . $filename)) {
        $filename = $prefix . $slug . '-' . $counter . '.md';
        $counter++;
    }

    // Build meta from submitted fields + defaults
    $meta = field_types_to_template($field_types, $field_defaults);
    foreach ($fm as $k => $v) {
        // Skip indexed dot-notation keys — handled by reassemble below
        if (preg_match('/^\w+\.\d+\./', $k)) continue;
        if (str_contains($k, '.')) {
            [$parent, $child] = explode('.', $k, 2);
            if (!isset($meta[$parent]) || !is_array($meta[$parent])) {
                $meta[$parent] = [];
            }
            $meta[$parent][$child] = $v;
        } elseif (is_array($v) && !is_assoc($v)) {
            $meta[$k] = $v;
        } else {
            $meta[$k] = $v;
        }
    }
    reassemble_object_lists($meta, $fm);

    // Set date field to today if present and empty
    if (isset($meta['date']) && $meta['date'] === '') {
        $meta['date'] = $today;
    }

    $body = $input['body'] ?? '';
    $content = build_front_matter($meta, $body, $field_types);
    $filepath = $resolved . '/' . $filename;

    if (file_put_contents($filepath, $content, LOCK_EX) === false) {
        json_error('Failed to create file.', 500);
    }

    require_once __DIR__ . '/../webhook-dispatch.php';
    dispatch_webhooks($cfg, 'file.created', ['filename' => $filename, 'folder' => $folder_index]);

    json_response([
        'filename' => $filename,
        'folder'   => $folder_index,
        'message'  => 'File created.',
    ]);
}

function handle_files_update(array $cfg, array $license): never {
    require_post();
    verify_csrf();

    $input = get_json_body();
    $folder_index = (int) ($input['folder'] ?? 0);
    $folder = require_folder($cfg, $folder_index, $license);
    $filename = $input['file'] ?? '';
    $subpath = $input['subpath'] ?? '';

    $resolved = resolve_content_subpath($folder, $subpath, $license);

    $filepath = safe_path($resolved, $filename);
    if ($filepath === false || !file_exists($filepath)) {
        json_error('File not found.', 404);
    }

    $original = parse_front_matter(file_get_contents($filepath));
    $schema = resolve_folder_schema($folder, $subpath);
    $field_types = ensure_field_types($schema['field_types'], $resolved, $original['meta']);
    $submitted_fm = $input['fm'] ?? [];
    // Preserve existing body when the caller omits `body` entirely; allow an
    // explicit empty string to clear it. Prevents AI clients (MCP, REST PATCH)
    // wiping the post body when they only intend to update frontmatter.
    $body = array_key_exists('body', $input) ? (string) $input['body'] : $original['body'];

    // Start from configured field defaults, then layer original values, then submitted
    $field_defaults = $schema['field_defaults'];
    $merged = field_types_to_template($field_types, $field_defaults);
    foreach ($original['meta'] as $k => $v) {
        $merged[$k] = $v;
    }
    foreach ($submitted_fm as $k => $v) {
        // Skip indexed dot-notation keys (gallery.0.src) — handled by reassemble below
        if (preg_match('/^\w+\.\d+\./', $k)) continue;
        if (str_contains($k, '.')) {
            [$parent, $child] = explode('.', $k, 2);
            if (!isset($merged[$parent]) || !is_array($merged[$parent])) {
                $merged[$parent] = [];
            }
            $merged[$parent][$child] = $v;
        } elseif (is_array($v) && is_assoc($v)) {
            if (!isset($merged[$k]) || !is_array($merged[$k])) {
                $merged[$k] = [];
            }
            foreach ($v as $sk => $sv) {
                $merged[$k][$sk] = $sv;
            }
        } elseif (is_array($v) && !is_assoc($v)) {
            // Array-of-objects submitted directly (from prepareFm)
            $merged[$k] = $v;
        } elseif (isset($original['meta'][$k]) && is_array($original['meta'][$k]) && !is_assoc($original['meta'][$k])) {
            $items = is_array($v) ? $v : array_map('trim', explode(',', $v));
            $merged[$k] = array_values(array_filter($items, fn($i) => $i !== ''));
        } else {
            $merged[$k] = $v;
        }
    }
    reassemble_object_lists($merged, $submitted_fm);

    // Handle slug change
    $file_parts = parse_dated_filename($filename);
    $new_slug = slugify(trim($input['slug'] ?? ''));
    if ($new_slug === '') {
        $new_slug = $file_parts['slug'];
    }

    if ($file_parts['date'] !== '') {
        $new_filename = $file_parts['date'] . '-' . $new_slug . '.md';
    } else {
        $new_filename = $new_slug . '.md';
    }

    $new_filepath = $resolved . '/' . $new_filename;

    if ($new_filename !== $filename && file_exists($new_filepath)) {
        json_error('A file with that slug already exists.');
    }

    // Snapshot current content before overwriting (Pro version history)
    if (!empty($license['valid'])) {
        require_once __DIR__ . '/versions.php';
        $current_content = file_get_contents($filepath);
        create_version_snapshot($resolved, $filename, $current_content);
    }

    $content = build_front_matter($merged, $body, $field_types);

    if ($new_filename !== $filename) {
        file_put_contents($new_filepath, $content, LOCK_EX);
        unlink($filepath);
        // Rename version history directory to match new filename
        if (!empty($license['valid'])) {
            rename_version_history($resolved, $filename, $new_filename);
        }
        $filename = $new_filename;
    } else {
        file_put_contents($filepath, $content, LOCK_EX);
    }

    require_once __DIR__ . '/../webhook-dispatch.php';
    dispatch_webhooks($cfg, 'file.updated', ['filename' => $filename, 'folder' => $folder_index]);

    json_response([
        'filename' => $filename,
        'folder'   => $folder_index,
        'message'  => 'File saved.',
    ]);
}

function handle_files_delete(array $cfg, array $license): never {
    require_post();
    verify_csrf();

    $input = get_json_body();
    $folder_index = (int) ($input['folder'] ?? 0);
    $folder = require_folder($cfg, $folder_index, $license);
    $filename = $input['file'] ?? '';
    $subpath = $input['subpath'] ?? '';

    $resolved = resolve_content_subpath($folder, $subpath, $license);

    $filepath = safe_path($resolved, $filename);
    if ($filepath === false || !file_exists($filepath)) {
        json_error('File not found.', 404);
    }

    unlink($filepath);

    // Clean up version history for the deleted file
    require_once __DIR__ . '/versions.php';
    cleanup_version_history($resolved, $filename);

    require_once __DIR__ . '/../webhook-dispatch.php';
    dispatch_webhooks($cfg, 'file.deleted', ['filename' => $filename, 'folder' => $folder_index]);

    json_ok('File deleted.');
}

function handle_files_draft(array $cfg, array $license): never {
    require_post();
    verify_csrf();

    $input = get_json_body();
    $folder_index = (int) ($input['folder'] ?? 0);
    $folder = require_folder($cfg, $folder_index, $license);
    $subpath = $input['subpath'] ?? '';

    $resolved = resolve_content_subpath($folder, $subpath, $license);

    $file = $input['file'] ?? '';
    $slug = trim($input['slug'] ?? '');

    // Determine slug: from existing filename or from direct slug param
    if ($file !== '') {
        $parts = parse_dated_filename($file);
        $slug = $parts['slug'];
    } elseif ($slug !== '') {
        $slug = slugify($slug);
    }

    if ($slug === '') {
        json_error('Slug is required for preview.');
    }

    $fm = $input['fm'] ?? [];
    $body = $input['body'] ?? '';
    $schema = resolve_folder_schema($folder, $subpath);
    $field_types = $schema['field_types'];

    $content = build_front_matter($fm, $body, $field_types);
    $draft_path = $resolved . '/' . $slug . '.draft.md';

    file_put_contents($draft_path, $content, LOCK_EX);

    json_response(['slug' => $slug]);
}

function handle_files_draft_cleanup(array $cfg, array $license): never {
    require_post();
    verify_csrf();

    $input = get_json_body();
    $folder_index = (int) ($input['folder'] ?? 0);
    $folder = require_folder($cfg, $folder_index, $license);
    $subpath = $input['subpath'] ?? '';

    $resolved = resolve_content_subpath($folder, $subpath, $license);

    $slug = trim($input['slug'] ?? '');
    if ($slug === '') {
        json_ok('Nothing to clean up.');
    }

    $draft_path = $resolved . '/' . slugify($slug) . '.draft.md';

    if (file_exists($draft_path)) {
        unlink($draft_path);
    }

    json_ok('Draft cleaned up.');
}

function handle_files_create_folder(array $cfg, array $license): never {
    require_post();
    verify_csrf();

    if (empty($license['valid'])) {
        json_error('License required to create subfolders.', 403);
    }

    $input = get_json_body();
    $folder_index = (int) ($input['folder'] ?? 0);
    $folder = require_folder($cfg, $folder_index, $license);
    $subpath = $input['subpath'] ?? '';
    $name = trim($input['name'] ?? '');

    $resolved = resolve_content_subpath($folder, $subpath, $license);

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

function handle_files_rename(array $cfg, array $license): never {
    require_post();
    verify_csrf();

    $input = get_json_body();
    $folder_index = (int) ($input['folder'] ?? 0);
    $folder = require_folder($cfg, $folder_index, $license);
    $filename = $input['file'] ?? '';
    $new_name = trim($input['newName'] ?? '');
    $subpath = $input['subpath'] ?? '';

    $resolved = resolve_content_subpath($folder, $subpath, $license);

    $filepath = safe_path($resolved, $filename);
    if ($filepath === false || !file_exists($filepath)) {
        json_error('File not found.', 404);
    }

    $new_base = preg_replace('/\.(draft\.)?md$/i', '', $new_name);

    if ($new_base === '' || $new_base[0] === '.' || $new_base[0] === '_') {
        json_error('Invalid filename.');
    }
    if (!preg_match('/^[A-Za-z0-9._-]+$/', $new_base)) {
        json_error('Filename may only contain letters, numbers, dots, dashes, and underscores.');
    }

    $new_filename = $new_base . '.md';

    if ($new_filename === $filename) {
        json_response([
            'filename' => $filename,
            'folder'   => $folder_index,
            'message'  => 'File renamed.',
        ]);
    }

    $new_filepath = $resolved . '/' . $new_filename;
    if (file_exists($new_filepath)) {
        json_error('A file with that name already exists.', 409);
    }

    if (!rename($filepath, $new_filepath)) {
        json_error('Failed to rename file.', 500);
    }

    if (!empty($license['valid'])) {
        require_once __DIR__ . '/versions.php';
        rename_version_history($resolved, $filename, $new_filename);
    }

    require_once __DIR__ . '/../webhook-dispatch.php';
    dispatch_webhooks($cfg, 'file.updated', ['filename' => $new_filename, 'folder' => $folder_index]);

    json_response([
        'filename' => $new_filename,
        'folder'   => $folder_index,
        'message'  => 'File renamed.',
    ]);
}

function handle_files_duplicate(array $cfg, array $license): never {
    require_post();
    verify_csrf();

    $input = get_json_body();
    $folder_index = (int) ($input['folder'] ?? 0);
    $folder = require_folder($cfg, $folder_index, $license);
    $filename = $input['file'] ?? '';
    $subpath = $input['subpath'] ?? '';

    $resolved = resolve_content_subpath($folder, $subpath, $license);

    $filepath = safe_path($resolved, $filename);
    if ($filepath === false || !file_exists($filepath)) {
        json_error('File not found.', 404);
    }

    $file_parts = parse_dated_filename($filename);
    $prefix = $file_parts['date'] !== '' ? $file_parts['date'] . '-' : '';
    $base_slug = $file_parts['slug'] . '-copy';

    $new_filename = $prefix . $base_slug . '.md';
    $counter = 2;
    while (file_exists($resolved . '/' . $new_filename)) {
        $new_filename = $prefix . $base_slug . '-' . $counter . '.md';
        $counter++;
    }

    $new_filepath = $resolved . '/' . $new_filename;
    if (!copy($filepath, $new_filepath)) {
        json_error('Failed to duplicate file.', 500);
    }

    require_once __DIR__ . '/../webhook-dispatch.php';
    dispatch_webhooks($cfg, 'file.created', ['filename' => $new_filename, 'folder' => $folder_index]);

    json_response([
        'filename' => $new_filename,
        'folder'   => $folder_index,
        'message'  => 'File duplicated.',
    ]);
}
