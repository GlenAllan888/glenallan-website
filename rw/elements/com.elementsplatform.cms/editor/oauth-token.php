<?php

// ---------------------------------------------------------------------------
// OAuth 2.1 token endpoint.
// ---------------------------------------------------------------------------
// Two grant types:
//   authorization_code → exchange code + PKCE verifier for access + refresh
//   refresh_token      → rotate refresh, issue new access
//
// Tokens are bound to the user that approved the consent screen. Refresh
// tokens are single-use (rotated on each call); the previous one is
// invalidated as soon as it's consumed.

header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
header('Pragma: no-cache');
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require __DIR__ . '/php/helpers.php';
require __DIR__ . '/php/oauth/storage.php';
require __DIR__ . '/php/oauth/issue.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'invalid_request', 'error_description' => 'Method not allowed.']);
    exit;
}

if (!config_exists()) {
    http_response_code(503);
    echo json_encode(['error' => 'server_error', 'error_description' => 'CMS install is not configured.']);
    exit;
}
$cfg = require config_path();

// --- Inlined paid-feature gate (mcp_tokens flag) ---------------------------
$_lic_path = __DIR__ . '/php/.elements_license_state.json';
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
if (!is_array($_lic_entry['limits'] ?? null) || empty($_lic_entry['limits']['mcp_tokens'])) {
    http_response_code(403);
    echo json_encode([
        'error'             => 'invalid_client',
        'error_description' => 'License invalid.',
    ]);
    exit;
}
// --- end inlined gate ------------------------------------------------------

// Token-endpoint requests are application/x-www-form-urlencoded by the
// OAuth spec, so $_POST is the right source.
$grant_type = (string) ($_POST['grant_type'] ?? '');
$client_id  = (string) ($_POST['client_id']  ?? '');

if ($client_id === '' || oauth_client_find($cfg, $client_id) === null) {
    http_response_code(401);
    echo json_encode(['error' => 'invalid_client', 'error_description' => 'Unknown or unregistered client_id.']);
    exit;
}

if ($grant_type === 'authorization_code') {
    $code          = (string) ($_POST['code']          ?? '');
    $redirect_uri  = (string) ($_POST['redirect_uri']  ?? '');
    $code_verifier = (string) ($_POST['code_verifier'] ?? '');

    if ($code === '' || $code_verifier === '' || $redirect_uri === '') {
        http_response_code(400);
        echo json_encode(['error' => 'invalid_request', 'error_description' => 'Missing required parameters.']);
        exit;
    }

    // Single-use: consume removes the row regardless of caller success.
    $row = oauth_auth_code_consume($cfg, $code);
    if ($row === null) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid_grant', 'error_description' => 'Invalid or expired authorization code.']);
        exit;
    }
    if ((int) ($row['expires_at'] ?? 0) <= time()) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid_grant', 'error_description' => 'Authorization code expired.']);
        exit;
    }
    if (($row['client_id'] ?? '') !== $client_id) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid_grant', 'error_description' => 'Code was issued to a different client.']);
        exit;
    }
    if (($row['redirect_uri'] ?? '') !== $redirect_uri) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid_grant', 'error_description' => 'redirect_uri mismatch.']);
        exit;
    }
    if (!oauth_verify_pkce_s256($code_verifier, (string) ($row['code_challenge'] ?? ''))) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid_grant', 'error_description' => 'PKCE verification failed.']);
        exit;
    }

    $username = (string) ($row['username'] ?? '');
    $scope    = (string) ($row['scope']    ?? 'mcp');

    if ($username === '' || !isset($cfg['users'][$username])) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid_grant', 'error_description' => 'Token user no longer exists.']);
        exit;
    }

    $access  = oauth_issue_access_token($cfg, $client_id, $username, $scope);
    $refresh = oauth_issue_refresh_token($cfg, $client_id, $username, $scope);

    echo json_encode([
        'access_token'  => $access['plaintext'],
        'token_type'    => 'Bearer',
        'expires_in'    => $access['expires_in'],
        'refresh_token' => $refresh,
        'scope'         => $scope,
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

if ($grant_type === 'refresh_token') {
    $plaintext = (string) ($_POST['refresh_token'] ?? '');
    if ($plaintext === '') {
        http_response_code(400);
        echo json_encode(['error' => 'invalid_request', 'error_description' => 'refresh_token is required.']);
        exit;
    }

    $row = oauth_refresh_token_consume($cfg, $plaintext);
    if ($row === null) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid_grant', 'error_description' => 'Invalid or expired refresh token.']);
        exit;
    }
    if (($row['client_id'] ?? '') !== $client_id) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid_grant', 'error_description' => 'Refresh token was issued to a different client.']);
        exit;
    }

    $username = (string) ($row['username'] ?? '');
    $scope    = (string) ($row['scope']    ?? 'mcp');

    if ($username === '' || !isset($cfg['users'][$username])) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid_grant', 'error_description' => 'Token user no longer exists.']);
        exit;
    }

    $access  = oauth_issue_access_token($cfg, $client_id, $username, $scope);
    $refresh = oauth_issue_refresh_token($cfg, $client_id, $username, $scope);

    echo json_encode([
        'access_token'  => $access['plaintext'],
        'token_type'    => 'Bearer',
        'expires_in'    => $access['expires_in'],
        'refresh_token' => $refresh,
        'scope'         => $scope,
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

http_response_code(400);
echo json_encode([
    'error'             => 'unsupported_grant_type',
    'error_description' => 'grant_type must be authorization_code or refresh_token.',
]);
