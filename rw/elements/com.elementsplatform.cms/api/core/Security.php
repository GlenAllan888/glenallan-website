<?php

namespace CMS\Core;

class Security
{
    /**
     * Validate that the request originates from the same server.
     * Checks Referer and Origin headers against the request host.
     * Allows localhost requests without headers for development.
     */
    public static function validateRequest(Request $request): bool
    {
        $host = $request->host();

        // Allow localhost requests
        if (self::isLocalhost($host)) {
            return true;
        }

        // Check Referer header
        $referer = $request->referer();
        if ($referer) {
            $refererHost = parse_url($referer, PHP_URL_HOST);
            $refererPort = parse_url($referer, PHP_URL_PORT);
            $refererHostWithPort = $refererPort ? "{$refererHost}:{$refererPort}" : $refererHost;

            if ($refererHostWithPort === $host || $refererHost === $host) {
                return true;
            }
        }

        // Check Origin header
        $origin = $request->origin();
        if ($origin) {
            $originHost = parse_url($origin, PHP_URL_HOST);
            $originPort = parse_url($origin, PHP_URL_PORT);
            $originHostWithPort = $originPort ? "{$originHost}:{$originPort}" : $originHost;

            if ($originHostWithPort === $host || $originHost === $host) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if a host is a localhost variant.
     */
    private static function isLocalhost(string $host): bool
    {
        // Strip port
        $hostname = explode(':', $host)[0];

        if (in_array($hostname, ['localhost', '127.0.0.1', '::1', '0.0.0.0'], true)) {
            return true;
        }

        // Check 127.x.x.x range
        if (str_starts_with($hostname, '127.')) {
            return true;
        }

        // Check *.local domains
        if (str_ends_with($hostname, '.local')) {
            return true;
        }

        return false;
    }

    /**
     * Resolve a content path from the request context.
     * Uses the HTTP Referer to determine the page's location on the filesystem,
     * then resolves relative paths from there.
     */
    public static function resolveContentPath(Request $request, string $collectionPath, int $pathDepth = 0): ?string
    {
        $referer = $request->referer();
        if (!$referer) {
            return null;
        }

        // Get server root and site base path
        $scriptName = $request->scriptName();
        $scriptFilename = $request->scriptFilename();

        // Split on /rw/ to find site base
        $apiDir = dirname($scriptName);
        $parts = explode('/rw/', $apiDir, 2);
        $siteBasePath = $parts[0] ?? '';

        $fsParts = explode('/rw/', dirname($scriptFilename), 2);
        $serverRoot = $fsParts[0] ?? '';

        // Remove duplicate site subdirectory from server root if present
        if ($siteBasePath && str_ends_with($serverRoot, $siteBasePath)) {
            $serverRoot = substr($serverRoot, 0, -strlen($siteBasePath));
        }

        // The calling page's URL path comes from the Referer. RW Elements
        // publishes rw/elements/.../*.php either per-page (script URL has the
        // page prefix) or shared at site root (script URL has no page
        // prefix), so the script's own location can't identify the calling
        // page in both layouts. The Referer host is validated in
        // validateRequest(); the resolved path is further constrained by the
        // is_dir() + is_readable() check below.
        $refererPath = parse_url($referer, PHP_URL_PATH) ?: '/';
        if (str_ends_with($refererPath, '/')) {
            $pageDir = rtrim($refererPath, '/');
        } else {
            $pageDir = dirname($refererPath);
        }

        $basePath = $serverRoot . $pageDir;
        for ($i = 0; $i < $pathDepth; $i++) {
            $basePath = dirname($basePath);
        }

        // Clean collection path
        $collectionPath = ltrim($collectionPath, './');
        $collectionPath = ltrim($collectionPath, '/');

        $absolutePath = $basePath . '/' . $collectionPath;

        // Validate
        if (!is_dir($absolutePath) || !is_readable($absolutePath)) {
            return null;
        }

        return $absolutePath;
    }
}
