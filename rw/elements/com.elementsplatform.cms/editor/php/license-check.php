<?php

// ---------------------------------------------------------------------------
// Elements CMS — License verification engine
// ---------------------------------------------------------------------------
//
// Talks to portal.elementsplatform.com. The license credential is a key in the
// form XXXXX-XXXXX-XXXXX-XXXXX-XXXXX. Successful /api/check responses are signed
// with detached Ed25519 over canonical JSON; we verify them with libsodium
// against a pinned key map.
//
// See portal.elementsplatform.com/docs/api/migrating-from-payments-api.md for the
// authoritative specification.

define('PAYMENTS_API_BASE',              'https://portal.elementsplatform.com');
define('PAYMENTS_VERIFY_PATH',           '/api/check');
define('PAYMENTS_CHECKOUT_START_PATH',   '/api/checkout/start');
define('PAYMENTS_CHECKOUT_SESSION_PATH', '/api/checkout/session/');
define('PAYMENTS_DEACTIVATE_PATH',       '/api/deactivate');
define('PAYMENTS_PORTAL_PATH',           '/api/portal');

define('LICENSE_KEY_FILE',     __DIR__ . '/.elements_license_key');
define('LICENSE_CACHE_FILE',   __DIR__ . '/.elements_license_state.json');
define('LICENSE_GRACE_SECONDS', 86400);   // 24h fallback when the API is unreachable
define('LICENSE_CLOCK_SKEW',    300);     // 5 minutes of allowed skew on issued_at
define('LICENSE_FAILURE_TTL',   300);     // brief cache for valid:false / 404 bodies

// Pinned Ed25519 verification keys, kid => list of raw 32-byte keys.
// Ship updates here whenever portal.elementsplatform.com introduces a new kid,
// well before they switch the active signing key on the server.
// Keep in sync with tools/license-gate-public-keys.json and the inlined gates.
function license_public_keys(): array {
    static $cache = null;
    if ($cache !== null) return $cache;
    $cache = [
        'v1' => array_values(array_filter([
            base64_decode('G8OMWLmn6Mmga5u0f9r+3WN15R507VffM+lEDRKO9VY=', true),
        ], fn($key) => is_string($key) && strlen($key) === SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES)),
    ];
    if (PHP_SAPI === 'cli'
        && isset($GLOBALS['__elements_license_public_keys_override'])
        && is_array($GLOBALS['__elements_license_public_keys_override'])
    ) {
        foreach ($GLOBALS['__elements_license_public_keys_override'] as $kid => $keys) {
            if (!is_string($kid) || $kid === '') {
                continue;
            }

            $normalized = [];
            foreach (is_array($keys) ? $keys : [$keys] as $key) {
                if (!is_string($key)) {
                    continue;
                }

                $decoded = strlen($key) === SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES
                    ? $key
                    : base64_decode($key, true);

                if (is_string($decoded) && strlen($decoded) === SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES) {
                    $normalized[] = $decoded;
                }
            }

            if ($normalized !== []) {
                $cache[$kid] = array_merge($cache[$kid] ?? [], $normalized);
            }
        }
    }
    return $cache;
}

// ---------------------------------------------------------------------------
// Domain detection
// ---------------------------------------------------------------------------

function detect_domain(): string {
    $host = $_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? '';
    $host = strtolower(trim($host));
    $host = preg_replace('/:\d+$/', '', $host);
    $host = preg_replace('/^www\./', '', $host);
    return $host;
}

// ---------------------------------------------------------------------------
// License key persistence
// ---------------------------------------------------------------------------

function read_license_key(): string {
    if (!file_exists(LICENSE_KEY_FILE)) return '';
    $raw = @file_get_contents(LICENSE_KEY_FILE);
    if ($raw === false) return '';
    return trim($raw);
}

function write_license_key(string $key): bool {
    return @file_put_contents(LICENSE_KEY_FILE, trim($key), LOCK_EX) !== false;
}

function clear_license_key(): void {
    if (file_exists(LICENSE_KEY_FILE)) @unlink(LICENSE_KEY_FILE);
    if (file_exists(LICENSE_CACHE_FILE)) @unlink(LICENSE_CACHE_FILE);
}

function license_key_is_well_formed(string $key): bool {
    return (bool) preg_match('/^[A-Z0-9]{5}(?:-[A-Z0-9]{5}){4}$/', strtoupper(trim($key)));
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Determine the current license state.
 *
 * Pipeline:
 * 1. No license key on disk → unlicensed (reason: no_key).
 * 2. Cached (license_key, domain) entry still fresh → return it.
 *    Successful entries must re-verify their Ed25519 signature on read.
 * 3. POST /api/check; verify signature on a valid:true body.
 * 4. On 5xx / network failure → fall back to cached value within the 24h
 *    grace window; otherwise return unlicensed.
 */
function get_license_state(bool $force = false): array {
    $domain = detect_domain();
    $key    = read_license_key();

    if ($key === '') {
        return license_state_unlicensed('no_key', 'No license key configured for this installation.');
    }
    if ($domain === '') {
        return license_state_unlicensed('invalid_domain', 'Could not determine this installation\'s domain.');
    }

    $cached = license_cache_read($key, $domain);

    if (!$force && $cached && license_cache_is_fresh($cached)) {
        return license_state_from_response($cached, false);
    }

    $response = license_call_check($key, $domain);

    if ($response === null) {
        // Network / transport failure. Fall back to grace cache if possible.
        return license_grace_fallback($cached);
    }

    [$httpCode, $body] = $response;

    if ($httpCode >= 500) {
        return license_grace_fallback($cached);
    }

    if ($httpCode === 422) {
        return license_state_unlicensed('invalid_request', 'License check request was rejected by the server.');
    }

    if (!is_array($body)) {
        return license_grace_fallback($cached);
    }

    // valid:true bodies must verify before they're trusted or cached.
    if (($body['valid'] ?? false) === true) {
        if (!license_verify_response($body)) {
            return license_state_unlicensed(
                'untrusted_response',
                'License server response could not be verified. Please update Elements CMS and try again.',
            );
        }
        if (!license_response_allowed_for_domain($body)) {
            return license_state_from_response([
                'valid' => false,
                'reason' => 'solo_domain_mismatch',
                'domain' => $domain,
            ], false);
        }
    }

    license_cache_write($key, $domain, $body);

    return license_state_from_response($body, false);
}

// ---------------------------------------------------------------------------
// Outbound API calls
// ---------------------------------------------------------------------------

/**
 * POST /api/check. Returns [http_code, decoded_body] or null on transport
 * failure. Body may itself be null if the server returned malformed JSON.
 *
 * @return array{0:int,1:mixed}|null
 */
function license_call_check(string $key, string $domain): ?array {
    return license_http_request(
        'POST',
        PAYMENTS_API_BASE . PAYMENTS_VERIFY_PATH,
        ['license_key' => $key, 'domain' => $domain],
    );
}

/**
 * POST /api/checkout/start. Returns [http_code, decoded_body] or null.
 *
 * @return array{0:int,1:mixed}|null
 */
function license_call_checkout_start(array $payload): ?array {
    return license_http_request(
        'POST',
        PAYMENTS_API_BASE . PAYMENTS_CHECKOUT_START_PATH,
        $payload,
    );
}

/**
 * GET /api/checkout/session/{id}. Returns [http_code, decoded_body] or null.
 *
 * @return array{0:int,1:mixed}|null
 */
function license_call_checkout_session(string $sessionId): ?array {
    return license_http_request(
        'GET',
        PAYMENTS_API_BASE . PAYMENTS_CHECKOUT_SESSION_PATH . rawurlencode($sessionId),
        null,
    );
}

/**
 * POST /api/deactivate. Frees this domain's slot on the license. Returns
 * [http_code, decoded_body] or null on transport failure.
 *
 * @return array{0:int,1:mixed}|null
 */
function license_call_deactivate(string $key, string $domain): ?array {
    return license_http_request(
        'POST',
        PAYMENTS_API_BASE . PAYMENTS_DEACTIVATE_PATH,
        ['license_key' => $key, 'domain' => $domain],
    );
}

/**
 * POST /api/portal. Returns a one-shot Creem customer portal URL. The email
 * must match the customer record on file.
 *
 * @return array{0:int,1:mixed}|null
 */
function license_call_portal(string $key, string $email): ?array {
    return license_http_request(
        'POST',
        PAYMENTS_API_BASE . PAYMENTS_PORTAL_PATH,
        ['license_key' => $key, 'email' => $email],
    );
}

/**
 * Thin curl wrapper. Returns [http_code, decoded_body] or null on transport
 * failure. JSON decoding is tolerant — the body slot may be null.
 *
 * @return array{0:int,1:mixed}|null
 */
function license_http_request(string $method, string $url, ?array $jsonBody): ?array {
    if (PHP_SAPI === 'cli'
        && isset($GLOBALS['__elements_license_http_mock'])
        && is_callable($GLOBALS['__elements_license_http_mock'])
    ) {
        $mockResponse = $GLOBALS['__elements_license_http_mock']($method, $url, $jsonBody);
        return is_array($mockResponse) ? $mockResponse : null;
    }

    $ch = curl_init($url);
    if (!$ch) return null;

    $headers = ['Accept: application/json'];
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_FOLLOWLOCATION => true,
    ];

    if ($method === 'POST') {
        $headers[] = 'Content-Type: application/json';
        $opts[CURLOPT_POST]       = true;
        $opts[CURLOPT_POSTFIELDS] = $jsonBody === null
            ? '{}'
            : json_encode($jsonBody, JSON_UNESCAPED_SLASHES);
    } elseif ($method !== 'GET') {
        $opts[CURLOPT_CUSTOMREQUEST] = $method;
        if ($jsonBody !== null) {
            $headers[] = 'Content-Type: application/json';
            $opts[CURLOPT_POSTFIELDS] = json_encode($jsonBody, JSON_UNESCAPED_SLASHES);
        }
    }

    $opts[CURLOPT_HTTPHEADER] = $headers;
    curl_setopt_array($ch, $opts);

    $raw  = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($raw === false || $code === 0) {
        return null;
    }

    $decoded = json_decode($raw, true);
    return [$code, is_array($decoded) ? $decoded : null];
}

// ---------------------------------------------------------------------------
// Ed25519 signature verification
// ---------------------------------------------------------------------------

/**
 * Verify a valid:true response body against the pinned public-key map.
 * Returns true only if the signature, key id, and freshness window all check.
 */
function license_verify_response(array $body): bool {
    if (!isset($body['signature'], $body['key_id'], $body['issued_at'], $body['expires_at'])) {
        return false;
    }

    $keys = license_public_keys();
    $publicKeys = $keys[$body['key_id']] ?? null;
    if (is_string($publicKeys)) {
        $publicKeys = [$publicKeys];
    }
    if (!is_array($publicKeys)) {
        return false;
    }

    $sig = license_b64url_decode((string) $body['signature']);
    if ($sig === null || strlen($sig) !== SODIUM_CRYPTO_SIGN_BYTES) {
        return false;
    }

    $now      = time();
    $expires  = strtotime((string) $body['expires_at']);
    $issuedAt = strtotime((string) $body['issued_at']);
    if ($expires === false || $issuedAt === false) return false;

    if ($now > $expires) return false;
    if ($issuedAt > $now + LICENSE_CLOCK_SKEW) return false;
    if ($issuedAt < $now - LICENSE_GRACE_SECONDS) return false;

    $canonical = license_canonicalize($body);
    foreach ($publicKeys as $publicKey) {
        if (!is_string($publicKey) || strlen($publicKey) !== SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES) {
            continue;
        }

        try {
            if (sodium_crypto_sign_verify_detached($sig, $canonical, $publicKey)) {
                return true;
            }
        } catch (\SodiumException $e) {
            continue;
        }
    }

    return false;
}

/**
 * Canonical JSON used for signature verification: drop the signature field,
 * recursively sort object keys, encode with no whitespace and unescaped
 * slashes / unicode. Matches App\Support\ResponseSigner on the server.
 */
function license_canonicalize(array $body): string {
    unset($body['signature']);

    $sort = function ($value) use (&$sort) {
        if (!is_array($value)) return $value;
        if (function_exists('array_is_list') ? array_is_list($value) : license_is_list($value)) {
            return array_map($sort, $value);
        }
        ksort($value);
        return array_map($sort, $value);
    };

    return json_encode(
        $sort($body),
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR,
    );
}

function license_is_list(array $arr): bool {
    $i = 0;
    foreach ($arr as $k => $_) {
        if ($k !== $i) return false;
        $i++;
    }
    return true;
}

function license_b64url_decode(string $value): ?string {
    $padded = strtr($value, '-_', '+/');
    $padded .= str_repeat('=', (4 - strlen($padded) % 4) % 4);
    $decoded = base64_decode($padded, true);
    return $decoded === false ? null : $decoded;
}

function license_response_allowed_for_domain(array $body): bool {
    if (!license_response_is_solo($body)) {
        return true;
    }

    $domain = license_normalize_domain((string) ($body['domain'] ?? detect_domain()));
    $licensedDomain = license_normalize_domain((string) ($body['licensed_domain'] ?? $domain));

    return $domain !== '' && $domain === $licensedDomain;
}

function license_response_is_solo(array $body): bool {
    $productSlug = strtolower(trim((string) ($body['license_product_slug'] ?? '')));
    $tier = strtolower(trim((string) ($body['tier'] ?? '')));

    return $productSlug === 'solo' || $tier === 'solo';
}

function license_normalize_domain(string $domain): string {
    $domain = strtolower(trim($domain));
    $domain = preg_replace('/:\d+$/', '', $domain);
    $domain = preg_replace('/^www\./', '', $domain);
    return $domain;
}

// ---------------------------------------------------------------------------
// Cache layer: keyed by sha256(license_key|domain), persisted as JSON
// ---------------------------------------------------------------------------

function license_cache_key(string $key, string $domain): string {
    return hash('sha256', $key . '|' . strtolower($domain));
}

function license_cache_read(string $key, string $domain): ?array {
    if (!file_exists(LICENSE_CACHE_FILE)) return null;
    $raw = @file_get_contents(LICENSE_CACHE_FILE);
    if ($raw === false) return null;
    $store = json_decode($raw, true);
    if (!is_array($store)) return null;
    $entry = $store[license_cache_key($key, $domain)] ?? null;
    return is_array($entry) ? $entry : null;
}

function license_cache_write(string $key, string $domain, array $body): void {
    $store = [];
    if (file_exists(LICENSE_CACHE_FILE)) {
        $existing = json_decode((string) @file_get_contents(LICENSE_CACHE_FILE), true);
        if (is_array($existing)) $store = $existing;
    }
    $store[license_cache_key($key, $domain)] = $body;
    @file_put_contents(LICENSE_CACHE_FILE, json_encode($store, JSON_UNESCAPED_SLASHES), LOCK_EX);
}

function license_cache_is_fresh(array $cached): bool {
    $cacheUntil = isset($cached['cache_until']) ? strtotime((string) $cached['cache_until']) : 0;
    if (!$cacheUntil) {
        // Failure responses lack cache_until — treat as briefly fresh based on
        // when we recorded them. We never wrote a recorded-at marker, so just
        // fail closed: re-check on the next call.
        return false;
    }
    if ($cacheUntil <= time()) return false;

    if (($cached['valid'] ?? false) !== true) return true;

    return license_verify_response($cached);
}

function license_grace_fallback(?array $cached): array {
    if (!$cached) {
        return license_state_unlicensed('outage', 'License could not be verified — server unreachable.');
    }
    $cacheUntil = isset($cached['cache_until']) ? strtotime((string) $cached['cache_until']) : 0;
    $graceUntil = $cacheUntil ? $cacheUntil + LICENSE_GRACE_SECONDS : 0;

    if (($cached['valid'] ?? false) === true && time() < $graceUntil && license_verify_response($cached)) {
        return license_state_from_response($cached, true);
    }
    return license_state_unlicensed('outage', 'License could not be verified — server unreachable and grace period expired.');
}

// ---------------------------------------------------------------------------
// State shape consumed by the SPA
// ---------------------------------------------------------------------------

/**
 * Convert a /api/check body into the SPA-facing state shape.
 */
function license_state_from_response(array $body, bool $grace): array {
    $domain = detect_domain();
    $key    = read_license_key();
    $productName = isset($body['license_product_name']) ? trim((string) $body['license_product_name']) : '';
    $productSlug = isset($body['license_product_slug']) ? trim((string) $body['license_product_slug']) : '';

    if (($body['valid'] ?? false) === true) {
        $cacheUntil = isset($body['cache_until']) ? strtotime((string) $body['cache_until']) : null;
        $graceUntil = $grace && $cacheUntil ? $cacheUntil + LICENSE_GRACE_SECONDS : null;
        $responseDomain = (string) ($body['domain'] ?? $domain);
        $licensedDomain = isset($body['licensed_domain']) ? trim((string) $body['licensed_domain']) : '';
        if ($licensedDomain === '') {
            $licensedDomain = $responseDomain;
        }

        return [
            'valid'              => true,
            'status'             => $grace ? 'grace' : (string) ($body['status'] ?? 'active'),
            'underlying_status'  => (string) ($body['status'] ?? 'active'),
            'tier'               => $body['tier'] ?? null,
            'interval'           => isset($body['interval']) ? (string) $body['interval'] : null,
            'license_product_name' => $productName !== '' ? $productName : null,
            'license_product_slug' => $productSlug !== '' ? $productSlug : null,
            'limits'             => is_array($body['limits'] ?? null) ? $body['limits'] : null,
            'max_domains'        => isset($body['max_domains']) ? (int) $body['max_domains'] : null,
            'domain'             => $responseDomain,
            'licensed_domain'    => $licensedDomain,
            'domain_status'      => $body['domain_status'] ?? null,
            'current_period_end' => $body['current_period_end'] ?? null,
            'cache_until'        => $body['cache_until'] ?? null,
            'reason'             => null,
            'active_domains'     => null,
            'license_key'        => $key !== '' ? $key : null,
            'message'            => $grace
                ? 'License server unreachable — using cached validation (grace period).'
                : ('Licensed — ' . $responseDomain),
            'checked_at'         => time(),
            'grace_until'        => $graceUntil,
        ];
    }

    $reason = (string) ($body['reason'] ?? 'unknown');
    return [
        'valid'              => false,
        'status'             => 'unlicensed',
        'underlying_status'  => $body['status'] ?? null,
        'tier'               => null,
        'interval'           => null,
        'license_product_name' => null,
        'license_product_slug' => null,
        'limits'             => null,
        'max_domains'        => isset($body['max_domains']) ? (int) $body['max_domains'] : null,
        'domain'             => $domain,
        'licensed_domain'    => null,
        'domain_status'      => null,
        'current_period_end' => null,
        'cache_until'        => null,
        'reason'             => $reason,
        'active_domains'     => isset($body['active_domains']) && is_array($body['active_domains'])
            ? array_values(array_map('strval', $body['active_domains']))
            : null,
        'license_key'        => $key !== '' ? $key : null,
        'message'            => license_message_for_reason($reason, $body),
        'checked_at'         => time(),
        'grace_until'        => null,
    ];
}

function license_state_unlicensed(string $reason, string $message): array {
    $key = read_license_key();
    return [
        'valid'              => false,
        'status'             => 'unlicensed',
        'underlying_status'  => null,
        'tier'               => null,
        'interval'           => null,
        'license_product_name' => null,
        'license_product_slug' => null,
        'limits'             => null,
        'max_domains'        => null,
        'domain'             => detect_domain(),
        'licensed_domain'    => null,
        'domain_status'      => null,
        'current_period_end' => null,
        'cache_until'        => null,
        'reason'             => $reason,
        'active_domains'     => null,
        'license_key'        => $key !== '' ? $key : null,
        'message'            => $message,
        'checked_at'         => time(),
        'grace_until'        => null,
    ];
}

function license_message_for_reason(string $reason, array $body): string {
    switch ($reason) {
        case 'unknown_key':
            return 'We could not find that license key.';
        case 'license_revoked':
            return 'This license has been revoked.';
        case 'subscription_canceled':
            return 'This subscription is no longer active.';
        case 'no_subscription':
            return 'License is not yet attached to a subscription.';
        case 'invalid_domain':
            return 'The domain for this installation could not be parsed.';
        case 'domain_limit_reached':
            return 'This license is already active on its maximum number of domains.';
        case 'solo_domain_mismatch':
            return 'Solo licenses are valid only on their activation domain.';
        case 'untrusted_response':
            return 'License server response could not be verified. Please update Elements CMS and try again.';
        default:
            return 'No active license for this domain.';
    }
}

// ---------------------------------------------------------------------------
// Backwards-compatible shims — kept so unrelated callers still compile.
// ---------------------------------------------------------------------------

function build_license_state(array $body): array {
    return license_state_from_response($body, false);
}

function write_license_cache(array $state): bool {
    return true;
}
