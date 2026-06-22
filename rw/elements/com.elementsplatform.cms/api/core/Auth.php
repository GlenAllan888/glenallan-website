<?php

namespace CMS\Core;

/**
 * Token auth + license gating for the JSON REST API.
 *
 * Bridges into the editor's shared helpers:
 *   editor/php/helpers.php        — load_config(), save_config()
 *   editor/php/license-check.php  — get_license_state()
 *   editor/php/api/auth.php       — api_resolve_bearer_token(), api_touch_token()
 */
class Auth
{
    private static bool $booted = false;

    private static function boot(): void
    {
        if (self::$booted) return;
        $editor = dirname(__DIR__, 2) . '/editor/php';
        require_once $editor . '/helpers.php';
        require_once $editor . '/license-check.php';
        require_once $editor . '/api/auth.php';
        self::$booted = true;
    }

    /**
     * Emit a 402 response if the site does not hold a valid license with
     * JSON API access for this domain. Called unconditionally at the top of
     * index.php so every /api/* route — public reads included — is gated in
     * one place.
     */
    public static function requireLicense(): void
    {
        self::boot();
        $state = \get_license_state();
        if (empty($state['valid'])) {
            Response::error(
                $state['message'] ?? 'Elements CMS API requires an active license for this domain.',
                402
            );
        }
        if (empty($state['limits']['api_tokens'])) {
            Response::error(
                'Elements CMS JSON API requires a plan with JSON API access for this domain.',
                402
            );
        }
    }

    /**
     * Resolve the Bearer key on the request, returning
     *   ['email' => ..., 'role' => ..., 'index' => int]
     * or null if no key was supplied / the key is invalid.
     *
     * If an MCP-family (`mcp_`) token is supplied, emits an immediate 401
     * pointing callers at the MCP endpoint — that's a misuse, not just a
     * miss, and the hint saves debugging time.
     */
    public static function resolveBearer(): ?array
    {
        self::boot();
        if (!\config_exists()) return null;

        $plaintext = \api_read_bearer_header();
        if ($plaintext === null) return null;

        $cfg = \load_config();
        $result = \api_resolve_bearer_token($cfg, $plaintext);

        if (!$result['ok']) {
            if (($result['reason'] ?? '') === 'wrong_family') {
                Response::json([
                    'success' => false,
                    'error'   => 'This key authenticates the MCP endpoint, not the JSON API. Generate an api_… key on the API admin page, or POST to /editor/mcp.php instead.',
                    'code'    => 401,
                    'timestamp' => date('c'),
                ], 401);
            }
            return null;
        }

        \api_touch_token($cfg, $result['index']);

        return [
            'email' => $result['email'],
            'role'  => $result['role'],
            'index' => $result['index'],
        ];
    }

    /**
     * Require a valid Bearer key. Emits a 401 if none is present. Returns
     * the resolved {email, role} record on success.
     */
    public static function require(): array
    {
        $resolved = self::resolveBearer();
        if ($resolved === null) {
            header('WWW-Authenticate: Bearer realm="api"');
            Response::error('A valid API key is required. Send Authorization: Bearer api_…', 401);
        }
        return $resolved;
    }

    /**
     * Load the editor config. Returns null if the install has not been set up.
     */
    public static function loadEditorConfig(): ?array
    {
        self::boot();
        if (!\config_exists()) return null;
        return \load_config();
    }
}
