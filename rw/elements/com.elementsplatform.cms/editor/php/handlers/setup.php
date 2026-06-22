<?php

function handle_setup_requirements(): never {
    $checks = [];

    // PHP version
    $checks[] = [
        'name'     => 'php_version',
        'pass'     => PHP_VERSION_ID >= 80100,
        'value'    => PHP_VERSION,
        'required' => '>= 8.1',
    ];

    // Required extensions
    $extensions = ['json', 'session', 'curl', 'mbstring', 'fileinfo', 'sodium'];
    foreach ($extensions as $ext) {
        $checks[] = [
            'name' => 'ext_' . $ext,
            'pass' => $ext === 'fileinfo' ? function_exists('finfo_open') : extension_loaded($ext),
        ];
    }

    // Composer dependencies installed
    $autoload_path = __DIR__ . '/../../../api/vendor/autoload.php';
    $checks[] = [
        'name' => 'composer',
        'pass' => file_exists($autoload_path),
    ];

    // Config directory writable (where config.php will be saved)
    $config_dir = dirname(config_path());
    $checks[] = [
        'name'   => 'config_writable',
        'pass'   => is_writable($config_dir),
        'detail' => $config_dir,
    ];

    $all_pass = true;
    foreach ($checks as $c) {
        if (!$c['pass']) { $all_pass = false; break; }
    }

    json_response(['ok' => $all_pass, 'checks' => $checks]);
}

function handle_setup_complete(): never {
    require_post();

    if (config_exists()) {
        json_error('Application is already configured.');
    }

    $input = get_json_body();
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    $password = $input['password'] ?? '';
    $password_confirm = $input['password_confirm'] ?? '';
    $folders_input = $input['folders'] ?? [];
    $resource_folders_input = $input['resource_folders'] ?? [];

    $errors = [];

    // Validate email (used as the user identifier and for the customer portal).
    if ($email === '') {
        $errors[] = 'Email is required.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'Email is not valid.';
    }

    // Validate password
    if (strlen($password) < 6) {
        $errors[] = 'Password must be at least 6 characters.';
    }
    if ($password !== $password_confirm) {
        $errors[] = 'Passwords do not match.';
    }

    // Validate content folders
    $valid_folders = [];
    foreach ($folders_input as $f) {
        $label = trim($f['label'] ?? '');
        $path = trim($f['path'] ?? '');
        if ($label === '' && $path === '') continue;
        if ($label === '' || $path === '') {
            $errors[] = 'Each folder needs both a label and a path.';
            continue;
        }
        $folder_err = validate_folder_path($path);
        if ($folder_err !== null) {
            $errors[] = $folder_err;
            continue;
        }
        $valid_folders[] = [
            'label'       => $label,
            'path'        => $path,
            'field_types' => infer_field_types($path),
            'field_defaults' => [],
        ];
    }
    if (empty($valid_folders)) {
        $errors[] = 'At least one content folder is required.';
    }

    // Validate resource folders
    $valid_resource_folders = [];
    foreach ($resource_folders_input as $uf) {
        $uf_label = trim($uf['label'] ?? '');
        $uf_path = trim($uf['path'] ?? '');
        if ($uf_label === '' && $uf_path === '') continue;
        if ($uf_label === '' || $uf_path === '') {
            $errors[] = 'Each resource folder needs both a label and a path.';
            continue;
        }
        if (!is_dir($uf_path)) {
            if (!@mkdir($uf_path, 0755, true)) {
                $errors[] = "Could not create resources directory: $uf_path";
                continue;
            }
        }
        if (!is_writable($uf_path)) {
            $errors[] = "Resources directory is not writable: $uf_path";
            continue;
        }
        $real_path = realpath($uf_path);
        $valid_resource_folders[] = [
            'label'        => $uf_label,
            'path'         => $real_path ?: $uf_path,
            'url'          => generate_uploads_url($real_path ?: $uf_path),
            'image_resize' => [
                'enabled'    => false,
                'max_width'  => 1920,
                'max_height' => 1920,
                'quality'    => 85,
            ],
        ];
    }
    if (empty($valid_resource_folders)) {
        $errors[] = 'At least one resource folder is required.';
    }

    if (!empty($errors)) {
        json_response(['errors' => $errors], 422);
    }

    $language = in_array($input['language'] ?? 'en', ALLOWED_LANGUAGES, true)
        ? $input['language']
        : 'en';

    $config = [
        'users' => [
            $email => [
                'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                'role'          => 'owner',
                'language'      => $language,
            ],
        ],
        'session_name'        => 'elements_spa_session',
        'language'            => $language,
        'folders'             => $valid_folders,
        'resource_folders'    => $valid_resource_folders,
        'allowed_image_types' => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        'max_upload_bytes'    => 5 * 1024 * 1024,
        'theme'               => ['site_name' => 'Elements CMS', 'logo' => null],
    ];

    if (!save_config($config)) {
        json_error('Failed to write configuration file.', 500);
    }

    // Auto-login the admin user
    start_session($config);
    $_SESSION['logged_in'] = true;
    $_SESSION['username'] = $email;
    $_SESSION['role'] = 'owner';
    $_SESSION['csrf'] = bin2hex(random_bytes(16));

    json_response([
        'user' => ['email' => $email, 'role' => 'owner'],
        'csrf' => $_SESSION['csrf'],
        'config' => client_config($config),
    ]);
}
