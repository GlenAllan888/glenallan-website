<?php

// ---------------------------------------------------------------------------
// AI settings + writing-assistant handlers. Paid-license only.
// ---------------------------------------------------------------------------
// Endpoint shape — see api.php routes:
//   ai.settings.get          (owner)  → current config, masked
//   ai.settings.save         (owner)  → partial update of toggles/defaults
//   ai.providers.setKey      (owner)  → store a BYOK API key
//   ai.providers.clearKey    (owner)  → remove a BYOK API key
//   ai.models.list           (owner)  → models known for a provider
//   ai.assist.run            (any)    → writing-assistant inference

require_once __DIR__ . '/../ai/providers.php';
require_once __DIR__ . '/../ai/secrets.php';
require_once __DIR__ . '/../ai/prompts.php';
require_once __DIR__ . '/../ai/dispatch.php';

// ---------------------------------------------------------------------------
// Shared config shape + helpers
// ---------------------------------------------------------------------------

function ai_config_defaults(): array {
    return [
        'master_enabled'    => false,
        'features'          => [
            'writing_assistant' => ['enabled' => false],
        ],
        'defaults'          => [
            'text' => ['provider' => 'anthropic', 'model' => 'claude-sonnet-4-6'],
        ],
        'providers'         => [],
        'site_instructions' => '',
    ];
}

// Soft cap on how much custom instruction text is stored + sent to the model.
// Matches the 2000-char context window used in handle_ai_assist_run().
const AI_SITE_INSTRUCTIONS_MAX = 2000;

function ai_config(array $cfg): array {
    $defaults = ai_config_defaults();
    $ai = $cfg['ai'] ?? [];
    // One-deep merge; nested arrays replace rather than merge so explicit
    // false/0 values from the user are respected.
    foreach ($defaults as $k => $v) {
        if (!isset($ai[$k])) $ai[$k] = $v;
    }
    $ai['features'] = array_merge($defaults['features'], $ai['features'] ?? []);
    $ai['defaults'] = array_merge($defaults['defaults'], $ai['defaults'] ?? []);
    $ai['providers'] = $ai['providers'] ?? [];
    $ai['site_instructions'] = (string) ($ai['site_instructions'] ?? '');
    return $ai;
}

function ai_settings_public(array $cfg): array {
    $ai = ai_config($cfg);
    return [
        'master_enabled'      => (bool) $ai['master_enabled'],
        'features'            => [
            'writing_assistant' => [
                'enabled'  => (bool) ($ai['features']['writing_assistant']['enabled'] ?? false),
                'provider' => $ai['features']['writing_assistant']['provider'] ?? null,
                'model'    => $ai['features']['writing_assistant']['model'] ?? null,
            ],
        ],
        'defaults'            => $ai['defaults'],
        'providers'           => ai_providers_public($cfg),
        'site_instructions'   => (string) ($ai['site_instructions'] ?? ''),
        'libsodium_available' => ai_has_libsodium(),
    ];
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function handle_ai_settings_get(array $cfg, array $license): never {
    require_owner();
    // --- Inlined paid-feature gate (ai flag) --------------------------------
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
    if (!is_array($_lic_entry['limits'] ?? null) || empty($_lic_entry['limits']['ai'])) {
        json_error('AI writing assistant requires Studio plan.', 403);
    }
    // --- end inlined gate ---------------------------------------------------
    json_response(ai_settings_public($cfg));
}

function handle_ai_settings_save(array $cfg, array $license): never {
    require_owner();
    // --- Inlined paid-feature gate (ai flag) --------------------------------
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
    if (!is_array($_lic_entry['limits'] ?? null) || empty($_lic_entry['limits']['ai'])) {
        json_error('AI writing assistant requires Studio plan.', 403);
    }
    // --- end inlined gate ---------------------------------------------------
    require_post();
    verify_csrf();

    $input = get_json_body();
    $ai = ai_config($cfg);

    if (array_key_exists('master_enabled', $input)) {
        $ai['master_enabled'] = (bool) $input['master_enabled'];
    }

    if (array_key_exists('site_instructions', $input)) {
        $ai['site_instructions'] = mb_substr(
            trim((string) $input['site_instructions']),
            0,
            AI_SITE_INSTRUCTIONS_MAX
        );
    }

    if (isset($input['features']) && is_array($input['features'])) {
        foreach ($input['features'] as $feature_id => $patch) {
            if (!isset($ai['features'][$feature_id])) continue; // ignore unknown features
            if (!is_array($patch)) continue;
            if (array_key_exists('enabled', $patch)) {
                $ai['features'][$feature_id]['enabled'] = (bool) $patch['enabled'];
            }
            if (array_key_exists('provider', $patch)) {
                $prov = $patch['provider'];
                if ($prov === null || $prov === '') {
                    unset($ai['features'][$feature_id]['provider']);
                } elseif (ai_provider_def((string) $prov)) {
                    $ai['features'][$feature_id]['provider'] = (string) $prov;
                }
            }
            if (array_key_exists('model', $patch)) {
                $model = $patch['model'];
                if ($model === null || $model === '') {
                    unset($ai['features'][$feature_id]['model']);
                } else {
                    $ai['features'][$feature_id]['model'] = (string) $model;
                }
            }
        }
    }

    if (isset($input['defaults']['text']) && is_array($input['defaults']['text'])) {
        $patch = $input['defaults']['text'];
        if (isset($patch['provider']) && ai_provider_def((string) $patch['provider'])) {
            $ai['defaults']['text']['provider'] = (string) $patch['provider'];
        }
        if (isset($patch['model'])) {
            $ai['defaults']['text']['model'] = (string) $patch['model'];
        }
        if (!ai_provider_supports_model(
            $ai['defaults']['text']['provider'],
            $ai['defaults']['text']['model']
        )) {
            json_error('Default model is not registered for the selected provider.');
        }
    }

    $cfg['ai'] = $ai;
    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }
    json_response(ai_settings_public($cfg));
}

// ---------------------------------------------------------------------------
// Provider keys
// ---------------------------------------------------------------------------

function handle_ai_providers_set_key(array $cfg, array $license): never {
    require_owner();
    // --- Inlined paid-feature gate (ai flag) --------------------------------
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
    if (!is_array($_lic_entry['limits'] ?? null) || empty($_lic_entry['limits']['ai'])) {
        json_error('AI writing assistant requires Studio plan.', 403);
    }
    // --- end inlined gate ---------------------------------------------------
    require_post();
    verify_csrf();

    $input = get_json_body();
    $provider = (string) ($input['provider'] ?? '');
    $key = trim((string) ($input['key'] ?? ''));

    if (!ai_provider_def($provider)) {
        json_error('Unknown provider.', 400);
    }
    if ($key === '' || strlen($key) < 8) {
        json_error('API key looks invalid.', 400);
    }

    // Fail-fast auth check so the user sees obvious errors at save time
    // rather than at first use. Skipped if the adapter doesn't ship a ping.
    try {
        ai_provider_ping($provider, $key);
    } catch (RuntimeException $e) {
        json_error($e->getMessage(), 400);
    }

    $ai = ai_config($cfg);
    $ai['providers'][$provider] = [
        'key_cipher' => ai_encrypt($key),
        'key_last4'  => ai_key_last4($key),
        'key_set_at' => time(),
        'enabled'    => true,
    ];

    $cfg['ai'] = $ai;
    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }
    json_response(ai_settings_public($cfg));
}

function handle_ai_providers_clear_key(array $cfg, array $license): never {
    require_owner();
    // --- Inlined paid-feature gate (ai flag) --------------------------------
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
    if (!is_array($_lic_entry['limits'] ?? null) || empty($_lic_entry['limits']['ai'])) {
        json_error('AI writing assistant requires Studio plan.', 403);
    }
    // --- end inlined gate ---------------------------------------------------
    require_post();
    verify_csrf();

    $input = get_json_body();
    $provider = (string) ($input['provider'] ?? '');

    if (!ai_provider_def($provider)) {
        json_error('Unknown provider.', 400);
    }

    $ai = ai_config($cfg);
    unset($ai['providers'][$provider]);

    $cfg['ai'] = $ai;
    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }
    json_response(ai_settings_public($cfg));
}

function handle_ai_models_list(array $cfg, array $license): never {
    require_owner();
    // --- Inlined paid-feature gate (ai flag) --------------------------------
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
    if (!is_array($_lic_entry['limits'] ?? null) || empty($_lic_entry['limits']['ai'])) {
        json_error('AI writing assistant requires Studio plan.', 403);
    }
    // --- end inlined gate ---------------------------------------------------

    $provider = (string) ($_GET['provider'] ?? '');
    $def = ai_provider_def($provider);
    if (!$def) {
        json_error('Unknown provider.', 400);
    }
    json_response(['models' => $def['models']]);
}

// ---------------------------------------------------------------------------
// Writing assistant inference
// ---------------------------------------------------------------------------

function handle_ai_assist_run(array $cfg, array $license): never {
    require_login();
    // --- Inlined paid-feature gate (ai flag) --------------------------------
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
    if (!is_array($_lic_entry['limits'] ?? null) || empty($_lic_entry['limits']['ai'])) {
        json_error('AI writing assistant requires Studio plan.', 403);
    }
    // --- end inlined gate ---------------------------------------------------
    require_post();
    verify_csrf();

    $input = get_json_body();
    $action_id = (string) ($input['action'] ?? '');
    $selection = (string) ($input['selection'] ?? '');
    $context = (string) ($input['context'] ?? '');
    $custom_prompt = (string) ($input['customPrompt'] ?? '');
    $target_lang = (string) ($input['targetLang'] ?? '');

    $action = ai_writing_action($action_id);
    if (!$action) {
        json_error('Unknown writing action: ' . $action_id, 400);
    }
    if (!empty($action['requires_selection']) && $selection === '') {
        json_error('Please select some text first.', 400);
    }

    $params = [];
    if (in_array('target_lang', $action['params'] ?? [], true)) {
        if ($target_lang === '') {
            json_error('Please choose a target language.', 400);
        }
        $params['target_lang'] = $target_lang;
    }
    if (in_array('custom', $action['params'] ?? [], true)) {
        if ($custom_prompt === '') {
            json_error('Please enter a prompt.', 400);
        }
        $params['custom'] = $custom_prompt;
    }

    $system = ai_render_prompt($action['system'], $params);

    // Prepend site-wide custom instructions (configured in AI settings) so
    // voice/audience/style rules apply to every action. Action-specific
    // output rules stay last, which keeps the model's output discipline.
    $site_instructions = trim((string) (ai_config($cfg)['site_instructions'] ?? ''));
    if ($site_instructions !== '') {
        $system = "Site instructions (apply to all writing on this site):\n"
            . $site_instructions
            . "\n\n" . $system;
    }

    // Compose the user turn. For "continue" the surrounding text *is* the
    // selection; for everything else the selection is the subject and the
    // context is supporting material trimmed to a sensible window.
    $context = mb_substr($context, 0, 2000);
    $user_parts = [];
    if ($selection !== '') {
        $user_parts[] = "<selection>\n" . $selection . "\n</selection>";
    }
    if ($context !== '') {
        $user_parts[] = "<surrounding_context>\n" . $context . "\n</surrounding_context>";
    }
    if ($action_id === 'continue' && $selection === '' && $context !== '') {
        $user_parts = ["<document_so_far>\n" . $context . "\n</document_so_far>\n\nContinue from the end."];
    }
    if (empty($user_parts)) {
        $user_parts[] = 'Please proceed.';
    }

    $messages = [
        ['role' => 'system', 'content' => $system],
        ['role' => 'user',   'content' => implode("\n\n", $user_parts)],
    ];

    try {
        $result = ai_text($cfg, 'writing_assistant', $messages, [
            'max_tokens' => 2048,
            'timeout'    => 60,
        ]);
    } catch (RuntimeException $e) {
        json_error($e->getMessage(), 502);
    }

    json_response([
        'text'  => trim($result['text'] ?? ''),
        'mode'  => $action['mode'],
        'usage' => $result['usage'] ?? null,
    ]);
}
