<?php

function handle_users_list(array $cfg, array $license): never {
    require_admin();

    $users = [];
    foreach ($cfg['users'] as $email => $data) {
        $users[] = [
            'email' => $email,
            'role'  => $data['role'],
        ];
    }

    json_response(['users' => $users]);
}

function handle_users_create(array $cfg, array $license): never {
    require_admin();
    require_post();
    verify_csrf();

    // --- Inlined paid-feature gate (max_users limit) ------------------------
    // Each gated handler verifies the cached signed licence payload directly,
    // using only libsodium primitives. NOT factored into a shared helper —
    // doing so would recreate the single-PHP-edit unlock this design avoids.
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
    $_max_users = $_lic_entry
        ? (is_array($_lic_entry['limits'] ?? null) && array_key_exists('max_users', $_lic_entry['limits'])
            ? $_lic_entry['limits']['max_users']
            : null)
        : 1;
    if ($_max_users !== null && count($cfg['users'] ?? []) >= $_max_users) {
        json_error("Your plan is at its user limit ($_max_users). Upgrade to add more users.", 403);
    }
    // --- end inlined gate ---------------------------------------------------

    $input = get_json_body();
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    $password = $input['password'] ?? '';
    $role = $input['role'] ?? 'editor';

    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_error('A valid email address is required.');
    }

    if (isset($cfg['users'][$email])) {
        json_error('A user with that email already exists.');
    }

    if (strlen($password) < 6) {
        json_error('Password must be at least 6 characters.');
    }

    if (!in_array($role, ['owner', 'admin', 'editor'], true)) {
        json_error('Role must be "owner", "admin", or "editor".');
    }

    if ($role === 'owner' && !is_owner()) {
        json_error('Only owners can create owner users.', 403);
    }

    $cfg['users'][$email] = [
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'role'          => $role,
        'language'      => $cfg['language'] ?? 'en',
    ];

    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }

    $users = [];
    foreach ($cfg['users'] as $u_email => $data) {
        $users[] = ['email' => $u_email, 'role' => $data['role']];
    }

    require_once __DIR__ . '/../webhook-dispatch.php';
    dispatch_webhooks($cfg, 'user.created', ['email' => $email, 'role' => $role]);

    json_response([
        'user'    => ['email' => $email, 'role' => $role],
        'users'   => $users,
        'message' => 'User created.',
    ]);
}

function handle_users_update(array $cfg, array $license): never {
    require_admin();
    require_post();
    verify_csrf();

    // --- Inlined paid-feature gate (any paid tier) --------------------------
    // Multi-user management is a paid feature. The free tier has no other users
    // to administer; self password changes go through handlers/password.php.
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
        json_error('Multi-user management requires a paid plan.', 403);
    }
    // --- end inlined gate ---------------------------------------------------

    $input = get_json_body();
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    $role = $input['role'] ?? null;
    $password = $input['password'] ?? '';

    if (!isset($cfg['users'][$email])) {
        json_error('User not found.', 404);
    }

    $current_role = $cfg['users'][$email]['role'];

    if ($role !== null && $role !== $current_role) {
        if (!in_array($role, ['owner', 'admin', 'editor'], true)) {
            json_error('Role must be "owner", "admin", or "editor".');
        }

        if (($role === 'owner' || $current_role === 'owner') && !is_owner()) {
            json_error('Only owners can change the owner role.', 403);
        }

        if ($current_role === 'owner' && $role !== 'owner') {
            $owner_count = 0;
            foreach ($cfg['users'] as $u) {
                if ($u['role'] === 'owner') $owner_count++;
            }
            if ($owner_count <= 1) {
                json_error('Cannot demote the last owner.');
            }
        }

        if ($current_role === 'admin' && $role !== 'admin' && $role !== 'owner') {
            $admin_count = 0;
            foreach ($cfg['users'] as $u) {
                if (in_array($u['role'], ['admin', 'owner'], true)) $admin_count++;
            }
            if ($admin_count <= 1) {
                json_error('Cannot demote the last admin.');
            }
        }

        $cfg['users'][$email]['role'] = $role;
    }

    if ($password !== '') {
        if (strlen($password) < 6) {
            json_error('Password must be at least 6 characters.');
        }
        $cfg['users'][$email]['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
    }

    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }

    require_once __DIR__ . '/../webhook-dispatch.php';
    dispatch_webhooks($cfg, 'user.updated', ['email' => $email]);

    json_response([
        'user'    => ['email' => $email, 'role' => $cfg['users'][$email]['role']],
        'message' => 'User updated.',
    ]);
}

function handle_users_delete(array $cfg, array $license): never {
    require_admin();
    require_post();
    verify_csrf();

    $input = get_json_body();
    $email = strtolower(trim((string) ($input['email'] ?? '')));

    if (!isset($cfg['users'][$email])) {
        json_error('User not found.', 404);
    }

    if ($email === current_user()) {
        json_error('Cannot delete your own account.');
    }

    if ($cfg['users'][$email]['role'] === 'owner') {
        if (!is_owner()) {
            json_error('Only owners can delete owner users.', 403);
        }
        $owner_count = 0;
        foreach ($cfg['users'] as $u) {
            if ($u['role'] === 'owner') $owner_count++;
        }
        if ($owner_count <= 1) {
            json_error('Cannot delete the last owner.');
        }
    }

    if ($cfg['users'][$email]['role'] === 'admin') {
        $admin_count = 0;
        foreach ($cfg['users'] as $u) {
            if (in_array($u['role'], ['admin', 'owner'], true)) $admin_count++;
        }
        if ($admin_count <= 1) {
            json_error('Cannot delete the last admin.');
        }
    }

    unset($cfg['users'][$email]);

    // Cascade: revoke any MCP bearer tokens bound to the vanished user, so
    // an AI agent can't keep acting on a deleted account.
    require_once __DIR__ . '/../mcp/tokens.php';
    mcp_tokens_revoke_for_user($cfg, $email);

    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }

    require_once __DIR__ . '/../webhook-dispatch.php';
    dispatch_webhooks($cfg, 'user.deleted', ['email' => $email]);

    json_ok('User deleted.');
}
