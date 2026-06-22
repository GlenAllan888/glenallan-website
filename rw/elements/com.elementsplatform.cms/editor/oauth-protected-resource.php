<?php

// ---------------------------------------------------------------------------
// RFC 9728 OAuth 2.0 Protected Resource Metadata for the MCP endpoint.
// ---------------------------------------------------------------------------
// Tells DCR-aware MCP clients (notably Claude.ai's hosted custom connector)
// where the authorization server lives. On unlicensed installs the
// `authorization_servers` field is omitted so the discovery chain dead-ends
// here — no DCR row is ever created.

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: public, max-age=300');

$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
$self   = strtok($_SERVER['REQUEST_URI'] ?? '/', '?');
$base   = rtrim(dirname($self), '/');
// dirname() of /…/editor/.well-known/oauth-protected-resource is /…/editor/.well-known.
if (substr($base, -strlen('/.well-known')) === '/.well-known') {
    $base = substr($base, 0, -strlen('/.well-known'));
}
$origin   = $scheme . '://' . $host . $base;
$resource = $origin . '/mcp.php';

$payload = [
    'resource'                 => $resource,
    'bearer_methods_supported' => ['header'],
];

// --- Inlined paid-feature gate (mcp_tokens flag) ---------------------------
// Same Ed25519 verify pattern as php/mcp/server.php:112–139. Only adds the
// `authorization_servers` field when the install is licensed for MCP.
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
if (is_array($_lic_entry['limits'] ?? null) && !empty($_lic_entry['limits']['mcp_tokens'])) {
    $payload['authorization_servers'] = [$origin];
}
// --- end inlined gate ------------------------------------------------------

echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
