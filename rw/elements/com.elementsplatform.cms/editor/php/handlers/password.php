<?php

function handle_password_change(array $cfg, array $license): never {
    require_post();
    verify_csrf();

    $input = get_json_body();
    $current = $input['current_password'] ?? '';
    $new_pass = $input['new_password'] ?? '';
    $confirm = $input['confirm_password'] ?? '';

    $email = current_user();

    if (!isset($cfg['users'][$email])) {
        json_error('User not found.', 404);
    }

    if (!password_verify($current, $cfg['users'][$email]['password_hash'])) {
        json_error('Current password is incorrect.');
    }

    if (strlen($new_pass) < 6) {
        json_error('New password must be at least 6 characters.');
    }

    if ($new_pass !== $confirm) {
        json_error('New passwords do not match.');
    }

    $cfg['users'][$email]['password_hash'] = password_hash($new_pass, PASSWORD_DEFAULT);

    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }

    json_ok('Password changed.');
}

function handle_account_language(array $cfg, array $license): never {
    require_post();
    verify_csrf();

    $input = get_json_body();
    $email = current_user();

    if (!isset($cfg['users'][$email])) {
        json_error('User not found.', 404);
    }

    $language = $input['language'] ?? 'en';
    if (!in_array($language, ALLOWED_LANGUAGES, true)) {
        json_error('Invalid language.');
    }

    $cfg['users'][$email]['language'] = $language;

    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }

    json_response(['ok' => true, 'language' => $language]);
}
