<?php

// ---------------------------------------------------------------------------
// RFC 7591 OAuth 2.0 Dynamic Client Registration
// ---------------------------------------------------------------------------
// POST a JSON metadata document, get back a client_id. No client_secret —
// these are public clients using PKCE. Unauthenticated by design (per the
// spec) but rate-limited per IP.

header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
header('Content-Type: application/json');
// Permissive CORS — DCR is meant to be cross-origin.
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require __DIR__ . '/php/helpers.php';
require __DIR__ . '/php/oauth/storage.php';

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
        'error'             => 'unsupported',
        'error_description' => 'This install is not licensed for MCP access.',
    ]);
    exit;
}
// --- end inlined gate ------------------------------------------------------

$ip = $_SERVER['REMOTE_ADDR'] ?? '';
if ($ip !== '' && oauth_register_rate_limited($cfg, $ip)) {
    http_response_code(429);
    echo json_encode([
        'error'             => 'invalid_request',
        'error_description' => 'Too many registration attempts. Try again later.',
    ]);
    exit;
}

$raw = file_get_contents('php://input');
$body = $raw === false ? null : json_decode($raw, true);
if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_client_metadata', 'error_description' => 'Body must be JSON.']);
    exit;
}

$redirect_uris = $body['redirect_uris'] ?? null;
if (!is_array($redirect_uris) || empty($redirect_uris)) {
    http_response_code(400);
    echo json_encode([
        'error'             => 'invalid_redirect_uri',
        'error_description' => 'redirect_uris is required and must be a non-empty array.',
    ]);
    exit;
}
foreach ($redirect_uris as $uri) {
    if (!is_string($uri) || $uri === '') {
        http_response_code(400);
        echo json_encode([
            'error'             => 'invalid_redirect_uri',
            'error_description' => 'redirect_uris must be a non-empty array of strings.',
        ]);
        exit;
    }
    $parts = parse_url($uri);
    if (!is_array($parts) || !isset($parts['scheme'], $parts['host'])) {
        http_response_code(400);
        echo json_encode([
            'error'             => 'invalid_redirect_uri',
            'error_description' => 'redirect_uris must be absolute URLs.',
        ]);
        exit;
    }
    $is_localhost = in_array(strtolower($parts['host']), ['localhost', '127.0.0.1', '::1'], true);
    if ($parts['scheme'] !== 'https' && !($parts['scheme'] === 'http' && $is_localhost)) {
        http_response_code(400);
        echo json_encode([
            'error'             => 'invalid_redirect_uri',
            'error_description' => 'redirect_uris must use https (or http for localhost only).',
        ]);
        exit;
    }
}

$client_name = '';
if (isset($body['client_name']) && is_string($body['client_name'])) {
    $client_name = mb_substr(trim($body['client_name']), 0, 200);
}

$auth_method = $body['token_endpoint_auth_method'] ?? 'none';
if ($auth_method !== 'none') {
    http_response_code(400);
    echo json_encode([
        'error'             => 'invalid_client_metadata',
        'error_description' => 'Only token_endpoint_auth_method "none" (public clients with PKCE) is supported.',
    ]);
    exit;
}

$client = oauth_client_create($cfg, [
    'client_name'   => $client_name,
    'redirect_uris' => array_values($redirect_uris),
]);

http_response_code(201);
echo json_encode([
    'client_id'                  => $client['client_id'],
    'client_id_issued_at'        => $client['registered_at'],
    'redirect_uris'              => $client['redirect_uris'],
    'client_name'                => $client['client_name'],
    'token_endpoint_auth_method' => 'none',
    'grant_types'                => $client['grant_types'],
    'response_types'             => $client['response_types'],
], JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
