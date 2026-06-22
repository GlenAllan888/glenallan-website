<?php

require_once __DIR__ . '/../lib/webauthn/WebAuthn.php';

use lbuchs\WebAuthn\WebAuthn;
use lbuchs\WebAuthn\WebAuthnException;

const PASSKEY_CHALLENGE_TTL = 300;
const PASSKEY_LOGIN_MAX_FAILURES = 10;
const PASSKEY_LOGIN_FAILURE_WINDOW = 300;

function b64url_encode(string $bin): string {
    return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
}

function b64url_decode(string $s): string {
    $pad = strlen($s) % 4;
    if ($pad) $s .= str_repeat('=', 4 - $pad);
    return base64_decode(strtr($s, '-_', '+/'));
}

function webauthn_rp_context(array $cfg): array {
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $host_only = preg_replace('/:\d+$/', '', $host);
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $is_localhost = $host_only === 'localhost' || str_ends_with($host_only, '.localhost') || $host_only === '127.0.0.1';
    if ($scheme !== 'https' && !$is_localhost) {
        json_error('Passkeys require HTTPS.', 400);
    }
    return [
        'rp_id'   => $host_only,
        'rp_name' => $cfg['theme']['site_name'] ?? 'Elements CMS',
    ];
}

function webauthn_new(array $cfg): WebAuthn {
    $ctx = webauthn_rp_context($cfg);
    return new WebAuthn($ctx['rp_name'], $ctx['rp_id'], ['none'], true);
}

function passkey_ensure_user_handle(array &$cfg, string $username): string {
    if (empty($cfg['users'][$username]['user_handle'])) {
        $cfg['users'][$username]['user_handle'] = b64url_encode(random_bytes(32));
    }
    if (!isset($cfg['users'][$username]['passkeys']) || !is_array($cfg['users'][$username]['passkeys'])) {
        $cfg['users'][$username]['passkeys'] = [];
    }
    return $cfg['users'][$username]['user_handle'];
}

function passkey_find_by_credential_id(array $cfg, string $credential_id_b64url): ?array {
    foreach ($cfg['users'] as $username => $u) {
        foreach (($u['passkeys'] ?? []) as $idx => $pk) {
            if (hash_equals($pk['id'], $credential_id_b64url)) {
                return ['username' => $username, 'index' => $idx, 'passkey' => $pk];
            }
        }
    }
    return null;
}

function passkey_public_summary(array $pk): array {
    return [
        'id'            => $pk['id'],
        'name'          => $pk['name'],
        'created_at'    => (int) ($pk['created_at'] ?? 0),
        'last_used_at'  => (int) ($pk['last_used_at'] ?? 0),
        'transports'    => $pk['transports'] ?? [],
    ];
}

// ---------------------------------------------------------------------------
// Registration (authenticated)
// ---------------------------------------------------------------------------

function handle_passkey_register_options(array $cfg, array $license): never {
    require_post();
    verify_csrf();

    $username = current_user();
    if (!isset($cfg['users'][$username])) {
        json_error('User not found.', 404);
    }

    $user_handle = passkey_ensure_user_handle($cfg, $username);

    $exclude_ids = [];
    foreach ($cfg['users'][$username]['passkeys'] as $pk) {
        $exclude_ids[] = b64url_decode($pk['id']);
    }

    try {
        $wa = webauthn_new($cfg);
        $args = $wa->getCreateArgs(
            b64url_decode($user_handle),
            $username,
            $username,
            60,
            'required',
            'preferred',
            null,
            $exclude_ids
        );
    } catch (WebAuthnException $e) {
        json_error('Passkey setup failed: ' . $e->getMessage(), 500);
    }

    $_SESSION['webauthn_reg_challenge'] = b64url_encode($wa->getChallenge()->getBinaryString());
    $_SESSION['webauthn_reg_challenge_at'] = time();

    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }

    json_response($args);
}

function handle_passkey_register_verify(array $cfg, array $license): never {
    require_post();
    verify_csrf();

    $username = current_user();
    if (!isset($cfg['users'][$username])) {
        json_error('User not found.', 404);
    }

    $input = get_json_body();
    $credential = $input['credential'] ?? null;
    $name = trim((string) ($input['name'] ?? ''));
    if ($name === '') $name = 'Passkey';
    if (mb_strlen($name) > 40) $name = mb_substr($name, 0, 40);

    $challenge_b64 = $_SESSION['webauthn_reg_challenge'] ?? '';
    $challenge_at = (int) ($_SESSION['webauthn_reg_challenge_at'] ?? 0);
    unset($_SESSION['webauthn_reg_challenge'], $_SESSION['webauthn_reg_challenge_at']);

    if ($challenge_b64 === '' || (time() - $challenge_at) > PASSKEY_CHALLENGE_TTL) {
        json_error('Registration challenge expired. Please try again.', 400);
    }

    if (!is_array($credential) || empty($credential['response']['clientDataJSON']) || empty($credential['response']['attestationObject'])) {
        json_error('Invalid credential payload.', 400);
    }

    try {
        $wa = webauthn_new($cfg);
        $result = $wa->processCreate(
            b64url_decode($credential['response']['clientDataJSON']),
            b64url_decode($credential['response']['attestationObject']),
            b64url_decode($challenge_b64),
            false,
            true,
            false
        );
    } catch (WebAuthnException $e) {
        json_error('Passkey registration failed.', 400);
    }

    $credential_id_b64 = b64url_encode($result->credentialId);
    $aaguid_b64 = !empty($result->AAGUID) ? b64url_encode($result->AAGUID) : '';

    foreach ($cfg['users'][$username]['passkeys'] as $existing) {
        if (hash_equals($existing['id'], $credential_id_b64)) {
            json_error('This passkey is already registered.', 400);
        }
    }

    $transports = [];
    if (isset($credential['response']['transports']) && is_array($credential['response']['transports'])) {
        foreach ($credential['response']['transports'] as $t) {
            if (is_string($t)) $transports[] = $t;
        }
    }

    $now = time();
    $new_passkey = [
        'id'            => $credential_id_b64,
        'public_key'    => $result->credentialPublicKey,
        'counter'       => (int) ($result->signatureCounter ?? 0),
        'transports'    => $transports,
        'name'          => $name,
        'created_at'    => $now,
        'last_used_at'  => $now,
        'aaguid'        => $aaguid_b64,
    ];

    $cfg['users'][$username]['passkeys'][] = $new_passkey;

    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }

    json_response([
        'ok'      => true,
        'passkey' => passkey_public_summary($new_passkey),
    ]);
}

// ---------------------------------------------------------------------------
// Login (public)
// ---------------------------------------------------------------------------

function handle_passkey_login_options(): never {
    require_post();

    $cfg = load_config();
    start_session($cfg);
    webauthn_rp_context($cfg); // validates scheme/host, errors out on plain http non-localhost

    try {
        $wa = webauthn_new($cfg);
        $args = $wa->getGetArgs([], 60, true, true, true, true, true, 'preferred');
    } catch (WebAuthnException $e) {
        json_error('Passkey sign-in unavailable.', 500);
    }

    $_SESSION['webauthn_login_challenge'] = b64url_encode($wa->getChallenge()->getBinaryString());
    $_SESSION['webauthn_login_challenge_at'] = time();

    json_response($args);
}

function handle_passkey_login_verify(): never {
    require_post();

    $cfg = load_config();
    start_session($cfg);
    webauthn_rp_context($cfg);

    // Per-session rolling rate limit
    $attempts = $_SESSION['webauthn_login_attempts'] ?? [];
    $cutoff = time() - PASSKEY_LOGIN_FAILURE_WINDOW;
    $attempts = array_values(array_filter($attempts, fn($t) => $t > $cutoff));
    if (count($attempts) >= PASSKEY_LOGIN_MAX_FAILURES) {
        $_SESSION['webauthn_login_attempts'] = $attempts;
        json_error('Too many failed attempts. Please try again later.', 429);
    }

    $input = get_json_body();
    $credential = $input['credential'] ?? null;
    $remember = !empty($input['remember']);

    $challenge_b64 = $_SESSION['webauthn_login_challenge'] ?? '';
    $challenge_at = (int) ($_SESSION['webauthn_login_challenge_at'] ?? 0);
    unset($_SESSION['webauthn_login_challenge'], $_SESSION['webauthn_login_challenge_at']);

    $fail = function (string $log_reason) use (&$attempts) {
        $attempts[] = time();
        $_SESSION['webauthn_login_attempts'] = $attempts;
        json_error('Passkey not recognised.', 401);
    };

    if ($challenge_b64 === '' || (time() - $challenge_at) > PASSKEY_CHALLENGE_TTL) {
        $fail('challenge_expired');
    }

    if (!is_array($credential) || empty($credential['id']) || empty($credential['response']['clientDataJSON']) || empty($credential['response']['authenticatorData']) || empty($credential['response']['signature'])) {
        $fail('missing_fields');
    }

    $found = passkey_find_by_credential_id($cfg, $credential['id']);
    if ($found === null) {
        $fail('unknown_credential');
    }

    try {
        $wa = webauthn_new($cfg);
        $wa->processGet(
            b64url_decode($credential['response']['clientDataJSON']),
            b64url_decode($credential['response']['authenticatorData']),
            b64url_decode($credential['response']['signature']),
            $found['passkey']['public_key'],
            b64url_decode($challenge_b64),
            (int) ($found['passkey']['counter'] ?? 0) ?: null,
            false,
            true
        );
    } catch (WebAuthnException $e) {
        $fail('verify_failed');
    }

    $new_counter = $wa->getSignatureCounter();
    $now = time();

    $username = $found['username'];
    $cfg['users'][$username]['passkeys'][$found['index']]['last_used_at'] = $now;
    if ($new_counter !== null) {
        $cfg['users'][$username]['passkeys'][$found['index']]['counter'] = (int) $new_counter;
    }

    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }

    unset($_SESSION['webauthn_login_attempts']);
    $_SESSION['logged_in'] = true;
    $_SESSION['username'] = $username;
    $_SESSION['role'] = $cfg['users'][$username]['role'];
    $_SESSION['session_version'] = (int) ($cfg['users'][$username]['session_version'] ?? 0);
    $_SESSION['csrf'] = bin2hex(random_bytes(16));

    require_once __DIR__ . '/auth.php';
    apply_remember_me($remember);

    require_once __DIR__ . '/../license-check.php';
    $license = get_license_state();

    json_response([
        'user' => [
            'email'    => $username,
            'role'     => $cfg['users'][$username]['role'],
            'language' => $cfg['users'][$username]['language'] ?? $cfg['language'] ?? 'en',
        ],
        'csrf'    => $_SESSION['csrf'],
        'config'  => client_config($cfg, $license),
        'license' => $license,
    ]);
}

// ---------------------------------------------------------------------------
// Management (authenticated)
// ---------------------------------------------------------------------------

function handle_passkey_list(array $cfg, array $license): never {
    $username = current_user();
    $passkeys = array_map('passkey_public_summary', $cfg['users'][$username]['passkeys'] ?? []);
    json_response(['passkeys' => array_values($passkeys)]);
}

function handle_passkey_rename(array $cfg, array $license): never {
    require_post();
    verify_csrf();

    $input = get_json_body();
    $id = (string) ($input['id'] ?? '');
    $name = trim((string) ($input['name'] ?? ''));
    if ($name === '') json_error('Name is required.');
    if (mb_strlen($name) > 40) $name = mb_substr($name, 0, 40);

    $username = current_user();
    $passkeys = $cfg['users'][$username]['passkeys'] ?? [];
    $found = false;
    foreach ($passkeys as $i => $pk) {
        if (hash_equals($pk['id'], $id)) {
            $cfg['users'][$username]['passkeys'][$i]['name'] = $name;
            $found = true;
            break;
        }
    }
    if (!$found) json_error('Passkey not found.', 404);

    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }

    json_ok('Passkey renamed.');
}

function handle_passkey_delete(array $cfg, array $license): never {
    require_post();
    verify_csrf();

    $input = get_json_body();
    $id = (string) ($input['id'] ?? '');

    $username = current_user();
    $passkeys = $cfg['users'][$username]['passkeys'] ?? [];
    $kept = [];
    $found = false;
    foreach ($passkeys as $pk) {
        if (hash_equals($pk['id'], $id)) {
            $found = true;
            continue;
        }
        $kept[] = $pk;
    }
    if (!$found) json_error('Passkey not found.', 404);

    $cfg['users'][$username]['passkeys'] = $kept;

    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }

    json_ok('Passkey removed.');
}
