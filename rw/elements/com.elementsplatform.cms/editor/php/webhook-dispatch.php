<?php

/**
 * Webhook event dispatch — fires HTTP POST to registered webhook URLs.
 * Uses curl_multi to send all webhooks concurrently.
 */

function dispatch_webhooks_feature_enabled(): bool {
    // --- Inlined paid-feature gate (webhooks flag) --------------------------
    $_lic_path = __DIR__ . '/.elements_license_state.json';
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
    // --- end inlined gate ---------------------------------------------------
    return is_array($_lic_entry['limits'] ?? null) && !empty($_lic_entry['limits']['webhooks']);
}

function dispatch_webhooks(array $cfg, string $event, array $data): void {
    if (!dispatch_webhooks_feature_enabled()) return;

    $webhooks = $cfg['webhooks'] ?? [];
    if (empty($webhooks)) return;

    $mh = curl_multi_init();
    $handles = [];

    foreach ($webhooks as $webhook) {
        if (empty($webhook['enabled'])) continue;
        if (!in_array($event, $webhook['events'] ?? [], true)) continue;

        $body = json_encode([
            'event'     => $event,
            'timestamp' => gmdate('Y-m-d\TH:i:s\Z'),
            'data'      => $data,
        ]);

        $signature = 'sha256=' . hash_hmac('sha256', $body, $webhook['secret'] ?? '');

        $ch = curl_init($webhook['url']);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'X-Webhook-Signature: ' . $signature,
                'User-Agent: ElementsCMS/1.0',
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_FOLLOWLOCATION => false,
        ]);

        curl_multi_add_handle($mh, $ch);
        $handles[] = ['handle' => $ch, 'url' => $webhook['url']];
    }

    if (empty($handles)) {
        curl_multi_close($mh);
        return;
    }

    // Execute all requests concurrently
    do {
        $status = curl_multi_exec($mh, $running);
    } while ($status === CURLM_CALL_MULTI_PERFORM);

    while ($running && $status === CURLM_OK) {
        if (curl_multi_select($mh, 10) === -1) {
            usleep(100);
        }
        do {
            $status = curl_multi_exec($mh, $running);
        } while ($status === CURLM_CALL_MULTI_PERFORM);
    }

    // Log all deliveries
    $base_dir = $cfg['base_dir'] ?? dirname(__DIR__);
    $log_dir = $base_dir . '/data';
    if (!is_dir($log_dir)) {
        mkdir($log_dir, 0755, true);
    }
    $log_file = $log_dir . '/webhook-log.log';

    $new_lines = '';
    foreach ($handles as $entry) {
        $ch = $entry['handle'];
        $err = curl_error($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);

        $is_error = $err || $code === 0 || $code >= 400;
        if (!$err && $code === 0) {
            $err = 'Connection failed (DNS or network error)';
        }

        $new_lines .= gmdate('Y-m-d\TH:i:s\Z')
            . ' | event=' . $event
            . ' | url=' . $entry['url']
            . ' | http=' . $code
            . ' | status=' . ($is_error ? 'error' : 'success')
            . ' | error=' . ($is_error ? $err : '')
            . "\n";

        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
    }

    // Append and trim to 200 entries
    @file_put_contents($log_file, $new_lines, FILE_APPEND | LOCK_EX);
    $lines = @file($log_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines && count($lines) > 200) {
        $lines = array_slice($lines, -200);
        @file_put_contents($log_file, implode("\n", $lines) . "\n", LOCK_EX);
    }

    curl_multi_close($mh);
}
