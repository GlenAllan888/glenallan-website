<?php

function handle_webhooks_list(array $cfg, array $license): never {
    require_owner();

    // --- Inlined paid-feature gate (webhooks flag) --------------------------
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
    if (!is_array($_lic_entry['limits'] ?? null) || empty($_lic_entry['limits']['webhooks'])) {
        json_error('Webhooks require Studio plan.', 403);
    }
    // --- end inlined gate ---------------------------------------------------

    $webhooks = $cfg['webhooks'] ?? [];

    // Strip secrets from list response
    $safe = array_map(function ($wh) {
        return [
            'id'         => $wh['id'],
            'url'        => $wh['url'],
            'events'     => $wh['events'],
            'enabled'    => $wh['enabled'],
            'created_at' => $wh['created_at'] ?? '',
        ];
    }, $webhooks);

    json_response(['webhooks' => array_values($safe)]);
}

function handle_webhooks_create(array $cfg, array $license): never {
    require_owner();
    require_post();
    verify_csrf();

    // --- Inlined paid-feature gate (webhooks flag) --------------------------
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
    if (!is_array($_lic_entry['limits'] ?? null) || empty($_lic_entry['limits']['webhooks'])) {
        json_error('Webhooks require Studio plan.', 403);
    }
    // --- end inlined gate ---------------------------------------------------

    $input = get_json_body();
    $url = trim($input['url'] ?? '');
    $events = $input['events'] ?? [];
    $enabled = (bool) ($input['enabled'] ?? true);

    if (!filter_var($url, FILTER_VALIDATE_URL)) {
        json_error('Please enter a valid URL.');
    }

    if (!str_starts_with($url, 'https://')) {
        json_error('Webhook URL must use HTTPS.');
    }

    $allowed_events = ['file.created', 'file.updated', 'file.deleted', 'user.created', 'user.updated', 'user.deleted'];
    $events = array_values(array_intersect((array) $events, $allowed_events));

    if (empty($events)) {
        json_error('Select at least one event.');
    }

    $webhook = [
        'id'         => 'wh_' . bin2hex(random_bytes(8)),
        'url'        => $url,
        'events'     => $events,
        'secret'     => 'whsec_' . bin2hex(random_bytes(16)),
        'enabled'    => $enabled,
        'created_at' => gmdate('Y-m-d\TH:i:s\Z'),
    ];

    $cfg['webhooks'] = $cfg['webhooks'] ?? [];
    $cfg['webhooks'][] = $webhook;

    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }

    json_response([
        'webhook' => $webhook, // includes secret on create only
        'message' => 'Webhook created.',
    ]);
}

function handle_webhooks_update(array $cfg, array $license): never {
    require_owner();
    require_post();
    verify_csrf();

    // --- Inlined paid-feature gate (webhooks flag) --------------------------
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
    if (!is_array($_lic_entry['limits'] ?? null) || empty($_lic_entry['limits']['webhooks'])) {
        json_error('Webhooks require Studio plan.', 403);
    }
    // --- end inlined gate ---------------------------------------------------

    $input = get_json_body();
    $id = $input['id'] ?? '';

    $index = null;
    foreach ($cfg['webhooks'] ?? [] as $i => $wh) {
        if ($wh['id'] === $id) { $index = $i; break; }
    }

    if ($index === null) {
        json_error('Webhook not found.', 404);
    }

    if (isset($input['url'])) {
        $url = trim($input['url']);
        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            json_error('Please enter a valid URL.');
        }
        if (!str_starts_with($url, 'https://')) {
            json_error('Webhook URL must use HTTPS.');
        }
        $cfg['webhooks'][$index]['url'] = $url;
    }

    if (isset($input['events'])) {
        $allowed_events = ['file.created', 'file.updated', 'file.deleted', 'user.created', 'user.updated', 'user.deleted'];
        $events = array_values(array_intersect((array) $input['events'], $allowed_events));
        if (empty($events)) {
            json_error('Select at least one event.');
        }
        $cfg['webhooks'][$index]['events'] = $events;
    }

    if (isset($input['enabled'])) {
        $cfg['webhooks'][$index]['enabled'] = (bool) $input['enabled'];
    }

    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }

    // Return without secret
    $wh = $cfg['webhooks'][$index];
    json_response([
        'webhook' => [
            'id'         => $wh['id'],
            'url'        => $wh['url'],
            'events'     => $wh['events'],
            'enabled'    => $wh['enabled'],
            'created_at' => $wh['created_at'] ?? '',
        ],
        'message' => 'Webhook updated.',
    ]);
}

function handle_webhooks_delete(array $cfg, array $license): never {
    require_owner();
    require_post();
    verify_csrf();

    // --- Inlined paid-feature gate (webhooks flag) --------------------------
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
    if (!is_array($_lic_entry['limits'] ?? null) || empty($_lic_entry['limits']['webhooks'])) {
        json_error('Webhooks require Studio plan.', 403);
    }
    // --- end inlined gate ---------------------------------------------------

    $input = get_json_body();
    $id = $input['id'] ?? '';

    $found = false;
    foreach ($cfg['webhooks'] ?? [] as $i => $wh) {
        if ($wh['id'] === $id) {
            array_splice($cfg['webhooks'], $i, 1);
            $found = true;
            break;
        }
    }

    if (!$found) {
        json_error('Webhook not found.', 404);
    }

    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }

    json_ok('Webhook deleted.');
}

function handle_webhooks_log(array $cfg, array $license): never {
    require_owner();

    // --- Inlined paid-feature gate (webhooks flag) --------------------------
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
    if (!is_array($_lic_entry['limits'] ?? null) || empty($_lic_entry['limits']['webhooks'])) {
        json_error('Webhooks require Studio plan.', 403);
    }
    // --- end inlined gate ---------------------------------------------------

    $base_dir = $cfg['base_dir'] ?? dirname(__DIR__, 2);
    $log_file = $base_dir . '/data/webhook-log.log';

    if (!file_exists($log_file)) {
        json_response(['entries' => []]);
    }

    $lines = file($log_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        json_response(['entries' => []]);
    }

    // Most recent first, cap at 50
    $lines = array_slice(array_reverse($lines), 0, 50);

    $entries = [];
    foreach ($lines as $line) {
        $entry = [];
        if (preg_match_all('/(\w+)=([^|]+)/', $line, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $m) {
                $entry[trim($m[1])] = trim($m[2]);
            }
        }
        // First segment before the first | is the timestamp
        $parts = explode(' | ', $line, 2);
        $entry['timestamp'] = trim($parts[0] ?? '');

        if (!empty($entry)) {
            $entries[] = [
                'timestamp' => $entry['timestamp'] ?? '',
                'event'     => $entry['event'] ?? '',
                'url'       => $entry['url'] ?? '',
                'http'      => $entry['http'] ?? '',
                'status'    => $entry['status'] ?? 'error',
                'error'     => $entry['error'] ?? '',
            ];
        }
    }

    json_response(['entries' => $entries]);
}

function handle_webhooks_clear_log(array $cfg, array $license): never {
    require_owner();
    require_post();
    verify_csrf();

    // --- Inlined paid-feature gate (webhooks flag) --------------------------
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
    if (!is_array($_lic_entry['limits'] ?? null) || empty($_lic_entry['limits']['webhooks'])) {
        json_error('Webhooks require Studio plan.', 403);
    }
    // --- end inlined gate ---------------------------------------------------

    $base_dir = $cfg['base_dir'] ?? dirname(__DIR__, 2);
    $log_file = $base_dir . '/data/webhook-log.log';

    if (file_exists($log_file)) {
        unlink($log_file);
    }

    json_ok('Log cleared.');
}
