<?php

function handle_theme_get(array $cfg, array $license): never {
    require_owner();

    // --- Inlined paid-feature gate (theme_customization flag) ---------------
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
    if (!is_array($_lic_entry['limits'] ?? null) || empty($_lic_entry['limits']['theme_customization'])) {
        json_error('Theme customisation requires Studio plan.', 403);
    }
    // --- end inlined gate ---------------------------------------------------

    json_response([
        'theme' => $cfg['theme'] ?? FREE_TIER_THEME,
    ]);
}

function handle_theme_update(array $cfg, array $license): never {
    require_owner();
    require_post();
    verify_csrf();

    // --- Inlined paid-feature gate (theme_customization flag) ---------------
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
    if (!is_array($_lic_entry['limits'] ?? null) || empty($_lic_entry['limits']['theme_customization'])) {
        json_error('Theme customisation requires Studio plan.', 403);
    }
    // --- end inlined gate ---------------------------------------------------

    $input = get_json_body();

    $allowed_colors = ['purple', 'blue', 'indigo', 'teal', 'emerald', 'rose', 'amber', 'red', 'slate', 'custom'];
    $allowed_surface = ['slate', 'gray', 'zinc', 'neutral', 'stone'];
    $allowed_presets = ['light', 'dark', 'auto'];
    $language = in_array($input['language'] ?? ($cfg['language'] ?? 'en'), ALLOWED_LANGUAGES, true)
        ? ($input['language'] ?? ($cfg['language'] ?? 'en'))
        : 'en';
    $cfg['language'] = $language;
    $allowed_fonts = ['system', 'inter', 'plus-jakarta', 'dm-sans', 'outfit', 'nunito', 'poppins', 'raleway', 'lato', 'open-sans', 'roboto', 'source-sans-3', 'merriweather', 'playfair-display'];

    $accent = trim($input['accent_color'] ?? 'purple');
    if (!in_array($accent, $allowed_colors, true)) {
        $accent = 'purple';
    }

    $surface = trim($input['surface_color'] ?? 'stone');
    if (!in_array($surface, $allowed_surface, true)) {
        $surface = 'stone';
    }

    $preset = trim($input['preset'] ?? 'light');
    if (!in_array($preset, $allowed_presets, true)) {
        $preset = 'light';
    }

    $font_heading = trim($input['font_heading'] ?? 'system');
    if (!in_array($font_heading, $allowed_fonts, true)) {
        $font_heading = 'system';
    }

    $font_body = trim($input['font_body'] ?? 'system');
    if (!in_array($font_body, $allowed_fonts, true)) {
        $font_body = 'system';
    }

    $custom_palette = null;
    if ($accent === 'custom') {
        $raw_palette = $input['custom_palette'] ?? [];
        $allowed_shades = ['50','100','200','300','400','500','600','700','800','900','950'];
        $custom_palette = [];

        foreach ($allowed_shades as $shade) {
            $val = trim($raw_palette[$shade] ?? '');
            if (preg_match('/^\d{1,3} \d{1,3} \d{1,3}$/', $val)) {
                $parts = array_map('intval', explode(' ', $val));
                if ($parts[0] <= 255 && $parts[1] <= 255 && $parts[2] <= 255) {
                    $custom_palette[$shade] = $val;
                    continue;
                }
            }
            $custom_palette = null;
            $accent = 'purple';
            break;
        }
    }

    $cfg['theme'] = [
        'site_name'      => trim($input['site_name'] ?? '') ?: 'Elements CMS',
        'logo'           => trim($input['logo'] ?? '') ?: null,
        'logo_dark'      => trim($input['logo_dark'] ?? '') ?: null,
        'preset'         => $preset,
        'accent_color'   => $accent,
        'surface_color'  => $surface,
        'font_heading'   => $font_heading,
        'font_body'      => $font_body,
        'custom_palette' => $custom_palette,
    ];

    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }

    json_ok('Theme settings saved.');
}
