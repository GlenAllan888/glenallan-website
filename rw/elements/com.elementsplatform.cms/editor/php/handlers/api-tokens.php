<?php

// ---------------------------------------------------------------------------
// Admin handlers for JSON REST API key management (owner-only).
// ---------------------------------------------------------------------------
// Keys live in config.php under `api_tokens` and are hashed with
// password_hash(). Plaintext is shown once, at creation time.
//
// Separate from MCP tokens (mcp_tokens) — see project memory: these are two
// products with two admin surfaces, not one. Never merge the stores.

require_once __DIR__ . '/../api/auth.php';

function handle_api_tokens_list(array $cfg, array $license): never {
    require_owner();

    // --- Inlined paid-feature gate (api_tokens flag) ------------------------
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
    if (!is_array($_lic_entry['limits'] ?? null) || empty($_lic_entry['limits']['api_tokens'])) {
        json_error('JSON API access requires Studio plan.', 403);
    }
    // --- end inlined gate ---------------------------------------------------

    $tokens = array_map('api_token_public_summary', api_tokens($cfg));
    json_response(['tokens' => array_values($tokens)]);
}

function handle_api_tokens_create(array $cfg, array $license): never {
    require_owner();
    require_post();
    verify_csrf();

    // --- Inlined paid-feature gate (api_tokens flag) ------------------------
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
    if (!is_array($_lic_entry['limits'] ?? null) || empty($_lic_entry['limits']['api_tokens'])) {
        json_error('JSON API access requires Studio plan.', 403);
    }
    // --- end inlined gate ---------------------------------------------------

    $input = get_json_body();
    $name = trim((string) ($input['name'] ?? ''));
    $email = strtolower(trim((string) ($input['email'] ?? current_user())));

    if ($name === '') {
        json_error('Key name is required.');
    }
    if (mb_strlen($name) > 80) {
        json_error('Key name is too long (max 80 characters).');
    }
    if (!isset($cfg['users'][$email])) {
        json_error('User not found.', 404);
    }

    $plaintext = api_generate_token_plaintext();
    $token = [
        'id'           => 'apit_' . bin2hex(random_bytes(8)),
        'name'         => $name,
        'email'        => $email,
        'hash'         => password_hash($plaintext, PASSWORD_DEFAULT),
        'prefix'       => api_token_prefix_hint($plaintext),
        'created_at'   => time(),
        'last_used_at' => 0,
        'created_by'   => current_user(),
    ];

    $cfg['api_tokens'] = $cfg['api_tokens'] ?? [];
    $cfg['api_tokens'][] = $token;

    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }

    json_response([
        'token'     => api_token_public_summary($token),
        'plaintext' => $plaintext,
        'message'   => 'Key created. Copy it now — it will not be shown again.',
    ]);
}

function handle_api_tokens_revoke(array $cfg, array $license): never {
    require_owner();
    require_post();
    verify_csrf();

    // --- Inlined paid-feature gate (api_tokens flag) ------------------------
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
    if (!is_array($_lic_entry['limits'] ?? null) || empty($_lic_entry['limits']['api_tokens'])) {
        json_error('JSON API access requires Studio plan.', 403);
    }
    // --- end inlined gate ---------------------------------------------------

    $input = get_json_body();
    $id = (string) ($input['id'] ?? '');

    $found = false;
    foreach ($cfg['api_tokens'] ?? [] as $i => $t) {
        if (($t['id'] ?? '') === $id) {
            array_splice($cfg['api_tokens'], $i, 1);
            $found = true;
            break;
        }
    }
    if (!$found) {
        json_error('Key not found.', 404);
    }

    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }

    json_ok('Key revoked.');
}
