<?php

namespace CMS;

/**
 * CMS Facade - Main entry point for all CMS operations.
 */
class CMS
{
    private array $options;

    public function __construct(array $options = [])
    {
        $this->options = $options;
    }

    /**
     * Get a CollectionBuilder for a collection path.
     */
    public function collection(string $path): CollectionBuilder
    {
        return new CollectionBuilder($path, $this->options);
    }

    /**
     * Get a single item by path and slug.
     */
    public function item(string $path, ?string $slug = null, array $options = []): ?Item
    {
        $mergedOptions = array_merge($this->options, $options);

        if ($slug) {
            $item = Collection::getBySlug($path, $slug, $mergedOptions);
        } else {
            // If path is a file, load directly
            if (is_file($path)) {
                $item = Item::fromFile($path, $mergedOptions);
            } else {
                return null;
            }
        }

        if ($item) {
            $item->attachCollection($path, $mergedOptions);
            $item->setCanonicalBaseUrl(cms_canonical_base_url($mergedOptions));

            // Generate URL if page_path is set
            $pagePath = $mergedOptions['page_path'] ?? null;
            $prettyUrls = $mergedOptions['pretty_urls'] ?? true;
            if ($pagePath) {
                if ($prettyUrls) {
                    $pagePath = cms_strip_page_filename($pagePath);
                }
                $normalizedPath = rtrim($pagePath, '/') . '/';
                $url = $prettyUrls
                    ? $normalizedPath . $item->slug()
                    : $normalizedPath . '?item=' . $item->slug();
                $item->setUrl($url);
            }
        }

        return $item;
    }

    /**
     * Discover all collections in the base content path.
     */
    public function collections(?string $basePath = null): array
    {
        $basePath = $basePath ?? ($this->options['cms']['base_path'] ?? '');
        return Collection::discoverCollections($basePath);
    }

    /**
     * Get related items for a given item.
     */
    public function relatedItems(Item $item, array $criteria = ['tags'], int $limit = 5): array
    {
        $collectionPath = $item->collectionPath();
        if (!$collectionPath) {
            return [];
        }

        return Collection::getRelated($collectionPath, $item, $criteria, $limit, $this->options);
    }

    /**
     * Detect if pretty URLs are active based on the current request.
     */
    public static function detectPrettyUrls(): bool
    {
        // Check if PATH_INFO is set (indicates pretty URLs)
        if (!empty($_SERVER['PATH_INFO'])) {
            return true;
        }

        // Check if the URL has a slug-like segment after the page path
        $uri = $_SERVER['REQUEST_URI'] ?? '';
        $path = parse_url($uri, PHP_URL_PATH) ?? '';

        if (!preg_match('/\.\w+$/', $path)) {
            $segments = array_values(array_filter(explode('/', trim($path, '/'))));
            $querySlug = $_GET['item'] ?? $_GET['slug'] ?? null;
            if (is_string($querySlug) && $querySlug !== '' && count($segments) > 1) {
                return end($segments) === trim($querySlug, '/');
            }
        }

        // If the path doesn't end with a file extension and doesn't use query params for items
        if (!preg_match('/\.\w+$/', $path) && !isset($_GET['item']) && !isset($_GET['slug'])) {
            // Check if there's a path segment that looks like a slug
            $segments = array_filter(explode('/', $path));
            if (count($segments) > 1) {
                return true;
            }
        }

        return false;
    }
}
