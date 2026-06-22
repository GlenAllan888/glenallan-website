<?php

// ---------------------------------------------------------------------------
// OAuth 2.1 storage layer (clients, auth codes, access + refresh tokens)
// ---------------------------------------------------------------------------
// All four buckets live in config.php under top-level keys:
//   oauth_clients[]         — DCR-registered public clients
//   oauth_auth_codes[]      — short-lived authorization codes
//   oauth_access_tokens[]   — bearer tokens used against mcp.php
//   oauth_refresh_tokens[]  — long-lived rotation tokens
//
// Plaintext secrets (auth codes, access tokens, refresh tokens) are bcrypt-
// hashed at rest, the same pattern the previous mcp_tokens module used.
// Plaintext only exists during the response that mints it. Lookup happens by
// checking password_verify against every non-expired row — fine at the
// expected scale (a handful of clients per install, a few live tokens each).
//
// GC: each list-loader prunes expired rows lazily on read, then writes back if
// anything changed. No cron required.

const OAUTH_CLIENT_PREFIX        = 'oauthc_';
const OAUTH_AUTH_CODE_PREFIX     = 'oauthcode_';
const OAUTH_ACCESS_TOKEN_PREFIX  = 'oauth_';
const OAUTH_REFRESH_TOKEN_PREFIX = 'oauthr_';

const OAUTH_AUTH_CODE_TTL    = 600;          // 10 minutes
const OAUTH_ACCESS_TOKEN_TTL = 3600;         // 1 hour
const OAUTH_REFRESH_TOKEN_TTL = 60 * 60 * 24 * 30; // 30 days

// ---------------------------------------------------------------------------
// Bearer header reader (preserved from the old mcp/auth.php).
// Authorization: Bearer <token>. No query-string fallback — DCR-aware
// clients all support headers, and the static token path is gone.
// ---------------------------------------------------------------------------

function oauth_read_bearer_header(): ?string {
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
    return null;
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

function oauth_clients_all(array $cfg): array {
    return $cfg['oauth_clients'] ?? [];
}

function oauth_client_find(array $cfg, string $client_id): ?array {
    foreach (oauth_clients_all($cfg) as $client) {
        if (($client['client_id'] ?? '') === $client_id) {
            return $client;
        }
    }
    return null;
}

function oauth_client_public_summary(array $client): array {
    return [
        'client_id'      => $client['client_id'] ?? '',
        'client_name'    => $client['client_name'] ?? '',
        'redirect_uris'  => $client['redirect_uris'] ?? [],
        'registered_at'  => (int) ($client['registered_at'] ?? 0),
        'last_used_at'   => (int) ($client['last_used_at'] ?? 0),
    ];
}

function oauth_client_create(array &$cfg, array $metadata): array {
    $client_id = OAUTH_CLIENT_PREFIX . bin2hex(random_bytes(8));
    $client = [
        'client_id'                  => $client_id,
        'client_name'                => $metadata['client_name'] ?? '',
        'redirect_uris'              => $metadata['redirect_uris'] ?? [],
        'token_endpoint_auth_method' => 'none',
        'grant_types'                => ['authorization_code', 'refresh_token'],
        'response_types'             => ['code'],
        'registered_at'              => time(),
        'last_used_at'               => 0,
    ];
    $cfg['oauth_clients'] = $cfg['oauth_clients'] ?? [];
    $cfg['oauth_clients'][] = $client;
    save_config($cfg);
    return $client;
}

function oauth_client_revoke(array &$cfg, string $client_id): bool {
    $found = false;
    foreach ($cfg['oauth_clients'] ?? [] as $i => $client) {
        if (($client['client_id'] ?? '') === $client_id) {
            array_splice($cfg['oauth_clients'], $i, 1);
            $found = true;
            break;
        }
    }
    if (!$found) return false;
    // Cascade: drop every code/token bound to the revoked client.
    $cfg['oauth_auth_codes']     = oauth_filter_by_client($cfg['oauth_auth_codes']     ?? [], $client_id);
    $cfg['oauth_access_tokens']  = oauth_filter_by_client($cfg['oauth_access_tokens']  ?? [], $client_id);
    $cfg['oauth_refresh_tokens'] = oauth_filter_by_client($cfg['oauth_refresh_tokens'] ?? [], $client_id);
    save_config($cfg);
    return true;
}

function oauth_filter_by_client(array $rows, string $client_id): array {
    return array_values(array_filter($rows, fn($r) => ($r['client_id'] ?? '') !== $client_id));
}

function oauth_client_touch(array &$cfg, string $client_id): void {
    foreach ($cfg['oauth_clients'] ?? [] as $i => $client) {
        if (($client['client_id'] ?? '') === $client_id) {
            $cfg['oauth_clients'][$i]['last_used_at'] = time();
            @save_config($cfg);
            return;
        }
    }
}

// ---------------------------------------------------------------------------
// Authorization codes
// ---------------------------------------------------------------------------

function oauth_auth_codes_load(array &$cfg): array {
    $now = time();
    $rows = $cfg['oauth_auth_codes'] ?? [];
    $kept = array_values(array_filter($rows, fn($r) => (int) ($r['expires_at'] ?? 0) > $now));
    if (count($kept) !== count($rows)) {
        $cfg['oauth_auth_codes'] = $kept;
        @save_config($cfg);
    }
    return $kept;
}

function oauth_auth_code_store(array &$cfg, string $plaintext, array $row): void {
    $row['hash'] = password_hash($plaintext, PASSWORD_DEFAULT);
    $cfg['oauth_auth_codes'] = $cfg['oauth_auth_codes'] ?? [];
    $cfg['oauth_auth_codes'][] = $row;
    save_config($cfg);
}

function oauth_auth_code_consume(array &$cfg, string $plaintext): ?array {
    $rows = oauth_auth_codes_load($cfg);
    foreach ($rows as $i => $row) {
        if (!empty($row['hash']) && password_verify($plaintext, $row['hash'])) {
            // Single-use: remove on lookup regardless of caller's success.
            array_splice($cfg['oauth_auth_codes'], $i, 1);
            save_config($cfg);
            return $row;
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// Access tokens
// ---------------------------------------------------------------------------

function oauth_access_tokens_load(array &$cfg): array {
    $now = time();
    $rows = $cfg['oauth_access_tokens'] ?? [];
    $kept = array_values(array_filter($rows, fn($r) => (int) ($r['expires_at'] ?? 0) > $now));
    if (count($kept) !== count($rows)) {
        $cfg['oauth_access_tokens'] = $kept;
        @save_config($cfg);
    }
    return $kept;
}

function oauth_access_token_store(array &$cfg, string $plaintext, array $row): void {
    $row['hash'] = password_hash($plaintext, PASSWORD_DEFAULT);
    $cfg['oauth_access_tokens'] = $cfg['oauth_access_tokens'] ?? [];
    $cfg['oauth_access_tokens'][] = $row;
    save_config($cfg);
}

/**
 * Resolve a plaintext bearer token to the bound user, or null.
 * Returns ['index' => i, 'row' => row, 'username' => email] on success.
 */
function oauth_access_token_resolve(array &$cfg, string $plaintext): ?array {
    if (strpos($plaintext, OAUTH_ACCESS_TOKEN_PREFIX) !== 0) return null;
    foreach (oauth_access_tokens_load($cfg) as $i => $row) {
        if (!empty($row['hash']) && password_verify($plaintext, $row['hash'])) {
            return [
                'index'    => $i,
                'row'      => $row,
                'username' => (string) ($row['username'] ?? ''),
            ];
        }
    }
    return null;
}

function oauth_access_token_touch(array &$cfg, int $index): void {
    if (!isset($cfg['oauth_access_tokens'][$index])) return;
    $cfg['oauth_access_tokens'][$index]['last_used_at'] = time();
    @save_config($cfg);
}

// ---------------------------------------------------------------------------
// Refresh tokens
// ---------------------------------------------------------------------------

function oauth_refresh_tokens_load(array &$cfg): array {
    $now = time();
    $rows = $cfg['oauth_refresh_tokens'] ?? [];
    $kept = array_values(array_filter($rows, fn($r) => (int) ($r['expires_at'] ?? 0) > $now));
    if (count($kept) !== count($rows)) {
        $cfg['oauth_refresh_tokens'] = $kept;
        @save_config($cfg);
    }
    return $kept;
}

function oauth_refresh_token_store(array &$cfg, string $plaintext, array $row): void {
    $row['hash'] = password_hash($plaintext, PASSWORD_DEFAULT);
    $cfg['oauth_refresh_tokens'] = $cfg['oauth_refresh_tokens'] ?? [];
    $cfg['oauth_refresh_tokens'][] = $row;
    save_config($cfg);
}

/**
 * Consume a refresh token (single-use, rotated). Returns the row on success.
 * Caller is expected to issue a replacement immediately.
 */
function oauth_refresh_token_consume(array &$cfg, string $plaintext): ?array {
    if (strpos($plaintext, OAUTH_REFRESH_TOKEN_PREFIX) !== 0) return null;
    $rows = oauth_refresh_tokens_load($cfg);
    foreach ($rows as $i => $row) {
        if (!empty($row['hash']) && password_verify($plaintext, $row['hash'])) {
            array_splice($cfg['oauth_refresh_tokens'], $i, 1);
            save_config($cfg);
            return $row;
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// DCR rate limit (per-IP, per-hour)
// ---------------------------------------------------------------------------

const OAUTH_REGISTER_MAX_PER_HOUR = 30;

function oauth_register_rate_limited(array &$cfg, string $ip): bool {
    $now    = time();
    $bucket = (int) floor($now / 3600);

    $log = $cfg['oauth_register_attempts'] ?? [];
    $kept = [];
    foreach ($log as $row) {
        if ((int) ($row['bucket'] ?? 0) >= $bucket - 1) $kept[] = $row;
    }

    $count = 0;
    foreach ($kept as $row) {
        if (($row['ip'] ?? '') === $ip && (int) ($row['bucket'] ?? 0) === $bucket) {
            $count = (int) ($row['count'] ?? 0);
            break;
        }
    }
    if ($count >= OAUTH_REGISTER_MAX_PER_HOUR) {
        $cfg['oauth_register_attempts'] = $kept;
        @save_config($cfg);
        return true;
    }

    $found = false;
    foreach ($kept as &$row) {
        if (($row['ip'] ?? '') === $ip && (int) ($row['bucket'] ?? 0) === $bucket) {
            $row['count'] = (int) ($row['count'] ?? 0) + 1;
            $found = true;
            break;
        }
    }
    unset($row);
    if (!$found) {
        $kept[] = ['ip' => $ip, 'bucket' => $bucket, 'count' => 1];
    }
    $cfg['oauth_register_attempts'] = $kept;
    @save_config($cfg);
    return false;
}
