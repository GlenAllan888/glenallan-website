<?php

// ---------------------------------------------------------------------------
// JSON REST API bearer-key auth
// ---------------------------------------------------------------------------
// Keys are stored in config.php under `api_tokens` as:
//   [ [ 'id' => ..., 'name' => ..., 'hash' => ..., 'email' => ...,
//       'created_at' => ..., 'last_used_at' => ..., 'prefix' => ... ] ]
// The plaintext key is shown only once at creation time.
// Key format: api_<24b-random> (base64url, ~32 chars after prefix).
// `prefix` stores the first 8 chars after `api_` so the UI can display a
// hint ("api_ab12cd34…") without unhashing.
//
// This store is deliberately separate from `mcp_tokens`. MCP tokens
// authenticate AI agents hitting /editor/mcp.php; api_tokens authenticate
// your own code hitting /api/*. Different products, different UIs.

const API_TOKEN_PREFIX = 'api_';

function api_generate_token_plaintext(): string {
    return API_TOKEN_PREFIX . rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '=');
}

function api_token_prefix_hint(string $plaintext): string {
    $body = substr($plaintext, strlen(API_TOKEN_PREFIX));
    return API_TOKEN_PREFIX . substr($body, 0, 8);
}

function api_tokens(array $cfg): array {
    return $cfg['api_tokens'] ?? [];
}

function api_token_public_summary(array $token): array {
    return [
        'id'           => $token['id'],
        'name'         => $token['name'],
        'email'        => $token['email'],
        'prefix'       => $token['prefix'] ?? '',
        'created_at'   => (int) ($token['created_at'] ?? 0),
        'last_used_at' => (int) ($token['last_used_at'] ?? 0),
    ];
}

function api_find_token_by_plaintext(array $cfg, string $plaintext): ?array {
    foreach (api_tokens($cfg) as $idx => $token) {
        if (!empty($token['hash']) && password_verify($plaintext, $token['hash'])) {
            return ['index' => $idx, 'token' => $token];
        }
    }
    return null;
}

// Read the bearer key from either:
//   - Authorization: Bearer <key>   (preferred)
//   - ?token=<key>                  (fallback for clients that can't set headers)
function api_read_bearer_header(): ?string {
    $header = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? '';

    if ($header === '' && function_exists('apache_request_headers')) {
        foreach (apache_request_headers() as $k => $v) {
            if (strcasecmp($k, 'Authorization') === 0) {
                $header = $v;
                break;
            }
        }
    }

    if ($header !== '' && stripos($header, 'Bearer ') === 0) {
        $token = trim(substr($header, 7));
        if ($token !== '') return $token;
    }

    $qp = trim((string) ($_GET['token'] ?? ''));
    return $qp === '' ? null : $qp;
}

function api_touch_token(array &$cfg, int $token_index): void {
    if (!isset($cfg['api_tokens'][$token_index])) return;
    $cfg['api_tokens'][$token_index]['last_used_at'] = time();
    @save_config($cfg);
}

// Resolve a bearer key to a {email, role, index} record or null.
// Also reports the token family so callers can tell a misrouted `mcp_`
// token apart from a truly invalid one.
function api_resolve_bearer_token(array $cfg, string $plaintext): array {
    if (str_starts_with($plaintext, 'mcp_')) {
        return ['ok' => false, 'reason' => 'wrong_family'];
    }
    if (!str_starts_with($plaintext, API_TOKEN_PREFIX)) {
        return ['ok' => false, 'reason' => 'invalid'];
    }

    $match = api_find_token_by_plaintext($cfg, $plaintext);
    if ($match === null) {
        return ['ok' => false, 'reason' => 'invalid'];
    }

    $email = $match['token']['email'] ?? '';
    $role  = $cfg['users'][$email]['role'] ?? 'editor';

    return [
        'ok'    => true,
        'index' => $match['index'],
        'email' => $email,
        'role'  => $role,
    ];
}
