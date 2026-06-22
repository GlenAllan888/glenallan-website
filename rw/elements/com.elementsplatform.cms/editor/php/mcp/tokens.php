<?php

// ---------------------------------------------------------------------------
// MCP bearer-token store (admin-issued static tokens)
// ---------------------------------------------------------------------------
// Tokens live in config.php under `mcp_tokens` as:
//   [ [ 'id' => ..., 'name' => ..., 'username' => ..., 'hash' => ...,
//       'prefix' => ..., 'created_at' => ..., 'last_used_at' => ...,
//       'created_by' => ..., 'origin' => ... ] ]
// Plaintext is shown once at creation time (or embedded in a downloaded
// .mcpb bundle once, see mcp-bundle.php).
// Plaintext format: mcp_<24b-base64url>.
// `prefix` stores the first 8 chars of the body so the UI can render a
// "mcp_ab12cd34…" hint without unhashing.
//
// Deliberately separate from `api_tokens` and the OAuth state tables. MCP
// tokens authenticate AI agents hitting /editor/mcp.php; api_tokens
// authenticate JSON REST clients hitting /api/*; OAuth tokens authenticate
// MCP clients that prefer the DCR + browser-consent flow. Three products,
// three stores. Never merge.

const MCP_TOKEN_PREFIX = 'mcp_';

function mcp_generate_token_plaintext(): string {
    return MCP_TOKEN_PREFIX . rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '=');
}

function mcp_token_prefix_hint(string $plaintext): string {
    $body = substr($plaintext, strlen(MCP_TOKEN_PREFIX));
    return MCP_TOKEN_PREFIX . substr($body, 0, 8);
}

function mcp_tokens(array $cfg): array {
    return $cfg['mcp_tokens'] ?? [];
}

function mcp_token_public_summary(array $token): array {
    return [
        'id'           => (string) ($token['id'] ?? ''),
        'name'         => (string) ($token['name'] ?? ''),
        'username'     => (string) ($token['username'] ?? ''),
        'prefix'       => (string) ($token['prefix'] ?? ''),
        'origin'       => (string) ($token['origin'] ?? 'manual'),
        'created_at'   => (int) ($token['created_at'] ?? 0),
        'last_used_at' => (int) ($token['last_used_at'] ?? 0),
        'created_by'   => (string) ($token['created_by'] ?? ''),
    ];
}

/**
 * Resolve a plaintext bearer to {index, token} or null.
 * Only matches values whose body verifies against a stored hash. Wrong-prefix
 * input returns null without scanning, so misrouted oauth_/api_ tokens fail
 * fast.
 */
function mcp_token_resolve(array $cfg, string $plaintext): ?array {
    if (!str_starts_with($plaintext, MCP_TOKEN_PREFIX)) return null;
    foreach (mcp_tokens($cfg) as $idx => $token) {
        if (!empty($token['hash']) && password_verify($plaintext, $token['hash'])) {
            return ['index' => $idx, 'token' => $token];
        }
    }
    return null;
}

function mcp_token_touch(array &$cfg, int $token_index): void {
    if (!isset($cfg['mcp_tokens'][$token_index])) return;
    $cfg['mcp_tokens'][$token_index]['last_used_at'] = time();
    @save_config($cfg);
}

/**
 * Read a candidate MCP bearer from the request. Order of preference:
 *   1. Authorization: Bearer mcp_…
 *   2. ?token=mcp_…  (Claude Desktop custom-connector URL paste case)
 * Only returns values that look like an MCP token; OAuth/API tokens fall
 * through to their own readers.
 */
function mcp_read_bearer(): ?string {
    $header = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? '';

    if ($header === '' && function_exists('apache_request_headers')) {
        foreach (apache_request_headers() as $k => $v) {
            if (strcasecmp($k, 'Authorization') === 0) { $header = (string) $v; break; }
        }
    }

    if ($header !== '' && stripos($header, 'Bearer ') === 0) {
        $candidate = trim(substr($header, 7));
        if ($candidate !== '' && str_starts_with($candidate, MCP_TOKEN_PREFIX)) {
            return $candidate;
        }
    }

    $qp = trim((string) ($_GET['token'] ?? ''));
    if ($qp !== '' && str_starts_with($qp, MCP_TOKEN_PREFIX)) {
        return $qp;
    }
    return null;
}

/**
 * Cascade: drop every mcp_token row bound to a vanished username. Called
 * from handle_users_delete so deleted users don't leave orphaned bearers.
 */
function mcp_tokens_revoke_for_user(array &$cfg, string $username): int {
    $rows = $cfg['mcp_tokens'] ?? [];
    $kept = array_values(array_filter($rows, fn($r) => (string) ($r['username'] ?? '') !== $username));
    $removed = count($rows) - count($kept);
    if ($removed > 0) {
        $cfg['mcp_tokens'] = $kept;
        @save_config($cfg);
    }
    return $removed;
}

/**
 * Mint a new mcp_ token, persist its hash, and return the stored row plus
 * the plaintext (which is otherwise unrecoverable). Caller is responsible
 * for ensuring `username` exists; we don't verify here so this stays a pure
 * store helper.
 *
 *   $origin: 'manual' (token creator UI) | 'bundle' (.mcpb download). Used
 *            by the UI to badge bundle-issued tokens and by audit log lines.
 */
function mcp_token_issue(array &$cfg, string $name, string $username, string $created_by, string $origin = 'manual'): array {
    $plaintext = mcp_generate_token_plaintext();
    $row = [
        'id'           => 'mcpt_' . bin2hex(random_bytes(8)),
        'name'         => $name,
        'username'     => $username,
        'hash'         => password_hash($plaintext, PASSWORD_DEFAULT),
        'prefix'       => mcp_token_prefix_hint($plaintext),
        'origin'       => $origin,
        'created_at'   => time(),
        'last_used_at' => 0,
        'created_by'   => $created_by,
    ];
    $cfg['mcp_tokens'] = $cfg['mcp_tokens'] ?? [];
    $cfg['mcp_tokens'][] = $row;
    if (!save_config($cfg)) {
        throw new RuntimeException('Failed to persist MCP token.');
    }
    return ['row' => $row, 'plaintext' => $plaintext];
}

// ---------------------------------------------------------------------------
// License gate (paid `mcp_tokens` flag)
// ---------------------------------------------------------------------------
// Mirrors the inline pattern used in php/handlers/api-tokens.php and
// php/mcp/server.php: re-verify the cached license signature with libsodium
// rather than trusting the cache file alone. Belt-and-braces — if an
// attacker can write the cache file they still can't forge a valid signed
// limits payload without the signing key.

function mcp_tokens_license_allowed(): bool {
    $path = __DIR__ . '/../.elements_license_state.json';
    $data = is_file($path) ? json_decode((string) @file_get_contents($path), true) : null;
    if (!is_array($data)) return false;

    foreach ($data as $entry) {
        if (!is_array($entry) || ($entry['valid'] ?? false) !== true) continue;
        if (($entry['key_id'] ?? '') !== 'v1') continue;

        $b64 = strtr((string) ($entry['signature'] ?? ''), '-_', '+/');
        $b64 .= str_repeat('=', (4 - strlen($b64) % 4) % 4);
        $sig = base64_decode($b64, true);
        if (!is_string($sig) || strlen($sig) !== SODIUM_CRYPTO_SIGN_BYTES) continue;

        $body = $entry; unset($body['signature']);
        $sort = function ($v) use (&$sort) {
            if (!is_array($v)) return $v;
            $list = true; $i = 0;
            foreach ($v as $k => $_) { if ($k !== $i++) { $list = false; break; } }
            if (!$list) ksort($v);
            return array_map($sort, $v);
        };
        $canonical = json_encode($sort($body), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        // Generated from tools/license-gate-public-keys.json; run npm run sync:license-gates after rotations.
        foreach ([
            'G8OMWLmn6Mmga5u0f9r+3WN15R507VffM+lEDRKO9VY=',
        ] as $pub_b64) {
            $pub = base64_decode($pub_b64, true);
            if (!is_string($pub) || strlen($pub) !== SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES) continue;
            try {
                if (sodium_crypto_sign_verify_detached($sig, $canonical, $pub)) {
                    return !empty($entry['limits']['mcp_tokens']);
                }
            } catch (\SodiumException $_) {}
        }
    }
    return false;
}

/**
 * 403 the request unless the cached license has the `mcp_tokens` paid flag.
 */
function mcp_tokens_require_license(): void {
    if (!mcp_tokens_license_allowed()) {
        json_error('MCP access requires Studio plan for this domain.', 403);
    }
}
