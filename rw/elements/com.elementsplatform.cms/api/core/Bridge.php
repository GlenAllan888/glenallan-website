<?php

namespace CMS\Core;

/**
 * Bridge a REST route into one of the editor's admin handlers.
 *
 * Each authenticated REST route resolves to roughly the same sequence:
 *   1. require an API key
 *   2. load editor config + license
 *   3. require_once the specific handler file
 *   4. prepare_handler_context() so the handler runs as the key's user
 *   5. install a response wrapper that re-emits the handler's JSON verbatim
 *   6. invoke the handler
 *
 * `Bridge::invoke()` collapses that into one call.
 */
class Bridge
{
    private static bool $booted = false;

    private static function boot(): void
    {
        if (self::$booted) return;
        $editor = dirname(__DIR__, 2) . '/editor/php';
        require_once $editor . '/helpers.php';
        require_once $editor . '/license-check.php';
        require_once $editor . '/handler-bridge.php';
        self::$booted = true;
    }

    /**
     * Invoke an admin handler on behalf of an authenticated REST caller.
     *
     *   $handlerFile   Relative path inside editor/php (e.g. 'handlers/files.php')
     *   $handlerFunc   Global function name (e.g. 'handle_files_create')
     *   $method        HTTP method the handler expects ('GET'/'POST')
     *   $args          Associative args merged into $_GET/$_POST/body
     *   $auth          Resolved {email, role, index} from Auth::require()
     */
    /**
     * Resolve a {collection} URL param (may be a numeric folder index or a
     * case-insensitive label slug) to an integer folder index.
     * Returns -1 if no folder matches.
     */
    public static function resolveCollection(array $cfg, string $collection): int
    {
        $folders = $cfg['folders'] ?? [];

        // Integer index path
        if (ctype_digit($collection)) {
            $idx = (int) $collection;
            return isset($folders[$idx]) ? $idx : -1;
        }

        // Slug match against label or path basename
        $slug = self::slugify($collection);
        foreach ($folders as $idx => $f) {
            if (self::slugify($f['label'] ?? '') === $slug) return $idx;
            if (self::slugify(basename($f['path'] ?? '')) === $slug) return $idx;
        }
        return -1;
    }

    public static function slugify(string $s): string
    {
        $s = strtolower(trim($s));
        $s = preg_replace('/[^a-z0-9]+/', '-', $s) ?? '';
        return trim($s, '-');
    }

    /**
     * Resolve a {slug} URL param to a concrete filename on disk.
     *
     * Items are stored as `YYYY-MM-DD-<slug>.md` or `<slug>.md`. The caller
     * already knows which folder; we scan it and match by slug. If the
     * caller passed a filename ending in .md, return it verbatim.
     *
     * Returns null if nothing matches.
     */
    public static function resolveFile(array $folder, string $slug, string $subpath = ''): ?string
    {
        if (str_ends_with($slug, '.md') || str_ends_with($slug, '.markdown')) {
            return $slug;
        }

        self::boot();
        $path = $folder['path'] ?? '';
        if ($subpath !== '') {
            $path = rtrim($path, '/') . '/' . ltrim($subpath, '/');
        }
        if (!is_dir($path)) return null;

        $wanted = self::slugify($slug);
        foreach (scandir($path) ?: [] as $entry) {
            if ($entry === '.' || $entry === '..') continue;
            if (!str_ends_with($entry, '.md')) continue;
            if (str_ends_with($entry, '.draft.md')) continue;
            $parsed = \parse_dated_filename($entry);
            if (self::slugify($parsed['slug']) === $wanted) {
                return $entry;
            }
        }
        return null;
    }

    public static function invoke(
        string $handlerFile,
        string $handlerFunc,
        string $method,
        array $args,
        array $auth
    ): never {
        self::boot();

        $editor = dirname(__DIR__, 2) . '/editor/php';
        $path = $editor . '/' . ltrim($handlerFile, '/');
        if (!file_exists($path)) {
            Response::error("Handler file missing: {$handlerFile}", 500);
        }
        require_once $path;

        if (!function_exists($handlerFunc)) {
            Response::error("Handler function missing: {$handlerFunc}", 500);
        }

        $cfg = \load_config();
        $license = \get_license_state();

        \handler_bridge_install(function (string $raw, int $status): void {
            // Re-emit the handler's JSON verbatim. Handlers already produce
            // either {"success": true, …} on success or {"error": "…"} on
            // failure — consistent enough for a v1 REST surface.
            http_response_code($status);
            header('Content-Type: application/json; charset=utf-8');
            header('X-Content-Type-Options: nosniff');
            echo $raw;
        });

        \handler_bridge_prepare_context(
            $args,
            $method,
            $cfg,
            $auth['email'],
            function (string $msg, int $status): void {
                Response::error($msg, $status);
            }
        );

        $handlerFunc($cfg, $license);
        // Handler exits via json_response(); shutdown function rewraps.
        exit;
    }
}
