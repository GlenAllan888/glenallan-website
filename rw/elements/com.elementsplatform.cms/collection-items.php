<?php

/**
 * Public collection-items endpoint for the cmsCollectionLoadMore frontend
 * component.
 *
 * Lives outside /api/* so it is:
 *   - reachable as a literal file (no .htaccess / mod_rewrite required —
 *     works under PHP's built-in preview server), and
 *   - not subject to Auth::requireLicense(), which gates the JSON REST API.
 *
 * The REST equivalent at POST /api/cms/collections/items stays in
 * api/index.php for JSON API consumers; both paths share the same query and
 * pagination logic.
 */

if (version_compare(PHP_VERSION, '8.1.0', '<')) {
    http_response_code(500);
    echo json_encode(['error' => 'PHP 8.1+ required']);
    exit;
}

require_once __DIR__ . '/api/vendor/autoload.php';
// Required so renderTemplate() exists when callers pass an `item_template`
// for server-side Twig rendering.
require_once __DIR__ . '/api/twig-setup.php';

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
$pathDepth      = (int) $request->input('pathDepth', 0);

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

// --- Listing logic mirrors $listItemsAt in api/index.php ----------------
// Kept in sync so the public same-origin endpoint and the gated REST route
// return identical payloads.

$query = cms(['resources' => $config['resources'] ?? []])
    ->collection($absolutePath);

$pagePath       = $request->input('page_path', '');
$tagPagePath    = $request->input('tag_page_path', '');
$authorPagePath = $request->input('author_page_path', '');
$prettyUrls     = cms_parse_bool($request->input('pretty_urls', null), true);
$siteUrl        = $request->input('site_url', '');

if ($pagePath) $query->pagePath($pagePath);
if ($tagPagePath) $query->tagPagePath($tagPagePath);
if ($authorPagePath) $query->authorPagePath($authorPagePath);
if ($siteUrl) $query->canonicalBaseUrl($siteUrl);
$query->prettyUrls($prettyUrls);

$status     = $request->input('status');
$featured   = $request->input('featured');
$tags       = $request->input('tags');
$author     = $request->input('author');
$dateBefore = $request->input('date_before');
$dateAfter  = $request->input('date_after');

if ($status) $query->status($status);
if ($featured !== null && $featured !== '') $query->filter(['featured' => $featured]);
if ($tags) $query->tags($tags);
if ($author) $query->author($author);
if ($dateBefore) $query->before($dateBefore);
if ($dateAfter) $query->after($dateAfter);

$orderBy   = $request->input('orderBy', 'date_published');
$direction = $request->input('direction', 'desc');
$query->orderBy($orderBy, $direction);

$offset = (int) $request->input('offset', 0);
if ($offset > 0) $query->offset($offset);

$page    = (int) $request->input('page', 1);
$perPage = (int) $request->input('per_page', $config['pagination']['default_per_page']);
$perPage = min($perPage, $config['pagination']['max_per_page']);

$query->paginate($page, $perPage);

$result = $query->get();

$itemTemplate = $request->input('item_template');
$items = array_map(function ($item) use ($itemTemplate) {
    $data = $item->toArray();

    if ($itemTemplate) {
        try {
            $data['rendered_template'] = renderTemplate($itemTemplate, ['item' => $item]);
        } catch (\Exception $e) {
            $data['rendered_template'] = '';
        }
    }

    return $data;
}, $result->items);

Response::paginated($items, [
    'currentPage' => $result->pagination['current_page'],
    'lastPage'    => $result->pagination['total_pages'],
    'totalItems'  => $result->pagination['total_items'],
    'perPage'     => $result->pagination['items_per_page'],
    'has_prev'    => $result->pagination['has_prev'],
    'has_next'    => $result->pagination['has_next'],
]);
