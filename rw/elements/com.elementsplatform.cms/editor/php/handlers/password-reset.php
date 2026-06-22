<?php

const PASSWORD_RESET_TTL = 3600;
const PASSWORD_RESET_MAX_PENDING = 20;

function password_reset_dir(): string {
    return __DIR__ . '/../password-reset';
}

function challenge_file_path(string $token): string {
    return password_reset_dir() . '/' . $token . '.txt';
}

function password_reset_display_path(string $token): string {
    $dir = password_reset_dir();
    $real = realpath($dir) ?: $dir;
    $abs_file = rtrim($real, '/') . '/' . $token . '.txt';
    $doc_root = isset($_SERVER['DOCUMENT_ROOT']) ? realpath($_SERVER['DOCUMENT_ROOT']) : false;
    if ($doc_root && str_starts_with($abs_file, $doc_root)) {
        return substr($abs_file, strlen($doc_root));
    }
    return $abs_file;
}

function prune_password_resets(array &$cfg): void {
    if (empty($cfg['password_resets']) || !is_array($cfg['password_resets'])) {
        $cfg['password_resets'] = [];
        return;
    }
    $now = time();
    foreach ($cfg['password_resets'] as $t => $r) {
        if (!is_array($r) || ($r['expires'] ?? 0) < $now) {
            @unlink(challenge_file_path((string) $t));
            unset($cfg['password_resets'][$t]);
        }
    }
}

function reset_lookup_token(array $cfg, string $token): ?array {
    if (empty($cfg['password_resets']) || !is_array($cfg['password_resets'])) {
        return null;
    }
    foreach ($cfg['password_resets'] as $stored => $r) {
        if (hash_equals((string) $stored, $token)) {
            if (!is_array($r)) return null;
            if (($r['expires'] ?? 0) < time()) return null;
            return [
                'email'   => $r['email'] ?? null,
                'expires' => $r['expires'],
            ];
        }
    }
    return null;
}

function handle_reset_initiate(): never {
    require_post();

    $cfg = load_config();
    $input = get_json_body();
    $email = strtolower(trim((string) ($input['email'] ?? '')));

    $token = bin2hex(random_bytes(32));

    prune_password_resets($cfg);

    if (count($cfg['password_resets']) < PASSWORD_RESET_MAX_PENDING) {
        $known = $email !== '' && isset($cfg['users'][$email]);
        $cfg['password_resets'][$token] = [
            'email'   => $known ? $email : null,
            'expires' => time() + PASSWORD_RESET_TTL,
        ];

        if (!save_config($cfg)) {
            json_error('Failed to save configuration.', 500);
        }

        $dir = password_reset_dir();
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
    }

    json_response([
        'token'              => $token,
        'challenge_path'     => password_reset_display_path($token),
        'challenge_filename' => $token . '.txt',
        'expires_in'         => PASSWORD_RESET_TTL,
    ]);
}

function handle_reset_verify(): never {
    require_post();

    $cfg = load_config();
    $input = get_json_body();
    $token = (string) ($input['token'] ?? '');

    if (!preg_match('/^[0-9a-f]{64}$/', $token)) {
        json_error('Invalid reset token.', 400);
    }

    $entry = reset_lookup_token($cfg, $token);
    if ($entry === null) {
        json_error('Reset token is invalid or expired.', 400);
    }

    if (!is_file(challenge_file_path($token))) {
        json_error('Challenge file not found. Upload the file and try again.', 400);
    }

    if ($entry['email'] === null || !isset($cfg['users'][$entry['email']])) {
        json_error('Unknown user for this reset. Start over with the correct email.', 400);
    }

    json_response(['ok' => true, 'email' => $entry['email']]);
}

function handle_reset_complete(): never {
    require_post();

    $cfg = load_config();
    $input = get_json_body();
    $token = (string) ($input['token'] ?? '');
    $new_pass = (string) ($input['new_password'] ?? '');
    $confirm = (string) ($input['confirm_password'] ?? '');

    if (!preg_match('/^[0-9a-f]{64}$/', $token)) {
        json_error('Invalid reset token.', 400);
    }

    $entry = reset_lookup_token($cfg, $token);
    if ($entry === null) {
        json_error('Reset token is invalid or expired.', 400);
    }

    if (!is_file(challenge_file_path($token))) {
        json_error('Challenge file not found. Upload the file and try again.', 400);
    }

    if ($entry['email'] === null || !isset($cfg['users'][$entry['email']])) {
        json_error('Unknown user for this reset. Start over with the correct email.', 400);
    }

    if (strlen($new_pass) < 6) {
        json_error('New password must be at least 6 characters.');
    }
    if ($new_pass !== $confirm) {
        json_error('New passwords do not match.');
    }

    $email = $entry['email'];
    $cfg['users'][$email]['password_hash'] = password_hash($new_pass, PASSWORD_DEFAULT);
    $current_version = (int) ($cfg['users'][$email]['session_version'] ?? 0);
    $cfg['users'][$email]['session_version'] = $current_version + 1;
    $cfg['users'][$email]['passkeys'] = [];

    foreach ($cfg['password_resets'] ?? [] as $t => $r) {
        if (!is_array($r) || ($r['email'] ?? null) === $email) {
            @unlink(challenge_file_path((string) $t));
            unset($cfg['password_resets'][$t]);
        }
    }

    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }

    $dir = password_reset_dir();
    if (is_dir($dir)) {
        $entries = @scandir($dir);
        if ($entries !== false && array_diff($entries, ['.', '..']) === []) {
            @rmdir($dir);
        }
    }

    json_ok('Password reset.');
}
