<?php

/**
 * Public search-index endpoint for the cmsSearch frontend component.
 *
 * Lives outside /api/* so it is:
 *   - reachable as a literal file (no .htaccess / mod_rewrite required —
 *     works under PHP's built-in preview server), and
 *   - not subject to Auth::requireLicense(), which gates the JSON REST API.
 *
 * The REST equivalent at GET /api/cms/collections/search-index stays in
 * api/index.php for JSON API consumers; both paths share Search.php and the
 * on-disk cache.
 */

if (version_compare(PHP_VERSION, '8.1.0', '<')) {
    http_response_code(500);
    echo json_encode(['error' => 'PHP 8.1+ required']);
    exit;
}

require_once __DIR__ . '/api/vendor/autoload.php';

use CMS\Core\Request;
use CMS\Core\Response;
use CMS\Core\Security;

$config = require __DIR__ . '/api/config.php';

Response::cors();

$request = new Request();

if (!Security::validateRequest($request)) {
    Response::error('Access restricted to same-server requests.', 403);
}

$collectionPath = $request->input('collectionPath');
$pathDepth = (int) $request->input('pathDepth', 0);

if (!$collectionPath) {
    Response::error('collectionPath is required', 400);
}

$absolutePath = Security::resolveContentPath($request, $collectionPath, $pathDepth);
if (!$absolutePath) {
    $absolutePath = $config['cms']['base_path'] . '/' . $collectionPath;
    if (!is_dir($absolutePath)) {
        Response::error('Collection not found', 404);
    }
}

$resourcesWebPath = (string) $request->input('resourcesPath', '');
$resources = $config['resources'] ?? [];
if ($resourcesWebPath !== '') {
    if (strpos($resourcesWebPath, '..') === false && strpos($resourcesWebPath, "\0") === false) {
        $resources = ['path' => $resourcesWebPath];
    }
}

$cacheDir = sys_get_temp_dir() . '/cms-search-index';
$siteUrl = $request->input('site_url', '');
$cacheKey = $absolutePath . '|' . ($resources['path'] ?? '') . '|' . $siteUrl;
$cacheFile = $cacheDir . '/' . md5($cacheKey) . '.json';

if (!\CMS\Search::isCacheStale($absolutePath, $cacheFile)) {
    header('Content-Type: application/json; charset=utf-8');
    readfile($cacheFile);
    exit;
}

$query = cms(['resources' => $resources])
    ->collection($absolutePath)
    ->status('published')
    ->latest();

$pagePath = $request->input('page_path', '');
$tagPagePath = $request->input('tag_page_path', '');
$authorPagePath = $request->input('author_page_path', '');
$prettyUrls = cms_parse_bool($request->input('pretty_urls', null), true);

if ($pagePath) $query->pagePath($pagePath);
if ($tagPagePath) $query->tagPagePath($tagPagePath);
if ($authorPagePath) $query->authorPagePath($authorPagePath);
if ($siteUrl) $query->canonicalBaseUrl($siteUrl);
$query->prettyUrls($prettyUrls);

$items = $query->all();
\CMS\Search::generateIndex($items, $cacheFile);

header('Content-Type: application/json; charset=utf-8');
readfile($cacheFile);
exit;
