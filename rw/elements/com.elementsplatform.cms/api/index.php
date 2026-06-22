<?php

/**
 * CMS v2 API Entry Point
 *
 * Single entry point for all API requests.
 * Routes are defined below, dispatched via a simple regex router.
 */

// PHP version check
if (version_compare(PHP_VERSION, '8.1.0', '<')) {
    http_response_code(500);
    echo json_encode(['error' => 'PHP 8.1+ required']);
    exit;
}

// Autoload
require_once __DIR__ . '/vendor/autoload.php';

use CMS\Core\Router;
use CMS\Core\Request;
use CMS\Core\Response;
use CMS\Core\Security;
use CMS\Core\Auth;
use CMS\Core\Bridge;

// Load config
$config = require __DIR__ . '/config.php';

// CORS
Response::cors();

// Pro-only: every /api/* route (public reads included) requires an active
// license for this domain. Sits at the top so unlicensed installs return
// 402 on every route without per-route drift.
Auth::requireLicense();

// Initialize
$router = new Router();
$request = new Request();

// Security: validate same-server origin for unauthenticated requests.
// Token-authenticated requests (Bearer api_…) are allowed cross-origin so
// headless clients on other hosts can call the API.
$hasToken = Auth::resolveBearer() !== null;
if (!$hasToken && !Security::validateRequest($request)) {
    Response::error('API access restricted to same-server requests. Send an API key to call cross-origin.', 403);
}

/**
 * Fire a webhook using the editor's webhook list. The editor's config is loaded
 * on demand because webhooks are managed there, not in the public API config.
 * No-op when the editor isn't installed alongside the public API.
 */
function dispatch_editor_webhook(string $event, array $data): void {
    static $editorCfg = null;
    static $loaded = false;
    if (!$loaded) {
        $loaded = true;
        $dispatchFile = __DIR__ . '/../editor/php/webhook-dispatch.php';
        $configFile = __DIR__ . '/../editor/php/config.php';
        if (is_file($dispatchFile) && is_file($configFile)) {
            require_once $dispatchFile;
            $cfg = @include $configFile;
            if (is_array($cfg)) {
                $editorCfg = $cfg;
            }
        }
    }
    if ($editorCfg !== null && function_exists('dispatch_webhooks')) {
        dispatch_webhooks($editorCfg, $event, $data);
    }
}

// --- Status Routes ---

$router->get('/', function () use ($config) {
    Response::json([
        'success' => true,
        'message' => 'CMS API running',
        'version' => $config['app']['version'],
    ]);
});

$router->get('/status', function () use ($config) {
    Response::json([
        'success' => true,
        'message' => 'CMS API running',
        'version' => $config['app']['version'],
    ]);
});

// --- CMS Collection Routes ---

$router->get('/cms/collections', function () {
    $cfg = Auth::loadEditorConfig();
    if ($cfg === null) {
        Response::error('CMS is not set up yet.', 503);
    }

    $collections = [];
    foreach (($cfg['folders'] ?? []) as $i => $f) {
        $label = $f['label'] ?? '';
        $path  = $f['path'] ?? '';
        $collections[] = [
            'index' => $i,
            'label' => $label,
            'slug'  => Bridge::slugify($label !== '' ? $label : basename($path)),
            'path'  => $path,
        ];
    }

    Response::success($collections, count($collections));
});

/** List items at $absolutePath, reading filters/pagination/etc. from the request. */
$listItemsAt = function (string $absolutePath) use ($request, $config) {
    $query = cms(['resources' => $config['resources'] ?? []])
        ->collection($absolutePath);

    // Apply page/tag/author paths
    $pagePath = $request->input('page_path', '');
    $tagPagePath = $request->input('tag_page_path', '');
    $authorPagePath = $request->input('author_page_path', '');
    $prettyUrls = cms_parse_bool($request->input('pretty_urls', null), true);
    $siteUrl = $request->input('site_url', '');

    if ($pagePath) $query->pagePath($pagePath);
    if ($tagPagePath) $query->tagPagePath($tagPagePath);
    if ($authorPagePath) $query->authorPagePath($authorPagePath);
    if ($siteUrl) $query->canonicalBaseUrl($siteUrl);
    $query->prettyUrls($prettyUrls);

    // Apply filters
    $status = $request->input('status');
    $featured = $request->input('featured');
    $tags = $request->input('tags');
    $author = $request->input('author');
    $dateBefore = $request->input('date_before');
    $dateAfter = $request->input('date_after');

    if ($status) $query->status($status);
    if ($featured !== null && $featured !== '') $query->filter(['featured' => $featured]);
    if ($tags) $query->tags($tags);
    if ($author) $query->author($author);
    if ($dateBefore) $query->before($dateBefore);
    if ($dateAfter) $query->after($dateAfter);

    // Apply sorting
    $orderBy = $request->input('orderBy', 'date_published');
    $direction = $request->input('direction', 'desc');
    $query->orderBy($orderBy, $direction);

    // Apply offset
    $offset = (int) $request->input('offset', 0);
    if ($offset > 0) $query->offset($offset);

    // Pagination
    $page = (int) $request->input('page', 1);
    $perPage = (int) $request->input('per_page', $config['pagination']['default_per_page']);
    $perPage = min($perPage, $config['pagination']['max_per_page']);

    $query->paginate($page, $perPage);

    $result = $query->get();

    // Template rendering (POST with item_template)
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
        'lastPage' => $result->pagination['total_pages'],
        'totalItems' => $result->pagination['total_items'],
        'perPage' => $result->pagination['items_per_page'],
        'has_prev' => $result->pagination['has_prev'],
        'has_next' => $result->pagination['has_next'],
    ]);
};

/** Read a single item at $absolutePath by slug and respond. */
$readItemAt = function (string $absolutePath, string $slug) use ($config) {
    $item = \CMS\Collection::getBySlug($absolutePath, $slug, ['resources' => $config['resources'] ?? []]);
    if (!$item) {
        Response::notFound('Item not found');
    }
    Response::success($item->toArray());
};

/**
 * Resolve a public {collection} URL param (index or slug) to its absolute
 * filesystem path via the editor config. 503s if the install isn't set up,
 * 404s if no folder matches.
 */
$resolvePublicCollectionPath = function (string $collection): string {
    $cfg = Auth::loadEditorConfig();
    if ($cfg === null) {
        Response::error('CMS is not set up yet.', 503);
    }
    $idx = Bridge::resolveCollection($cfg, $collection);
    if ($idx < 0) {
        Response::notFound("Unknown collection: {$collection}");
    }
    return (string) ($cfg['folders'][$idx]['path'] ?? '');
};

$router->any('/cms/collections/items', function () use ($request, $config, $listItemsAt) {
    $collectionPath = $request->input('collectionPath');
    $pathDepth = (int) $request->input('pathDepth', 0);

    if (!$collectionPath) {
        Response::error('collectionPath is required', 400);
    }

    // Resolve path
    $absolutePath = Security::resolveContentPath($request, $collectionPath, $pathDepth);
    if (!$absolutePath) {
        // Fallback: try as absolute or relative to base
        $absolutePath = $config['cms']['base_path'] . '/' . $collectionPath;
        if (!is_dir($absolutePath)) {
            Response::error('Collection not found', 404);
        }
    }

    $listItemsAt($absolutePath);
});

$router->get('/cms/collections/items/{slug}', function (string $slug) use ($request, $config, $readItemAt) {
    $collectionPath = $request->input('collectionPath');
    $pathDepth = (int) $request->input('pathDepth', 0);

    $absolutePath = null;
    if ($collectionPath) {
        $absolutePath = Security::resolveContentPath($request, $collectionPath, $pathDepth);
    }
    if (!$absolutePath) {
        $absolutePath = $config['cms']['base_path'] . '/' . ($collectionPath ?? '');
    }

    $readItemAt($absolutePath, $slug);
});

// RESTful public read routes resolve {collection} through the editor config
// (same source as GET /cms/collections), so callers can round-trip the slug
// or index returned by that endpoint without also passing collectionPath.
$router->get('/cms/collections/{collection}/items', function (string $collection) use ($resolvePublicCollectionPath, $listItemsAt) {
    $listItemsAt($resolvePublicCollectionPath($collection));
});

$router->get('/cms/collections/{collection}/items/{slug}', function (string $collection, string $slug) use ($resolvePublicCollectionPath, $readItemAt) {
    $readItemAt($resolvePublicCollectionPath($collection), $slug);
});

// --- Individual Items ---

$router->get('/cms/items/related', function () use ($request, $config) {
    $contentPath = $request->input('contentPath');
    $by = $request->input('by', 'tags');
    $limit = (int) $request->input('limit', 5);
    $pagePath = $request->input('page_path', '');
    $prettyUrls = cms_parse_bool($request->input('pretty_urls', null), true);
    $siteUrl = $request->input('site_url', '');

    if (!$contentPath) {
        Response::error('contentPath is required', 400);
    }

    // Load the source item
    $item = \CMS\Item::fromFile($contentPath, ['resources' => $config['resources'] ?? []]);
    if (!$item) {
        Response::error('Item not found', 404);
    }

    $criteria = array_map('trim', explode(',', $by));
    $collectionDir = dirname($contentPath);
    $related = \CMS\Collection::getRelated($collectionDir, $item, $criteria, $limit, ['resources' => $config['resources'] ?? []]);

    // Generate URLs
    if ($pagePath) {
        $effectivePagePath = $prettyUrls ? cms_strip_page_filename($pagePath) : $pagePath;
        $normalizedPath = rtrim($effectivePagePath, '/') . '/';
        foreach ($related as $relItem) {
            $url = $prettyUrls
                ? $normalizedPath . $relItem->slug()
                : $normalizedPath . '?item=' . $relItem->slug();
            $relItem->setUrl($url);
            $relItem->setCanonicalBaseUrl($siteUrl ?: cms_detect_site_url());
        }
    }

    $data = array_map(fn($item) => $item->toArray(), $related);
    Response::success($data, count($data));
});

$router->get('/cms/items/{slug}', function (string $slug) use ($request, $config) {
    // Search across all collections for the slug
    $basePath = $config['cms']['base_path'];
    $collections = \CMS\Collection::discoverCollections($basePath);

    foreach ($collections as $collection) {
        $item = \CMS\Collection::getBySlug($collection['path'], $slug, ['resources' => $config['resources'] ?? []]);
        if ($item) {
            Response::success($item->toArray());
        }
    }

    Response::notFound('Item not found');
});

// --- RSS & Sitemap ---

$router->get('/cms/collections/{collection}/rss', function (string $collection) use ($request, $config) {
    $collectionPath = $config['cms']['base_path'] . '/' . $collection;
    if (!is_dir($collectionPath)) {
        Response::error('Collection not found', 404);
    }

    $title = $request->input('title', $collection);
    $description = $request->input('description', '');
    $link = $request->input('link', '');
    $limit = (int) $request->input('limit', 20);

    $xml = cms(['resources' => $config['resources'] ?? []])
        ->collection($collectionPath)
        ->status('published')
        ->latest()
        ->limit($limit)
        ->rss($title, $description, $link);

    Response::rss($xml);
});

$router->get('/cms/collections/{collection}/sitemap', function (string $collection) use ($request, $config) {
    $collectionPath = $config['cms']['base_path'] . '/' . $collection;
    if (!is_dir($collectionPath)) {
        Response::error('Collection not found', 404);
    }

    $baseUrl = $request->input('baseUrl', '');
    $limit = (int) $request->input('limit', 1000);

    $xml = cms(['resources' => $config['resources'] ?? []])
        ->collection($collectionPath)
        ->status('published')
        ->latest()
        ->limit($limit)
        ->sitemap($baseUrl);

    Response::xml($xml);
});

// --- Search Index ---

$router->get('/cms/collections/search-index', function () use ($request, $config) {
    $collectionPath = $request->input('collectionPath');
    $pathDepth = (int) $request->input('pathDepth', 0);

    if (!$collectionPath) {
        Response::error('collectionPath is required', 400);
    }

    // Resolve path
    $absolutePath = Security::resolveContentPath($request, $collectionPath, $pathDepth);
    if (!$absolutePath) {
        $absolutePath = $config['cms']['base_path'] . '/' . $collectionPath;
        if (!is_dir($absolutePath)) {
            Response::error('Collection not found', 404);
        }
    }

    // Resources path is a web URL prefix used by the image resolver. The
    // caller sends an absolute web path (e.g. "/site/resources") resolved from
    // the client page's location, so we can use it verbatim. Falls back to
    // server config when the caller doesn't supply one.
    $resourcesWebPath = (string) $request->input('resourcesPath', '');
    $resources = $config['resources'] ?? [];
    if ($resourcesWebPath !== '') {
        // Defense-in-depth: reject anything that still contains traversal
        // segments or protocol markers. The client-side resolver should have
        // already flattened them.
        if (strpos($resourcesWebPath, '..') === false && strpos($resourcesWebPath, "\0") === false) {
            $resources = ['path' => $resourcesWebPath];
        }
    }

    // Cache key includes the resources path so two pages with different
    // resources roots don't collide on the same cached index.
    $cacheDir = sys_get_temp_dir() . '/cms-search-index';
    $siteUrl = $request->input('site_url', '');
    $cacheKey = $absolutePath . '|' . ($resources['path'] ?? '') . '|' . $siteUrl;
    $cacheFile = $cacheDir . '/' . md5($cacheKey) . '.json';

    if (!\CMS\Search::isCacheStale($absolutePath, $cacheFile)) {
        header('Content-Type: application/json; charset=utf-8');
        readfile($cacheFile);
        exit;
    }

    // Rebuild index
    $query = cms(['resources' => $resources])
        ->collection($absolutePath)
        ->status('published')
        ->latest();

    // Apply URL paths
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
});

// --- Tags ---

$router->get('/cms/tags', function () use ($request, $config) {
    $contentPath = $request->input('content_path');
    if (!$contentPath) {
        Response::error('content_path is required', 400);
    }

    $tagPagePath = $request->input('tag_page_path', '');
    $prettyUrls = cms_parse_bool($request->input('pretty_urls', null), true);

    $tags = \CMS\Tags::getAll($contentPath, $tagPagePath, $prettyUrls);
    Response::success($tags, count($tags));
});

$router->get('/cms/tags/{tag}/items', function (string $tag) use ($request, $config) {
    $contentPath = $request->input('content_path');
    if (!$contentPath) {
        Response::error('content_path is required', 400);
    }

    $items = \CMS\Collection::discover($contentPath, ['resources' => $config['resources'] ?? []]);
    $items = \CMS\Collection::filter($items, ['tags' => $tag, 'status' => 'published']);
    $items = \CMS\Collection::sort($items, 'date_published', 'desc');

    $page = (int) $request->input('page', 1);
    $perPage = (int) $request->input('per_page', $config['pagination']['default_per_page']);
    $result = \CMS\Collection::paginate($items, $page, $perPage);

    $data = array_map(fn($item) => $item->toArray(), $result['items']);
    Response::paginated($data, [
        'currentPage' => $result['pagination']['current_page'],
        'lastPage' => $result['pagination']['total_pages'],
        'totalItems' => $result['pagination']['total_items'],
        'perPage' => $result['pagination']['items_per_page'],
        'has_prev' => $result['pagination']['has_prev'],
        'has_next' => $result['pagination']['has_next'],
    ]);
});

// ---------------------------------------------------------------------------
// Authenticated REST surface
// ---------------------------------------------------------------------------
// These routes bridge into the existing /editor/php/handlers/*.php functions
// via CMS\Core\Bridge. Each resolves the API key, loads the editor config,
// translates {collection} (name or integer index) to a folder index, and
// invokes the admin handler as the key's user.
//
// Write routes require Auth::require() up front. Read routes allow an
// optional token (exposes drafts if supplied, published-only otherwise).

/** Look up the folder index for a {collection} URL param; 404s on miss. */
$resolveCollectionOr404 = function (string $collection) {
    $cfg = Auth::loadEditorConfig();
    if ($cfg === null) {
        Response::error('CMS is not set up yet.', 503);
    }
    $idx = Bridge::resolveCollection($cfg, $collection);
    if ($idx < 0) {
        Response::notFound("Unknown collection: {$collection}");
    }
    return ['cfg' => $cfg, 'folder_index' => $idx];
};

// --- Items -----------------------------------------------------------------

$router->post('/cms/collections/{collection}/items', function (string $collection) use ($request, $resolveCollectionOr404) {
    $auth = Auth::require();
    $ctx = $resolveCollectionOr404($collection);

    $body = $request->json();
    $args = array_merge(is_array($body) ? $body : [], [
        'folder' => $ctx['folder_index'],
    ]);

    Bridge::invoke('handlers/files.php', 'handle_files_create', 'POST', $args, $auth);
});

$router->put('/cms/collections/{collection}/items/{slug}', function (string $collection, string $slug) use ($request, $resolveCollectionOr404) {
    $auth = Auth::require();
    $ctx = $resolveCollectionOr404($collection);
    $folder = $ctx['cfg']['folders'][$ctx['folder_index']];

    $body = is_array($request->json()) ? $request->json() : [];
    $subpath = (string) ($body['subpath'] ?? $request->get('subpath', ''));
    $filename = Bridge::resolveFile($folder, $slug, $subpath);
    if ($filename === null) {
        Response::notFound("Unknown item: {$slug}");
    }

    $args = array_merge($body, [
        'folder' => $ctx['folder_index'],
        'file'   => $filename,
    ]);
    Bridge::invoke('handlers/files.php', 'handle_files_update', 'POST', $args, $auth);
});

$router->patch('/cms/collections/{collection}/items/{slug}', function (string $collection, string $slug) use ($request, $resolveCollectionOr404) {
    // PATCH and PUT share the same update handler; the handler already merges
    // submitted fields over existing ones, so a partial body is a valid PATCH.
    $auth = Auth::require();
    $ctx = $resolveCollectionOr404($collection);
    $folder = $ctx['cfg']['folders'][$ctx['folder_index']];

    $body = is_array($request->json()) ? $request->json() : [];
    $subpath = (string) ($body['subpath'] ?? $request->get('subpath', ''));
    $filename = Bridge::resolveFile($folder, $slug, $subpath);
    if ($filename === null) {
        Response::notFound("Unknown item: {$slug}");
    }

    $args = array_merge($body, [
        'folder' => $ctx['folder_index'],
        'file'   => $filename,
    ]);
    Bridge::invoke('handlers/files.php', 'handle_files_update', 'POST', $args, $auth);
});

$router->delete('/cms/collections/{collection}/items/{slug}', function (string $collection, string $slug) use ($request, $resolveCollectionOr404) {
    $auth = Auth::require();
    $ctx = $resolveCollectionOr404($collection);
    $folder = $ctx['cfg']['folders'][$ctx['folder_index']];

    $subpath = (string) $request->get('subpath', '');
    $filename = Bridge::resolveFile($folder, $slug, $subpath);
    if ($filename === null) {
        Response::notFound("Unknown item: {$slug}");
    }

    Bridge::invoke('handlers/files.php', 'handle_files_delete', 'POST', [
        'folder'  => $ctx['folder_index'],
        'file'    => $filename,
        'subpath' => $subpath,
    ], $auth);
});

// Authenticated read that returns raw frontmatter+body (unlike the public
// read route which returns rendered item data). Useful for editors/migrators.
$router->get('/cms/collections/{collection}/items/{slug}/raw', function (string $collection, string $slug) use ($request, $resolveCollectionOr404) {
    $auth = Auth::require();
    $ctx = $resolveCollectionOr404($collection);
    $folder = $ctx['cfg']['folders'][$ctx['folder_index']];

    $subpath = (string) $request->get('subpath', '');
    $filename = Bridge::resolveFile($folder, $slug, $subpath);
    if ($filename === null) {
        Response::notFound("Unknown item: {$slug}");
    }

    Bridge::invoke('handlers/files.php', 'handle_files_read', 'GET', [
        'folder'  => $ctx['folder_index'],
        'file'    => $filename,
        'subpath' => $subpath,
    ], $auth);
});

// --- Resources -------------------------------------------------------------

$router->get('/cms/resources', function () use ($request) {
    $auth = Auth::require();
    Bridge::invoke('handlers/resources.php', 'handle_resources_list', 'GET', [
        'folder'  => (int) $request->get('folder', 0),
        'subpath' => (string) $request->get('subpath', ''),
    ], $auth);
});

$router->post('/cms/resources', function () use ($request) {
    $auth = Auth::require();
    $body = is_array($request->json()) ? $request->json() : [];
    Bridge::invoke('handlers/resources.php', 'handle_resources_upload', 'POST', $body, $auth);
});

$router->patch('/cms/resources', function () use ($request) {
    // Rename or move depending on body shape: {from, to} for same-folder
    // rename; {from_folder, from_subpath, to_folder, to_subpath, filename}
    // for cross-folder move.
    $auth = Auth::require();
    $body = is_array($request->json()) ? $request->json() : [];
    $op = (string) ($body['op'] ?? 'rename');
    $func = $op === 'move' ? 'handle_resources_move' : 'handle_resources_rename';
    Bridge::invoke('handlers/resources.php', $func, 'POST', $body, $auth);
});

$router->delete('/cms/resources', function () use ($request) {
    $auth = Auth::require();
    $body = is_array($request->json()) ? $request->json() : [];
    // Allow filename+folder+subpath via query string too.
    $args = array_merge([
        'folder'   => (int) $request->get('folder', 0),
        'subpath'  => (string) $request->get('subpath', ''),
        'filename' => (string) $request->get('filename', ''),
    ], $body);
    Bridge::invoke('handlers/resources.php', 'handle_resources_delete', 'POST', $args, $auth);
});

$router->post('/cms/resources/folders', function () use ($request) {
    $auth = Auth::require();
    $body = is_array($request->json()) ? $request->json() : [];
    Bridge::invoke('handlers/resources.php', 'handle_resources_create_folder', 'POST', $body, $auth);
});

// --- Versions (Pro) --------------------------------------------------------

$router->get('/cms/collections/{collection}/items/{slug}/versions', function (string $collection, string $slug) use ($request, $resolveCollectionOr404) {
    $auth = Auth::require();
    $ctx = $resolveCollectionOr404($collection);
    $folder = $ctx['cfg']['folders'][$ctx['folder_index']];

    $subpath = (string) $request->get('subpath', '');
    $filename = Bridge::resolveFile($folder, $slug, $subpath);
    if ($filename === null) {
        Response::notFound("Unknown item: {$slug}");
    }
    Bridge::invoke('handlers/versions.php', 'handle_versions_list', 'GET', [
        'folder'  => $ctx['folder_index'],
        'file'    => $filename,
        'subpath' => $subpath,
    ], $auth);
});

$router->get('/cms/collections/{collection}/items/{slug}/versions/{version}', function (string $collection, string $slug, string $version) use ($request, $resolveCollectionOr404) {
    $auth = Auth::require();
    $ctx = $resolveCollectionOr404($collection);
    $folder = $ctx['cfg']['folders'][$ctx['folder_index']];

    $subpath = (string) $request->get('subpath', '');
    $filename = Bridge::resolveFile($folder, $slug, $subpath);
    if ($filename === null) {
        Response::notFound("Unknown item: {$slug}");
    }
    Bridge::invoke('handlers/versions.php', 'handle_versions_read', 'GET', [
        'folder'  => $ctx['folder_index'],
        'file'    => $filename,
        'subpath' => $subpath,
        'version' => $version,
    ], $auth);
});

$router->post('/cms/collections/{collection}/items/{slug}/versions/{version}/restore', function (string $collection, string $slug, string $version) use ($request, $resolveCollectionOr404) {
    $auth = Auth::require();
    $ctx = $resolveCollectionOr404($collection);
    $folder = $ctx['cfg']['folders'][$ctx['folder_index']];

    $body = is_array($request->json()) ? $request->json() : [];
    $subpath = (string) ($body['subpath'] ?? $request->get('subpath', ''));
    $filename = Bridge::resolveFile($folder, $slug, $subpath);
    if ($filename === null) {
        Response::notFound("Unknown item: {$slug}");
    }
    Bridge::invoke('handlers/versions.php', 'handle_versions_restore', 'POST', [
        'folder'  => $ctx['folder_index'],
        'file'    => $filename,
        'subpath' => $subpath,
        'version' => $version,
    ], $auth);
});

// --- Settings --------------------------------------------------------------

$router->get('/cms/settings/theme', function () {
    $auth = Auth::require();
    Bridge::invoke('handlers/theme.php', 'handle_theme_get', 'GET', [], $auth);
});

$router->put('/cms/settings/theme', function () use ($request) {
    $auth = Auth::require();
    $body = is_array($request->json()) ? $request->json() : [];
    Bridge::invoke('handlers/theme.php', 'handle_theme_update', 'POST', $body, $auth);
});

$router->get('/cms/settings/users', function () {
    $auth = Auth::require();
    Bridge::invoke('handlers/users.php', 'handle_users_list', 'GET', [], $auth);
});

$router->get('/cms/settings/webhooks', function () {
    $auth = Auth::require();
    Bridge::invoke('handlers/webhooks.php', 'handle_webhooks_list', 'GET', [], $auth);
});

// --- Dispatch ---

$result = $router->dispatch($request->method(), $request->path());

if ($result === null) {
    Response::notFound('Endpoint not found');
}
