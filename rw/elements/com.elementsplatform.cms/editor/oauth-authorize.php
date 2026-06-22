<?php

// ---------------------------------------------------------------------------
// OAuth 2.1 authorization endpoint (browser-facing).
// ---------------------------------------------------------------------------
// GET  → render consent page (or inline login form if user isn't signed in).
// POST → submit login (action=login) or consent (action=approve|deny).
//
// On approval we mint a single-use auth code bound to the requested PKCE
// challenge + redirect URI and 302 the browser back to the client's
// redirect URI with `code` and `state`.

header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

require __DIR__ . '/php/helpers.php';
require __DIR__ . '/php/oauth/storage.php';
require __DIR__ . '/php/oauth/issue.php';

if (!config_exists()) {
    http_response_code(503);
    oauth_authorize_render_error('Server not configured', 'This Elements CMS install has not finished setup.');
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
    oauth_authorize_render_error(
        'MCP access not licensed',
        'This Elements CMS install is not licensed for MCP access. Contact the site owner to upgrade.'
    );
}
// --- end inlined gate ------------------------------------------------------

start_session($cfg);

// Authorize-request parameters carry through every step (login, consent
// submit, redirect). We accept them on either GET (initial) or POST (resubmit).
$src = $_SERVER['REQUEST_METHOD'] === 'POST' ? $_POST : $_GET;
$params = [
    'response_type'         => trim((string) ($src['response_type'] ?? '')),
    'client_id'             => trim((string) ($src['client_id'] ?? '')),
    'redirect_uri'          => trim((string) ($src['redirect_uri'] ?? '')),
    'state'                 => (string) ($src['state'] ?? ''),
    'code_challenge'        => trim((string) ($src['code_challenge'] ?? '')),
    'code_challenge_method' => trim((string) ($src['code_challenge_method'] ?? '')),
    'scope'                 => trim((string) ($src['scope'] ?? 'mcp')),
];

// --- Validate parameters before doing anything user-visible ----------------

if ($params['response_type'] !== 'code') {
    oauth_authorize_render_error('Unsupported response type', 'Only response_type=code is supported.');
}
if ($params['code_challenge'] === '' || $params['code_challenge_method'] !== 'S256') {
    oauth_authorize_render_error(
        'PKCE required',
        'PKCE with code_challenge_method=S256 is required for all clients.'
    );
}
$client = oauth_client_find($cfg, $params['client_id']);
if ($client === null) {
    oauth_authorize_render_error('Unknown client', 'No client is registered with that client_id.');
}
if ($params['redirect_uri'] === '' || !in_array($params['redirect_uri'], $client['redirect_uris'] ?? [], true)) {
    oauth_authorize_render_error(
        'Invalid redirect URI',
        'The supplied redirect_uri does not match any URI registered for this client.'
    );
}

// --- POST handlers ---------------------------------------------------------

$action = $_SERVER['REQUEST_METHOD'] === 'POST' ? (string) ($_POST['oauth_action'] ?? '') : '';

if ($action === 'login') {
    oauth_authorize_handle_login($cfg, $params);
}
if ($action === 'approve' || $action === 'deny') {
    if (!is_logged_in()) {
        // Session lapsed between page load and submit — start over with a
        // login form.
        oauth_authorize_render_login($cfg, $params, 'Your session expired. Please sign in again.');
    }
    oauth_authorize_check_csrf();
    if ($action === 'deny') {
        oauth_authorize_redirect_with_error($params, 'access_denied', 'User denied authorization.');
    }
    oauth_authorize_redirect_with_code($cfg, $params, current_user());
}

// --- GET (or POST without a known action) ----------------------------------

if (!is_logged_in()) {
    oauth_authorize_render_login($cfg, $params);
}
oauth_authorize_render_consent($cfg, $client, $params);


// ---------------------------------------------------------------------------
// Login submit
// ---------------------------------------------------------------------------

function oauth_authorize_handle_login(array $cfg, array $params): never {
    oauth_authorize_check_csrf();

    $email = strtolower(trim((string) ($_POST['email'] ?? '')));
    $password = (string) ($_POST['password'] ?? '');

    if (
        !isset($cfg['users'][$email]) ||
        !password_verify($password, $cfg['users'][$email]['password_hash'])
    ) {
        oauth_authorize_render_login($cfg, $params, 'Invalid email or password.');
    }

    require_once __DIR__ . '/php/license-check.php';
    $license = get_license_state();

    // Free-tier clamp: only the surviving (first owner) user can sign in
    // when unlicensed. We've already gated the endpoint on a valid license,
    // but defence in depth is cheap.
    if (empty($license['valid']) && $email !== surviving_user($cfg)) {
        oauth_authorize_render_login(
            $cfg,
            $params,
            'Additional users are disabled on the free plan. Contact the site owner.'
        );
    }

    $_SESSION['logged_in']       = true;
    $_SESSION['username']        = $email;
    $_SESSION['role']            = $cfg['users'][$email]['role'];
    $_SESSION['session_version'] = (int) ($cfg['users'][$email]['session_version'] ?? 0);
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
    }

    $client = oauth_client_find($cfg, $params['client_id']);
    oauth_authorize_render_consent($cfg, $client, $params);
}

// ---------------------------------------------------------------------------
// Approve → mint code and redirect
// ---------------------------------------------------------------------------

function oauth_authorize_redirect_with_code(array $cfg, array $params, string $username): never {
    $code = oauth_issue_auth_code(
        $cfg,
        $params['client_id'],
        $username,
        $params['redirect_uri'],
        $params['code_challenge'],
        $params['scope']
    );
    oauth_client_touch($cfg, $params['client_id']);

    $sep = str_contains($params['redirect_uri'], '?') ? '&' : '?';
    $url = $params['redirect_uri'] . $sep . 'code=' . rawurlencode($code);
    if ($params['state'] !== '') {
        $url .= '&state=' . rawurlencode($params['state']);
    }
    header('Location: ' . $url, true, 302);
    exit;
}

function oauth_authorize_redirect_with_error(array $params, string $error, string $description): never {
    if ($params['redirect_uri'] === '') {
        oauth_authorize_render_error('Authorization failed', $description);
    }
    $sep = str_contains($params['redirect_uri'], '?') ? '&' : '?';
    $url = $params['redirect_uri'] . $sep . 'error=' . rawurlencode($error)
         . '&error_description=' . rawurlencode($description);
    if ($params['state'] !== '') {
        $url .= '&state=' . rawurlencode($params['state']);
    }
    header('Location: ' . $url, true, 302);
    exit;
}

// ---------------------------------------------------------------------------
// CSRF
// ---------------------------------------------------------------------------

function oauth_authorize_csrf_token(): string {
    if (empty($_SESSION['oauth_authorize_csrf'])) {
        $_SESSION['oauth_authorize_csrf'] = bin2hex(random_bytes(16));
    }
    return $_SESSION['oauth_authorize_csrf'];
}

function oauth_authorize_check_csrf(): void {
    $token = (string) ($_POST['csrf'] ?? '');
    $stored = (string) ($_SESSION['oauth_authorize_csrf'] ?? '');
    if ($token === '' || $stored === '' || !hash_equals($stored, $token)) {
        http_response_code(403);
        oauth_authorize_render_error('Invalid request', 'CSRF token mismatch. Please reload and try again.');
    }
}

// ---------------------------------------------------------------------------
// Page rendering — small inline-styled HTML, no SPA shell.
// ---------------------------------------------------------------------------

function oauth_authorize_render_error(string $title, string $message): never {
    if (http_response_code() === 200) http_response_code(400);
    oauth_authorize_render_page($title, '
        <h1>' . h($title) . '</h1>
        <p class="message">' . h($message) . '</p>
    ');
}

function oauth_authorize_render_login(array $cfg, array $params, string $error = ''): never {
    $site = h($cfg['theme']['site_name'] ?? 'Elements CMS');
    $csrf = h(oauth_authorize_csrf_token());
    $hidden = oauth_authorize_hidden_inputs($params);
    $error_html = $error === '' ? '' : '<p class="error">' . h($error) . '</p>';

    oauth_authorize_render_page('Sign in to ' . $site, '
        <h1>Sign in to ' . $site . '</h1>
        <p class="message">Sign in to authorize access for the requesting application.</p>
        ' . $error_html . '
        <form method="POST" action="" autocomplete="off">
            <input type="hidden" name="oauth_action" value="login">
            <input type="hidden" name="csrf" value="' . $csrf . '">
            ' . $hidden . '
            <label>Email
                <input type="email" name="email" required autofocus>
            </label>
            <label>Password
                <input type="password" name="password" required>
            </label>
            <button type="submit" class="primary">Sign in</button>
        </form>
    ');
}

function oauth_authorize_render_consent(array $cfg, array $client, array $params): never {
    $site = h($cfg['theme']['site_name'] ?? 'Elements CMS');
    $username = h(current_user());
    $client_name = h($client['client_name'] ?? '') ?: 'a third-party application';
    $csrf = h(oauth_authorize_csrf_token());
    $hidden = oauth_authorize_hidden_inputs($params);
    $redirect_host = h(parse_url($params['redirect_uri'], PHP_URL_HOST) ?? '');

    oauth_authorize_render_page('Authorize access', '
        <h1>Authorize access</h1>
        <p class="message">
            <strong>' . $client_name . '</strong> wants to connect to <strong>' . $site . '</strong>
            and act on your behalf as <code>' . $username . '</code>.
        </p>
        <p class="message subtle">
            It will be redirected back to <code>' . $redirect_host . '</code> after you decide.
        </p>
        <ul class="scopes">
            <li>Read and edit content, resources, and settings you have access to</li>
            <li>Use this access for up to 30 days unless revoked</li>
        </ul>
        <form method="POST" action="" class="consent">
            <input type="hidden" name="csrf" value="' . $csrf . '">
            ' . $hidden . '
            <button type="submit" name="oauth_action" value="approve" class="primary">Allow</button>
            <button type="submit" name="oauth_action" value="deny" class="secondary">Deny</button>
        </form>
    ');
}

function oauth_authorize_hidden_inputs(array $params): string {
    $html = '';
    foreach ($params as $k => $v) {
        $html .= '<input type="hidden" name="' . h($k) . '" value="' . h((string) $v) . '">';
    }
    return $html;
}

function oauth_authorize_render_page(string $title, string $body): never {
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>' . h($title) . '</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    background: #f5f5f4;
    color: #1c1917;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .card {
    background: #fff;
    border: 1px solid #e7e5e4;
    border-radius: 12px;
    padding: 32px;
    max-width: 440px;
    width: 100%;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  h1 { font-size: 18px; font-weight: 600; margin: 0 0 12px; }
  .message { font-size: 14px; line-height: 1.5; color: #44403c; margin: 0 0 12px; }
  .message.subtle { color: #78716c; font-size: 13px; }
  .error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #991b1b;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 13px;
    margin: 12px 0;
  }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; background: #f5f5f4; padding: 1px 4px; border-radius: 4px; }
  ul.scopes {
    background: #fafaf9;
    border: 1px solid #e7e5e4;
    border-radius: 8px;
    padding: 12px 16px 12px 32px;
    font-size: 13px;
    color: #44403c;
    margin: 16px 0 24px;
  }
  ul.scopes li { margin: 4px 0; }
  form { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
  form.consent { flex-direction: row; gap: 8px; }
  label { font-size: 13px; font-weight: 500; display: flex; flex-direction: column; gap: 6px; }
  input[type="email"], input[type="password"] {
    font: inherit;
    font-size: 14px;
    padding: 8px 10px;
    border: 1px solid #d6d3d1;
    border-radius: 8px;
    background: #fff;
  }
  input:focus { outline: 2px solid #a78bfa; outline-offset: -1px; border-color: #a78bfa; }
  button {
    font: inherit;
    font-size: 14px;
    font-weight: 500;
    padding: 10px 16px;
    border-radius: 8px;
    border: 1px solid transparent;
    cursor: pointer;
  }
  button.primary { background: #7c3aed; color: #fff; }
  button.primary:hover { background: #6d28d9; }
  button.secondary { background: #fff; color: #44403c; border-color: #d6d3d1; }
  button.secondary:hover { background: #f5f5f4; }
  form.consent button { flex: 1; }
</style>
</head>
<body>
  <div class="card">' . $body . '</div>
</body>
</html>';
    exit;
}
