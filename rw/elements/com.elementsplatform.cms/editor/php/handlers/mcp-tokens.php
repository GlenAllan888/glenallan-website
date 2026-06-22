<?php

// ---------------------------------------------------------------------------
// Admin handlers for MCP bearer-token management (owner-only).
// ---------------------------------------------------------------------------
// Tokens authenticate AI agents calling /editor/mcp.php. They live in
// config.php under `mcp_tokens` and are hashed with password_hash().
// Plaintext is shown once, at creation time.
//
// Deliberately separate from the api_tokens store and the OAuth state
// tables — see the header note in php/mcp/tokens.php.

require_once __DIR__ . '/../mcp/tokens.php';

// Username regex (Unicode letters/numbers, plus a small set of safe punct).
// Same character class enforced by mcp-bundle.php. Names longer than 80
// chars are rejected.
const MCP_TOKEN_NAME_REGEX = '/^[\p{L}\p{N} _.\-()]+$/u';

function handle_mcp_tokens_list(array $cfg, array $license): never {
    require_owner();
    mcp_tokens_require_license();

    $tokens = array_map('mcp_token_public_summary', mcp_tokens($cfg));
    json_response(['tokens' => array_values($tokens)]);
}

function handle_mcp_tokens_create(array $cfg, array $license): never {
    require_owner();
    require_post();
    verify_csrf();
    mcp_tokens_require_license();

    $input = get_json_body();
    $name = trim((string) ($input['name'] ?? ''));
    $username = strtolower(trim((string) ($input['username'] ?? current_user())));

    if ($name === '') {
        json_error('Token name is required.');
    }
    if (mb_strlen($name) > 80) {
        json_error('Token name is too long (max 80 characters).');
    }
    if (!preg_match(MCP_TOKEN_NAME_REGEX, $name)) {
        json_error('Token name contains unsupported characters.');
    }
    if (!isset($cfg['users'][$username])) {
        json_error('User not found.', 404);
    }

    try {
        $issued = mcp_token_issue($cfg, $name, $username, current_user(), 'manual');
    } catch (RuntimeException $e) {
        json_error('Failed to save configuration.', 500);
    }

    // Audit trail: never log the plaintext, only its hint.
    @error_log(sprintf(
        '[mcp] token issued: id=%s prefix=%s actor=%s target=%s origin=manual',
        $issued['row']['id'], $issued['row']['prefix'], current_user(), $username
    ));

    json_response([
        'token'     => mcp_token_public_summary($issued['row']),
        'plaintext' => $issued['plaintext'],
        'message'   => 'Token created. Copy it now — it will not be shown again.',
    ]);
}

function handle_mcp_tokens_revoke(array $cfg, array $license): never {
    require_owner();
    require_post();
    verify_csrf();
    mcp_tokens_require_license();

    $input = get_json_body();
    $id = (string) ($input['id'] ?? '');

    $found = null;
    foreach ($cfg['mcp_tokens'] ?? [] as $i => $t) {
        if (($t['id'] ?? '') === $id) {
            $found = $t;
            array_splice($cfg['mcp_tokens'], $i, 1);
            break;
        }
    }
    if ($found === null) {
        json_error('Token not found.', 404);
    }

    if (!save_config($cfg)) {
        json_error('Failed to save configuration.', 500);
    }

    @error_log(sprintf(
        '[mcp] token revoked: id=%s prefix=%s actor=%s',
        $found['id'], $found['prefix'] ?? '', current_user()
    ));

    json_ok('Token revoked.');
}
