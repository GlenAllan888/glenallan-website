<?php

const RESOURCE_FOLDER_IMAGE_RESIZE_DEFAULT = [
    'enabled'    => false,
    'max_width'  => 1920,
    'max_height' => 1920,
    'quality'    => 85,
];

function handle_resource_folders_settings(array $cfg, array $license): never {
    require_admin();

    $folder_index = (int) ($_GET['folder'] ?? 0);
    $folder = require_resource_folder($cfg, $folder_index, $license);

    json_response([
        'folder' => [
            'index'        => $folder_index,
            'label'        => $folder['label'],
            'path'         => $folder['path'],
            'display_path' => folder_display_path($folder['path']),
            'url'          => $folder['url'],
            'image_resize' => $folder['image_resize'] ?? RESOURCE_FOLDER_IMAGE_RESIZE_DEFAULT,
        ],
    ]);
}

function handle_resource_folders_update(array $cfg, array $license): never {
    require_admin();
    require_post();
    verify_csrf();

    $input = get_json_body();
    $folder_index = (int) ($input['folder'] ?? 0);
    require_resource_folder($cfg, $folder_index, $license);

    $label = trim($input['label'] ?? '');
    $path_supplied = array_key_exists('path', $input);
    $path = $path_supplied ? trim((string) ($input['path'] ?? '')) : '';

    if ($label === '') {
        json_error('Label is required.');
    }

    if ($path_supplied && $path === '') {
        json_error('Path is required.');
    }

    $warning = label_conflicts($cfg['resource_folders'], $label, $folder_index)
        ? 'Another resource folder already uses this name. Consider choosing a different label to tell them apart.'
        : null;

    $cfg['resource_folders'][$folder_index]['label'] = $label;
    $path_changed = false;

    if ($path_supplied) {
        if (!is_dir($path)) {
            if (!@mkdir($path, 0755, true)) {
                json_error("Could not create resources directory: $path");
            }
        }

        if (!is_writable($path)) {
            json_error("Resources directory is not writable: $path");
        }

        $current_path = $cfg['resource_folders'][$folder_index]['path'] ?? '';
        $current_real = realpath($current_path) ?: rtrim($current_path, DIRECTORY_SEPARATOR);
        $next_real = realpath($path) ?: rtrim($path, DIRECTORY_SEPARATOR);
        $path_changed = $current_real !== $next_real;

        if ($path_changed) {
            $cfg['resource_folders'][$folder_index]['path'] = $next_real;
            $cfg['resource_folders'][$folder_index]['url'] = generate_uploads_url($next_real);
            $cfg['resource_folders'][$folder_index]['image_resize'] = RESOURCE_FOLDER_IMAGE_RESIZE_DEFAULT;
        }
    }

    if (!$path_changed && !empty($license['valid']) && isset($input['image_resize'])) {
        $ir = $input['image_resize'];
        $cfg['resource_folders'][$folder_index]['image_resize'] = [
            'enabled'    => !empty($ir['enabled']),
            'max_width'  => max(1, min(6000, (int) ($ir['max_width'] ?? 1920))),
            'max_height' => max(1, min(6000, (int) ($ir['max_height'] ?? 1920))),
            'quality'    => max(10, min(100, (int) ($ir['quality'] ?? 85))),
        ];
    }

    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }

    json_response([
        'message'      => 'Resource folder updated.',
        'warning'      => $warning,
        'path_changed' => $path_changed,
        'config'       => client_config($cfg, $license),
    ]);
}

function handle_resource_folders_add(array $cfg, array $license): never {
    require_admin();
    require_post();
    verify_csrf();

    // --- Inlined paid-feature gate (max_resource_folders limit) -------------
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
    $_max_folders = is_array($_lic_entry['limits'] ?? null) && array_key_exists('max_resource_folders', $_lic_entry['limits'])
        ? $_lic_entry['limits']['max_resource_folders']
        : 1;
    if ($_max_folders !== null && count($cfg['resource_folders'] ?? []) >= $_max_folders) {
        json_error("Your plan is at its resource folder limit ($_max_folders). Upgrade to add more folders.", 403);
    }
    // --- end inlined gate ---------------------------------------------------

    $input = get_json_body();
    $label = trim($input['label'] ?? '');
    $path = trim($input['path'] ?? '');

    if ($label === '' || $path === '') {
        json_error('Label and path are required.');
    }

    if (!is_dir($path)) {
        if (!@mkdir($path, 0755, true)) {
            json_error("Could not create resources directory: $path");
        }
    }

    if (!is_writable($path)) {
        json_error("Resources directory is not writable: $path");
    }

    $warning = label_conflicts($cfg['resource_folders'], $label)
        ? 'Another resource folder already uses this name. Consider renaming this one so you can tell them apart.'
        : null;

    $real_path = realpath($path);
    $cfg['resource_folders'][] = [
        'label'        => $label,
        'path'         => $real_path ?: $path,
        'url'          => generate_uploads_url($real_path ?: $path),
        'image_resize' => RESOURCE_FOLDER_IMAGE_RESIZE_DEFAULT,
    ];

    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }

    json_response([
        'index'   => count($cfg['resource_folders']) - 1,
        'message' => 'Resource folder added.',
        'warning' => $warning,
        'config'  => client_config($cfg, $license),
    ]);
}

function handle_resource_folders_remove(array $cfg, array $license): never {
    require_admin();
    require_post();
    verify_csrf();

    $input = get_json_body();
    $folder_index = (int) ($input['folder'] ?? -1);
    require_resource_folder($cfg, $folder_index, $license);

    if (count($cfg['resource_folders']) <= 1) {
        json_error('Cannot remove the last resource folder.');
    }

    array_splice($cfg['resource_folders'], $folder_index, 1);

    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }

    json_response([
        'message' => 'Resource folder removed.',
        'config'  => client_config($cfg, $license),
    ]);
}
