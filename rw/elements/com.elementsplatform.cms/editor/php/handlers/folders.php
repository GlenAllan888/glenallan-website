<?php

function folders_resolve_with_provenance(array $folder, string $subpath): array {
    $resolved = resolve_folder_schema($folder, $subpath);
    $normalized = normalize_subpath($subpath);

    $own_fields = null;
    $own_preview = null;
    $fields_from = '';
    $preview_from = '';

    $overrides = $folder['subfolder_schemas'] ?? [];
    if (!is_array($overrides)) $overrides = [];

    if ($normalized !== '') {
        $segments = explode('/', $normalized);
        $cumulative = '';
        foreach ($segments as $segment) {
            $cumulative = $cumulative === '' ? $segment : $cumulative . '/' . $segment;
            $entry = $overrides[$cumulative] ?? null;
            if (!is_array($entry)) continue;
            if (isset($entry['field_types']) && is_array($entry['field_types'])) {
                $fields_from = $cumulative;
            }
            if (isset($entry['preview_url']) && is_string($entry['preview_url'])) {
                $preview_from = $cumulative;
            }
        }

        $own_entry = $overrides[$normalized] ?? null;
        if (is_array($own_entry)) {
            if (isset($own_entry['field_types']) && is_array($own_entry['field_types'])) {
                $own_fields = [
                    'field_types'    => $own_entry['field_types'],
                    'field_defaults' => $own_entry['field_defaults'] ?? [],
                ];
            }
            if (isset($own_entry['preview_url']) && is_string($own_entry['preview_url'])) {
                $own_preview = $own_entry['preview_url'];
            }
        }
    } else {
        if (isset($folder['preview_url']) && is_string($folder['preview_url'])) {
            $own_preview = $folder['preview_url'];
        }
    }

    return [
        'fields' => [
            'own' => $own_fields,
            'effective' => [
                'field_types'    => $resolved['field_types'],
                'field_defaults' => $resolved['field_defaults'],
            ],
            'inherited_from' => $fields_from,
        ],
        'preview_url' => [
            'own' => $own_preview,
            'effective' => $resolved['preview_url'],
            'inherited_from' => $preview_from,
        ],
    ];
}

function folders_normalize_field_input(array $fields): array {
    $field_types = [];
    $field_defaults = [];
    $seen_names = [];

    foreach ($fields as $field) {
        $name = trim($field['name'] ?? '');
        $type = $field['type'] ?? 'text';
        $options = $field['options'] ?? '';
        $default = $field['default'] ?? '';

        if ($name === '') continue;

        if (in_array($name, $seen_names, true)) {
            json_error("Duplicate field name: $name");
        }
        $seen_names[] = $name;

        if ($type === 'select' && $options !== '') {
            $opts = array_map('trim', explode(',', $options));
            $opts = array_values(array_filter($opts, fn($o) => $o !== ''));
            $field_types[$name] = [$type, $opts];
        } elseif ($type === 'object_list') {
            $sub_fields = $field['subFields'] ?? [];
            $sub_types = [];
            foreach ($sub_fields as $sf) {
                $sf_name = trim($sf['name'] ?? '');
                if ($sf_name === '') continue;
                $sub_types[$sf_name] = $sf['type'] ?? 'text';
            }
            $field_types[$name] = ['object_list', $sub_types];
        } else {
            $field_types[$name] = $type;
        }

        if ($default !== '') {
            $field_defaults[$name] = $default;
        }
    }

    return [$field_types, $field_defaults];
}

function handle_folders_settings(array $cfg, array $license): never {
    require_admin();

    $folder_index = (int) ($_GET['folder'] ?? 0);
    $folder = require_folder($cfg, $folder_index, $license);
    $subpath = normalize_subpath($_GET['subpath'] ?? '');

    $provenance = folders_resolve_with_provenance($folder, $subpath);

    json_response([
        'folder' => [
            'index'        => $folder_index,
            'label'        => $folder['label'],
            'path'         => $folder['path'],
            'display_path' => folder_display_path($folder['path']),
            'subpath'      => $subpath,
        ],
        'fields'      => $provenance['fields'],
        'preview_url' => $provenance['preview_url'],
    ]);
}

function handle_folders_update_fields(array $cfg, array $license): never {
    require_admin();
    require_post();
    verify_csrf();

    // --- Inlined paid-feature gate (any paid tier) --------------------------
    // Folder field customisation is a paid feature. Free tier locked out.
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
    if (!$_lic_entry) {
        json_error('Folder customisation requires a paid plan.', 403);
    }
    // --- end inlined gate ---------------------------------------------------

    $input = get_json_body();
    $folder_index = (int) ($input['folder'] ?? 0);

    if (!isset($cfg['folders'][$folder_index])) {
        json_error('Folder not found.', 404);
    }

    $subpath = normalize_subpath($input['subpath'] ?? '');
    $has_fields = array_key_exists('fields', $input);
    $has_preview = array_key_exists('preview_url', $input);

    if (!$has_fields && !$has_preview) {
        json_error('Nothing to update.', 400);
    }

    [$field_types, $field_defaults] = $has_fields
        ? folders_normalize_field_input($input['fields'] ?? [])
        : [[], []];
    $preview_url = $has_preview ? trim((string) ($input['preview_url'] ?? '')) : '';

    if ($subpath === '') {
        if ($has_fields) {
            $cfg['folders'][$folder_index]['field_types']    = $field_types;
            $cfg['folders'][$folder_index]['field_defaults'] = $field_defaults;
        }
        if ($has_preview) {
            $cfg['folders'][$folder_index]['preview_url'] = $preview_url;
        }
    } else {
        $existing = $cfg['folders'][$folder_index]['subfolder_schemas'] ?? [];
        $entry = $existing[$subpath] ?? [];

        if ($has_fields) {
            if (empty($field_types)) {
                unset($entry['field_types'], $entry['field_defaults']);
            } else {
                $entry['field_types']    = $field_types;
                $entry['field_defaults'] = $field_defaults;
            }
        }

        if ($has_preview) {
            if ($preview_url === '') {
                unset($entry['preview_url']);
            } else {
                $entry['preview_url'] = $preview_url;
            }
        }

        if (empty($entry)) {
            unset($existing[$subpath]);
        } else {
            $existing[$subpath] = $entry;
        }

        if (empty($existing)) {
            unset($cfg['folders'][$folder_index]['subfolder_schemas']);
        } else {
            $cfg['folders'][$folder_index]['subfolder_schemas'] = $existing;
        }
    }

    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }

    json_ok('Folder fields updated.');
}

function handle_folders_clear_subfolder_overrides(array $cfg, array $license): never {
    require_admin();
    require_post();
    verify_csrf();

    // --- Inlined paid-feature gate (any paid tier) --------------------------
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
    if (!$_lic_entry) {
        json_error('Subfolder customisation requires a paid plan.', 403);
    }
    // --- end inlined gate ---------------------------------------------------

    $input = get_json_body();
    $folder_index = (int) ($input['folder'] ?? 0);
    $subpath = normalize_subpath($input['subpath'] ?? '');

    if (!isset($cfg['folders'][$folder_index])) {
        json_error('Folder not found.', 404);
    }
    if ($subpath === '') {
        json_error('subpath is required.', 400);
    }

    $existing = $cfg['folders'][$folder_index]['subfolder_schemas'] ?? [];
    if (isset($existing[$subpath])) {
        unset($existing[$subpath]);
        if (empty($existing)) {
            unset($cfg['folders'][$folder_index]['subfolder_schemas']);
        } else {
            $cfg['folders'][$folder_index]['subfolder_schemas'] = $existing;
        }
        if (!save_config($cfg)) {
            json_error('Failed to save configuration.', 500);
        }
    }

    json_ok('Subfolder overrides cleared.');
}

function handle_folders_redetect(array $cfg, array $license): never {
    require_admin();
    require_post();
    verify_csrf();

    $input = get_json_body();
    $folder_index = (int) ($input['folder'] ?? 0);
    $folder = require_folder($cfg, $folder_index, $license);
    $subpath = normalize_subpath($input['subpath'] ?? '');

    $resolved_path = $folder['path'];
    if ($subpath !== '') {
        $candidate = safe_subpath($folder['path'], $subpath);
        if ($candidate === false) {
            json_error('Invalid subpath.', 400);
        }
        $resolved_path = $candidate;
    }

    $field_types = infer_field_types($resolved_path);

    if ($subpath === '') {
        $cfg['folders'][$folder_index]['field_types'] = $field_types;
    } else {
        $existing = $cfg['folders'][$folder_index]['subfolder_schemas'] ?? [];
        $entry = $existing[$subpath] ?? [];
        $entry['field_types'] = $field_types;
        if (!isset($entry['field_defaults'])) {
            $entry['field_defaults'] = [];
        }
        $existing[$subpath] = $entry;
        $cfg['folders'][$folder_index]['subfolder_schemas'] = $existing;
    }

    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }

    json_response([
        'field_types' => $field_types,
        'message'     => 'Fields re-detected from files.',
    ]);
}

function prepare_content_folder_path(string $path): ?string {
    if (!is_dir($path)) {
        if (!@mkdir($path, 0755, true)) {
            return "Could not create content directory: $path";
        }
    }

    return validate_folder_path($path);
}

function handle_folders_add(array $cfg, array $license): never {
    require_admin();
    require_post();
    verify_csrf();

    // --- Inlined paid-feature gate (max_content_folders limit) --------------
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
    $_max_folders = is_array($_lic_entry['limits'] ?? null) && array_key_exists('max_content_folders', $_lic_entry['limits'])
        ? $_lic_entry['limits']['max_content_folders']
        : 1;
    if ($_max_folders !== null && count($cfg['folders']) >= $_max_folders) {
        json_error("Your plan is at its content folder limit ($_max_folders). Upgrade to add more folders.", 403);
    }
    // --- end inlined gate ---------------------------------------------------

    $input = get_json_body();
    $label = trim($input['label'] ?? '');
    $path = trim($input['path'] ?? '');

    if ($label === '' || $path === '') {
        json_error('Label and path are required.');
    }

    $err = prepare_content_folder_path($path);
    if ($err !== null) {
        json_error($err);
    }

    $warning = label_conflicts($cfg['folders'], $label)
        ? 'Another content collection already uses this name. Consider renaming this one so you can tell them apart.'
        : null;

    $cfg['folders'][] = [
        'label'          => $label,
        'path'           => $path,
        'field_types'    => infer_field_types($path),
        'field_defaults' => [],
    ];

    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }

    json_response([
        'index'   => count($cfg['folders']) - 1,
        'message' => 'Content folder added.',
        'warning' => $warning,
        'config'  => client_config($cfg, $license),
    ]);
}

function handle_folders_update(array $cfg, array $license): never {
    require_admin();
    require_post();
    verify_csrf();

    $input = get_json_body();
    $folder_index = (int) ($input['folder'] ?? -1);
    require_folder($cfg, $folder_index, $license);

    $label = trim($input['label'] ?? '');
    $path_supplied = array_key_exists('path', $input);
    $path = $path_supplied ? trim((string) ($input['path'] ?? '')) : '';

    if ($label === '') {
        json_error('Label is required.');
    }

    if ($path_supplied && $path === '') {
        json_error('Path is required.');
    }

    $warning = label_conflicts($cfg['folders'], $label, $folder_index)
        ? 'Another content collection already uses this name. Consider choosing a different label to tell them apart.'
        : null;

    $cfg['folders'][$folder_index]['label'] = $label;
    $path_changed = false;

    if ($path_supplied) {
        $err = prepare_content_folder_path($path);
        if ($err !== null) {
            json_error($err);
        }

        $current_path = $cfg['folders'][$folder_index]['path'] ?? '';
        $current_real = realpath($current_path) ?: rtrim($current_path, DIRECTORY_SEPARATOR);
        $next_real = realpath($path) ?: rtrim($path, DIRECTORY_SEPARATOR);
        $path_changed = $current_real !== $next_real;

        if ($path_changed) {
            $cfg['folders'][$folder_index]['path'] = $path;
            $cfg['folders'][$folder_index]['field_types'] = infer_field_types($path);
            $cfg['folders'][$folder_index]['field_defaults'] = [];
            unset(
                $cfg['folders'][$folder_index]['preview_url'],
                $cfg['folders'][$folder_index]['subfolder_schemas']
            );
        }
    }

    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }

    json_response([
        'message'      => 'Content folder updated.',
        'warning'      => $warning,
        'path_changed' => $path_changed,
        'config'       => client_config($cfg, $license),
    ]);
}

function handle_folders_remove(array $cfg, array $license): never {
    require_admin();
    require_post();
    verify_csrf();

    $input = get_json_body();
    $folder_index = (int) ($input['folder'] ?? -1);
    require_folder($cfg, $folder_index, $license);

    if (count($cfg['folders']) <= 1) {
        json_error('Cannot remove the last content folder.');
    }

    array_splice($cfg['folders'], $folder_index, 1);

    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }

    json_response([
        'message' => 'Content folder removed.',
        'config'  => client_config($cfg, $license),
    ]);
}
