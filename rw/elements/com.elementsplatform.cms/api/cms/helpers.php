<?php

/**
 * CMS v2 Global Helper Functions
 *
 * These functions are auto-loaded via Composer and available in all templates.
 */

use CMS\CMS;

if (!function_exists('ecms_normalize_text_encoding')) {
    /**
     * Normalize text content to UTF-8 while leaving obvious binary data alone.
     */
    function ecms_normalize_text_encoding(string $content): string
    {
        if ($content === '') {
            return $content;
        }

        if (str_starts_with($content, "\xEF\xBB\xBF")) {
            $content = substr($content, 3);
        }

        if (mb_check_encoding($content, 'UTF-8')) {
            return $content;
        }

        if (str_contains($content, "\0")) {
            return $content;
        }

        $converted = mb_convert_encoding($content, 'UTF-8', 'Windows-1252');
        return mb_check_encoding($converted, 'UTF-8') ? $converted : $content;
    }
}

if (!function_exists('cms_parse_bool')) {
    /**
     * Parse request booleans from JSON bodies and query strings.
     */
    function cms_parse_bool(mixed $value, bool $default = false): bool
    {
        if ($value === null) {
            return $default;
        }

        if (is_bool($value)) {
            return $value;
        }

        if (is_int($value) || is_float($value)) {
            if ((float) $value === 1.0) {
                return true;
            }
            if ((float) $value === 0.0) {
                return false;
            }
            return $default;
        }

        if (is_string($value)) {
            $normalized = strtolower(trim($value));
            if ($normalized === 'true' || $normalized === '1') {
                return true;
            }
            if ($normalized === 'false' || $normalized === '0') {
                return false;
            }
        }

        return $default;
    }
}

/**
 * Get or create a CMS instance.
 */
function cms(array $options = []): CMS
{
    static $instances = [];

    $key = md5(serialize($options));
    if (!isset($instances[$key])) {
        $instances[$key] = new CMS($options);
    }

    return $instances[$key];
}

/**
 * Shorthand for cms()->collection().
 */
function collection(string $path, array $options = []): \CMS\CollectionBuilder
{
    return cms($options)->collection($path);
}

/**
 * Shorthand for cms()->item().
 */
function item(string $path, ?string $slug = null, array $options = []): ?\CMS\Item
{
    return cms($options)->item($path, $slug, $options);
}

// --- Cross-template data sharing ---

/**
 * Store a value for cross-template access.
 * Replaces direct $GLOBALS usage with a namespaced approach.
 */
function ecms_set(string $key, mixed $value): void
{
    $GLOBALS['_ecms'][$key] = $value;
}

/**
 * Retrieve a stored value.
 */
function ecms_get(string $key, mixed $default = null): mixed
{
    return $GLOBALS['_ecms'][$key] ?? $default;
}

/**
 * Check if a key exists in the store.
 */
function ecms_has(string $key): bool
{
    return isset($GLOBALS['_ecms'][$key]);
}

/**
 * Resolve a relative web path to an absolute web path.
 * Handles "../" traversal from a base directory.
 *
 * @param string $currentDir  The current directory (e.g., dirname of SCRIPT_NAME)
 * @param string $relativePath The relative path to resolve (may contain "../")
 * @return string Absolute web path
 */
function resolveToAbsoluteWebPath(string $currentDir, string $relativePath): string
{
    $relativePath = trim($relativePath);
    if (empty($relativePath) || $relativePath === '.' || $relativePath === './') {
        return $currentDir;
    }
    if (str_starts_with($relativePath, '/')) {
        return '/' . trim($relativePath, '/');
    }
    if (str_starts_with($relativePath, 'http')) {
        return $relativePath;
    }
    $base = array_values(array_filter(explode('/', trim($currentDir, '/')), fn($p) => $p !== ''));
    foreach (explode('/', $relativePath) as $segment) {
        if ($segment === '..') {
            array_pop($base);
        } elseif ($segment !== '.' && $segment !== '') {
            $base[] = $segment;
        }
    }
    $result = '/' . implode('/', $base);
    return rtrim($result, '/');
}

/**
 * Strip a trailing *.php filename from a page path.
 * Used when building pretty URLs so "/blog/post.php" becomes "/blog"
 * before the slug is appended. Non-pretty URLs keep the filename since
 * the query string must be appended to the real PHP file.
 */
function cms_strip_page_filename(string $path): string
{
    if ($path === '') {
        return $path;
    }
    $basename = basename($path);
    if (preg_match('/\.php$/i', $basename)) {
        $parent = dirname($path);
        return ($parent === '.' || $parent === '') ? '' : $parent;
    }
    return $path;
}

/**
 * Detect the current request origin for absolute URL generation.
 */
function cms_detect_site_url(): ?string
{
    $host = $_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? '';
    if ($host === '') {
        return null;
    }

    $https = $_SERVER['HTTPS'] ?? '';
    $scheme = (!empty($https) && strtolower((string) $https) !== 'off') ? 'https' : 'http';

    return $scheme . '://' . $host;
}

/**
 * Resolve a canonical base URL from explicit options or the current request.
 */
function cms_canonical_base_url(array $options = []): ?string
{
    $baseUrl = $options['canonical_base_url'] ?? $options['site_url'] ?? null;
    if (is_string($baseUrl) && trim($baseUrl) !== '') {
        return rtrim(trim($baseUrl), '/');
    }

    return cms_detect_site_url();
}
