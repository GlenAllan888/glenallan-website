<?php

// ---------------------------------------------------------------------------
// Elements CMS — MCP bundle (.mcpb) download endpoint
// ---------------------------------------------------------------------------
// Mints a fresh `mcp_…` bearer token, rewrites the placeholders inside the
// pre-built template archive, and streams a per-site Claude Desktop install
// bundle. Owner-only, CSRF-gated, license-gated, rate-limited.
//
// The endpoint hands out a live bearer token: it must be at least as well
// protected as token creation in php/handlers/api-tokens.php. See the plan
// for the threat model (CSRF from another origin, stolen session abusing
// the endpoint to fan out tokens, etc.). Order of checks below is load-
// bearing; do not reorder without re-thinking through that model.

header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, private');
header('Pragma: no-cache');
header('Referrer-Policy: same-origin');

require __DIR__ . '/php/helpers.php';
require_once __DIR__ . '/php/license-check.php';
require_once __DIR__ . '/php/mcp/tokens.php';

// --- Method ----------------------------------------------------------------

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    header('Allow: POST');
    json_error('Method not allowed.', 405);
}

// --- Same-origin pinning (CSRF defence in depth) ---------------------------
//
// verify_csrf() below is the primary control — but the token bound to a
// stolen session would still grant access if the SPA's CSRF cookie also
// leaked. Pinning Origin/Referer to the editor's own host means a
// cross-site form submit can't reach this endpoint even if every other
// control fails open.

$self_host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
$origin    = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
$referer   = (string) ($_SERVER['HTTP_REFERER'] ?? '');

$origin_host = '';
if ($origin !== '') {
    $parts = parse_url($origin);
    $origin_host = strtolower((string) ($parts['host'] ?? ''));
} elseif ($referer !== '') {
    $parts = parse_url($referer);
    $origin_host = strtolower((string) ($parts['host'] ?? ''));
}

if ($self_host === '' || $origin_host === '' || $origin_host !== $self_host) {
    json_error('Cross-origin request rejected.', 403);
}

// --- Bootstrap session + auth ---------------------------------------------

if (!config_exists()) {
    json_error('CMS install is not configured.', 503);
}
$cfg = require config_path();
start_session($cfg);

require_login();
require_owner();
verify_csrf();

// --- License gate ----------------------------------------------------------

mcp_tokens_require_license();

// --- Rate limit (per-session sliding window) ------------------------------
//
// Cap successful bundle downloads at 5 per 5 minutes per session. Limits
// damage from a stolen owner session and from accidental click-storms.
// Counted only once we've passed every other check — a request that
// failed validation should not consume budget.

const MCP_BUNDLE_RATE_WINDOW   = 300;
const MCP_BUNDLE_RATE_MAX      = 5;

$now = time();
$bucket = $_SESSION['mcp_bundle_downloads'] ?? [];
$bucket = array_values(array_filter($bucket, fn($t) => is_int($t) && ($now - $t) <= MCP_BUNDLE_RATE_WINDOW));
if (count($bucket) >= MCP_BUNDLE_RATE_MAX) {
    json_error('Too many bundle downloads. Try again in a few minutes.', 429);
}

// --- Input validation ------------------------------------------------------

$input = get_json_body();
$name = trim((string) ($input['name'] ?? ''));
$username = strtolower(trim((string) ($input['username'] ?? current_user())));

if ($name === '') {
    $name = sprintf('Claude Desktop (%s)', date('Y-m-d'));
}
if (mb_strlen($name) > 80) {
    json_error('Bundle name is too long (max 80 characters).');
}
if (!preg_match('/^[\p{L}\p{N} _.\-()]+$/u', $name)) {
    json_error('Bundle name contains unsupported characters.');
}
if (!isset($cfg['users'][$username])) {
    json_error('User not found.', 404);
}
// Reject minting for any explicitly-disabled account; the OAuth flow has
// the same rule and we don't want a parallel back door.
if (($cfg['users'][$username]['disabled'] ?? false) === true) {
    json_error('User account is disabled.', 403);
}

// --- Locate template -------------------------------------------------------

$template_path = __DIR__ . '/php/mcp/templates/elements-cms.mcpb';
if (!is_file($template_path) || !is_readable($template_path)) {
    // Built artifact missing — surface a clean error rather than streaming
    // a corrupt zip. Run `npm run build:mcpb` to produce it.
    json_error('Bundle template is not installed on this server.', 500);
}

// --- Compute site URL ------------------------------------------------------
//
// Derive the absolute URL of mcp.php from the current request. We can't use
// $cfg['admin_url'] for this: that's the URL of the SPA *page* (set by the
// SPA itself in app.js), which on most installs is unrelated to where the
// editor PHP files (mcp.php, api.php, mcp-bundle.php) actually live.
//
// We do live next to mcp.php on disk and on the URL space, so the request's
// own scheme/host plus the directory portion of REQUEST_URI gives the right
// answer. This matches the pattern in oauth-protected-resource.php, which
// has to solve the same problem.

$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';

$self     = strtok((string) ($_SERVER['REQUEST_URI'] ?? '/'), '?');
$base_dir = rtrim(dirname($self), '/');
$site_url  = sprintf('%s://%s%s/mcp.php', $scheme, $self_host, $base_dir);
$site_root = sprintf('%s://%s%s/', $scheme, $self_host, $base_dir);
$site_host = $self_host;

// --- Mint token ------------------------------------------------------------
//
// Token plaintext leaves the server exactly once, embedded in the streamed
// manifest.json. We never echo it back as JSON, never log it, never put it
// in a header.

try {
    $issued = mcp_token_issue(
        $cfg,
        $name,
        $username,
        current_user(),
        'bundle',
    );
} catch (RuntimeException $e) {
    json_error('Failed to issue token.', 500);
}

$plaintext = $issued['plaintext'];
$row       = $issued['row'];

// --- Build customized .mcpb ------------------------------------------------
//
// Strategy: copy the template into a per-request temp file with 0600 perms,
// then ZipArchive::open + addFromString to overwrite manifest.json with the
// patched version. Stream the temp file out, unlink immediately, and again
// on shutdown as a belt-and-braces guard if the request aborts mid-stream.

$tmp = tempnam(sys_get_temp_dir(), 'mcpb_');
if ($tmp === false) {
    json_error('Failed to allocate temporary file.', 500);
}
@chmod($tmp, 0600);
register_shutdown_function(function () use ($tmp) {
    if (is_string($tmp) && is_file($tmp)) @unlink($tmp);
});

if (!@copy($template_path, $tmp)) {
    json_error('Failed to stage bundle.', 500);
}

$zip = new ZipArchive();
$open = $zip->open($tmp);
if ($open !== true) {
    json_error('Failed to open bundle template.', 500);
}

// Patch manifest.json. Read the original, do a strict placeholder swap (no
// JSON re-encoding round-trip — preserves whitespace and avoids accidental
// Unicode normalisation of the long_description), and write back.

$manifest_raw = $zip->getFromName('manifest.json');
if ($manifest_raw === false) {
    $zip->close();
    json_error('Bundle template is missing manifest.json.', 500);
}

$today = date('Y-m-d');
$manifest = json_decode($manifest_raw, true);
if (!is_array($manifest)) {
    $zip->close();
    json_error('Bundle template manifest is not valid JSON.', 500);
}

$display_label = sprintf('Elements CMS (%s)', $site_host);

$manifest['display_name']   = $display_label;
$manifest['version']        = $today;
$manifest['homepage']       = $site_root;
$manifest['server']['mcp_config']['env']['ELEMENTS_MCP_URL']    = $site_url;
$manifest['server']['mcp_config']['env']['ELEMENTS_MCP_BEARER'] = $plaintext;

$manifest_patched = json_encode(
    $manifest,
    JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
);
if ($manifest_patched === false) {
    $zip->close();
    json_error('Failed to encode patched manifest.', 500);
}

$zip->addFromString('manifest.json', $manifest_patched);
if (!$zip->close()) {
    json_error('Failed to repack bundle.', 500);
}

// Past this point: we've successfully built a download. Consume rate budget
// and emit the structured audit line. No bearer plaintext in either.

$bucket[] = $now;
$_SESSION['mcp_bundle_downloads'] = $bucket;

@error_log(sprintf(
    '[mcp] bundle issued: id=%s prefix=%s actor=%s target=%s host=%s ip=%s',
    $row['id'], $row['prefix'], current_user(), $username, $site_host,
    (string) ($_SERVER['REMOTE_ADDR'] ?? '-')
));

// --- Stream ---------------------------------------------------------------

$size = filesize($tmp);
$slug = preg_replace('/[^a-z0-9]+/i', '-', strtolower($site_host));
$slug = trim($slug, '-');
if ($slug === '') $slug = 'site';
$filename = sprintf('elements-cms-%s.mcpb', $slug);

header('Content-Type: application/octet-stream');
header('Content-Disposition: attachment; filename="' . $filename . '"');
if ($size !== false) header('Content-Length: ' . (int) $size);

$fp = @fopen($tmp, 'rb');
if ($fp === false) {
    json_error('Failed to open generated bundle.', 500);
}
fpassthru($fp);
fclose($fp);
@unlink($tmp);
exit;
