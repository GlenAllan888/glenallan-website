<?php

// ---------------------------------------------------------------------------
// RFC 8414 OAuth 2.0 Authorization Server Metadata
// ---------------------------------------------------------------------------
// Advertises this install as a DCR-aware OAuth 2.1 authorization server so
// Claude.ai's hosted custom-connector flow can discover the endpoints,
// register a client dynamically, and run a code/PKCE exchange.
//
// Unlicensed installs return 404 — the discovery chain dead-ends here so
// no DCR row is ever created and no consent screen is ever rendered.

// --- Inlined paid-feature gate (mcp_tokens flag) ---------------------------
// Same canonical-JSON Ed25519 verify as php/mcp/server.php:112–139. NOT
// factored into a shared helper; matches the project's existing pattern.
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
    http_response_code(404);
    exit;
}
// --- end inlined gate ------------------------------------------------------

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: public, max-age=300');

$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
$self   = strtok($_SERVER['REQUEST_URI'] ?? '/', '?');
$base   = rtrim(dirname($self), '/');
// dirname() of /…/editor/.well-known/oauth-authorization-server is /…/editor/.well-known.
if (substr($base, -strlen('/.well-known')) === '/.well-known') {
    $base = substr($base, 0, -strlen('/.well-known'));
}
$origin = $scheme . '://' . $host . $base;

echo json_encode([
    'issuer'                                    => $origin,
    'authorization_endpoint'                    => $origin . '/oauth/authorize',
    'token_endpoint'                            => $origin . '/oauth/token',
    'registration_endpoint'                     => $origin . '/oauth/register',
    'response_types_supported'                  => ['code'],
    'grant_types_supported'                     => ['authorization_code', 'refresh_token'],
    'code_challenge_methods_supported'          => ['S256'],
    'token_endpoint_auth_methods_supported'     => ['none'],
    'scopes_supported'                          => ['mcp'],
], JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
