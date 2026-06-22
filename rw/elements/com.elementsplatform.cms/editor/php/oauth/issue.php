<?php

// ---------------------------------------------------------------------------
// OAuth 2.1 token / code minting + PKCE verification.
// ---------------------------------------------------------------------------
// All plaintext values use base64url-encoded random bytes with a typed prefix.
// 32 random bytes = 256 bits, well above what the spec requires.

require_once __DIR__ . '/storage.php';

function oauth_random_secret(string $prefix): string {
    return $prefix . rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
}

function oauth_issue_auth_code(
    array &$cfg,
    string $client_id,
    string $username,
    string $redirect_uri,
    string $code_challenge,
    string $scope
): string {
    $plaintext = oauth_random_secret(OAUTH_AUTH_CODE_PREFIX);
    oauth_auth_code_store($cfg, $plaintext, [
        'client_id'      => $client_id,
        'username'       => $username,
        'redirect_uri'   => $redirect_uri,
        'code_challenge' => $code_challenge,
        'scope'          => $scope,
        'created_at'     => time(),
        'expires_at'     => time() + OAUTH_AUTH_CODE_TTL,
    ]);
    return $plaintext;
}

function oauth_issue_access_token(
    array &$cfg,
    string $client_id,
    string $username,
    string $scope
): array {
    $plaintext = oauth_random_secret(OAUTH_ACCESS_TOKEN_PREFIX);
    oauth_access_token_store($cfg, $plaintext, [
        'client_id'    => $client_id,
        'username'     => $username,
        'scope'        => $scope,
        'created_at'   => time(),
        'expires_at'   => time() + OAUTH_ACCESS_TOKEN_TTL,
        'last_used_at' => 0,
    ]);
    return ['plaintext' => $plaintext, 'expires_in' => OAUTH_ACCESS_TOKEN_TTL];
}

function oauth_issue_refresh_token(
    array &$cfg,
    string $client_id,
    string $username,
    string $scope
): string {
    $plaintext = oauth_random_secret(OAUTH_REFRESH_TOKEN_PREFIX);
    oauth_refresh_token_store($cfg, $plaintext, [
        'client_id'  => $client_id,
        'username'   => $username,
        'scope'      => $scope,
        'created_at' => time(),
        'expires_at' => time() + OAUTH_REFRESH_TOKEN_TTL,
    ]);
    return $plaintext;
}

/**
 * RFC 7636 PKCE S256: base64url(sha256(verifier)) === stored challenge.
 * `plain` is intentionally rejected — we only support S256.
 */
function oauth_verify_pkce_s256(string $verifier, string $stored_challenge): bool {
    if ($verifier === '' || $stored_challenge === '') return false;
    // Spec: code_verifier is 43–128 chars of [A-Z][a-z][0-9]-._~
    if (!preg_match('/^[A-Za-z0-9\-._~]{43,128}$/', $verifier)) return false;
    $computed = rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');
    return hash_equals($stored_challenge, $computed);
}
