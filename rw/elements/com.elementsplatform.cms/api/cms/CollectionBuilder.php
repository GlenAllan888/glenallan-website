<?php

namespace CMS;

/**
 * Fluent query builder for collections.
 * Used by templates to chain filter/sort/paginate operations.
 */
class CollectionBuilder
{
    private string $path;
    private array $options;
    private array $filters = [];
    private string $orderByField = 'date_published';
    private string $orderDirection = 'desc';
    private ?int $page = null;
    private int $perPage = 10;
    private int $offset = 0;
    private ?int $limitCount = null;
    private ?string $pagePath = null;
    private ?string $tagPagePath = null;
    private ?string $authorPagePath = null;
    private bool $prettyUrls = true;
    private ?string $canonicalBaseUrl = null;

    public function __construct(string $path, array $options = [])
    {
        $this->path = $path;
        $this->options = $options;
        $this->perPage = $options['pagination']['default_per_page'] ?? 10;
        $this->canonicalBaseUrl = cms_canonical_base_url($options);
    }

    // --- Filters ---

    public function filter(array $criteria): self
    {
        $this->filters = array_merge($this->filters, $criteria);
        return $this;
    }

    public function applyFilters(array $filters): self
    {
        foreach ($filters as $key => $value) {
            match ($key) {
                'tags' => $this->tags($value),
                'author' => $this->author($value),
                'featured' => $this->featured($value === 'true' || $value === true),
                'status' => $this->status($value),
                'date_before' => $this->before($value),
                'date_after' => $this->after($value),
                default => null,
            };
        }
        return $this;
    }

    public function status(string $status): self
    {
        $this->filters['status'] = $status;
        return $this;
    }

    public function featured(bool $featured = true): self
    {
        $this->filters['featured'] = $featured;
        return $this;
    }

    public function tags(string|array $tags): self
    {
        $this->filters['tags'] = $tags;
        return $this;
    }

    public function author(string|array $author): self
    {
        $this->filters['author'] = $author;
        return $this;
    }

    public function before(string $date): self
    {
        $this->filters['date_before'] = $date;
        return $this;
    }

    public function after(string $date): self
    {
        $this->filters['date_after'] = $date;
        return $this;
    }

    // --- Sorting ---

    public function orderBy(string $field, string $direction = 'desc'): self
    {
        $this->orderByField = $field;
        $this->orderDirection = $direction;
        return $this;
    }

    public function latest(): self
    {
        return $this->orderBy('date_published', 'desc');
    }

    public function oldest(): self
    {
        return $this->orderBy('date_published', 'asc');
    }

    // --- Pagination ---

    public function paginate(int $page, int $perPage = 10): self
    {
        $this->page = $page;
        $this->perPage = $perPage;
        return $this;
    }

    public function limit(int $limit): self
    {
        $this->limitCount = $limit;
        return $this;
    }

    public function offset(int $offset): self
    {
        $this->offset = $offset;
        return $this;
    }

    // --- URL Config ---

    public function pagePath(string $path): self
    {
        $this->pagePath = $path;
        return $this;
    }

    public function tagPagePath(string $path): self
    {
        $this->tagPagePath = $path;
        return $this;
    }

    public function authorPagePath(string $path): self
    {
        $this->authorPagePath = $path;
        return $this;
    }

    public function prettyUrls(bool $pretty = true): self
    {
        $this->prettyUrls = $pretty;
        return $this;
    }

    public function canonicalBaseUrl(?string $baseUrl): self
    {
        $this->canonicalBaseUrl = $baseUrl ? rtrim($baseUrl, '/') : null;
        return $this;
    }

    // --- Execution ---

    /**
     * Get paginated results.
     */
    public function get(): CollectionResult
    {
        $items = $this->executeQuery();

        $page = $this->page ?? 1;
        $result = Collection::paginate($items, $page, $this->perPage, $this->offset);

        // Generate URLs for items
        $this->applyUrls($result['items']);

        return new CollectionResult($result['items'], $result['pagination']);
    }

    /**
     * Get all items (no pagination).
     */
    public function all(): array
    {
        $items = $this->executeQuery();

        if ($this->offset > 0) {
            $items = array_slice($items, $this->offset);
        }

        if ($this->limitCount !== null) {
            $items = array_slice($items, 0, $this->limitCount);
        }

        $this->applyUrls($items);
        return $items;
    }

    /**
     * Get the first item.
     */
    public function first(): ?Item
    {
        $items = $this->executeQuery();
        $item = $items[0] ?? null;

        if ($item) {
            $this->applyUrls([$item]);
        }

        return $item;
    }

    /**
     * Count items matching the query.
     */
    public function count(): int
    {
        return count($this->executeQuery());
    }

    // --- Output ---

    /**
     * Generate RSS feed XML.
     */
    public function rss(string $title, string $description, string $link): string
    {
        $items = $this->all();
        return Feed::generateRss($items, [
            'title' => $title,
            'description' => $description,
            'link' => $link,
        ]);
    }

    /**
     * Generate sitemap XML.
     */
    public function sitemap(string $baseUrl): string
    {
        $items = $this->all();
        return Sitemap::generate($items, $baseUrl);
    }

    // --- File Generation ---

    /**
     * Generate an RSS feed file with caching.
     * Uses clone internally to avoid mutating the builder.
     */
    public function generateFeed(string $title, string $description, string $siteUrl, string $outputPath, int $maxAge = 86400, int $limit = 20): string
    {
        $needsRegen = isset($_GET['regenerate_rss'])
            || !file_exists($outputPath)
            || (time() - filemtime($outputPath) > $maxAge);

        if ($needsRegen) {
            $builder = clone $this;
            $content = $builder->limit($limit)->rss($title, $description, $siteUrl);
            $dir = dirname($outputPath);
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
            file_put_contents($outputPath, $content);
        }

        return str_replace($_SERVER['DOCUMENT_ROOT'], '', $outputPath);
    }

    /**
     * Generate a sitemap file with caching.
     * Uses clone internally to avoid mutating the builder.
     */
    public function generateSitemap(string $siteUrl, string $outputPath, int $maxAge = 86400, int $limit = 1000): string
    {
        $needsRegen = isset($_GET['regenerate_sitemap'])
            || !file_exists($outputPath)
            || (time() - filemtime($outputPath) > $maxAge);

        if ($needsRegen) {
            $builder = clone $this;
            $content = $builder->limit($limit)->sitemap($siteUrl);
            $dir = dirname($outputPath);
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
            file_put_contents($outputPath, $content);
        }

        return str_replace($_SERVER['DOCUMENT_ROOT'], '', $outputPath);
    }

    /**
     * Resolve an output file path relative to the current script directory.
     */
    public static function resolveOutputPath(string $folder, string $filename): string
    {
        $currentScriptDir = dirname($_SERVER['SCRIPT_FILENAME']);
        $dir = empty($folder)
            ? $currentScriptDir
            : (realpath($currentScriptDir . '/' . $folder) ?: $currentScriptDir . '/' . $folder);
        return rtrim($dir, '/') . '/' . $filename;
    }

    // --- Internal ---

    private function executeQuery(): array
    {
        $items = Collection::discover($this->path, $this->options);
        $items = Collection::filter($items, $this->filters);
        $items = Collection::sort($items, $this->orderByField, $this->orderDirection);

        // Attach collection path and options to items so related-item lookups
        // inherit the same configuration (resources path, enrichment, etc.).
        $runtimeOptions = $this->relatedItemOptions();
        foreach ($items as $item) {
            $item->attachCollection($this->path, $runtimeOptions);
        }

        return $items;
    }

    private function applyUrls(array $items): void
    {
        if (!$this->pagePath) {
            return;
        }

        $pagePath = $this->prettyUrls ? cms_strip_page_filename($this->pagePath) : $this->pagePath;
        $normalizedPath = rtrim($pagePath, '/') . '/';
        $tagPagePath = $this->prettyUrls && $this->tagPagePath
            ? cms_strip_page_filename($this->tagPagePath)
            : $this->tagPagePath;

        foreach ($items as $item) {
            $url = $this->prettyUrls
                ? $normalizedPath . $item->slug()
                : $normalizedPath . '?item=' . $item->slug();
            $item->setUrl($url);
            $item->setCanonicalBaseUrl($this->canonicalBaseUrl);

            // Enrich tags with URLs
            if ($this->tagPagePath) {
                $normalizedTagPath = rtrim($tagPagePath, '/') . '/';
                $enrichedTags = [];
                foreach ($item->tags() as $tag) {
                    $tagName = is_array($tag) ? ($tag['name'] ?? '') : (string) $tag;
                    $tagSlug = is_array($tag) ? ($tag['slug'] ?? self::slugify($tagName)) : self::slugify($tagName);
                    $tagUrl = $this->prettyUrls
                        ? $normalizedTagPath . $tagSlug
                        : $normalizedTagPath . '?tag=' . $tagSlug;

                    if (is_array($tag)) {
                        $tag['url'] = $tagUrl;
                        $enrichedTags[] = $tag;
                    } else {
                        $enrichedTags[] = [
                            'name' => $tagName,
                            'slug' => $tagSlug,
                            'url' => $tagUrl,
                        ];
                    }
                }
                // Note: We can't directly set tags on Item since it's immutable.
                // Tags with URLs are generated at query time for templates.
            }

            // Enrich authors with URLs
            if ($this->authorPagePath) {
                // Similar pattern for author URLs
            }
        }
    }

    private function relatedItemOptions(): array
    {
        $options = $this->options;
        $options['pretty_urls'] = $this->prettyUrls;

        if ($this->pagePath !== null) {
            $options['page_path'] = $this->pagePath;
        }

        if ($this->canonicalBaseUrl !== null) {
            $options['canonical_base_url'] = $this->canonicalBaseUrl;
        }

        return $options;
    }

    private static function slugify(string $text): string
    {
        $slug = strtolower($text);
        $slug = preg_replace('/[^a-z0-9\-]/', '-', $slug);
        $slug = preg_replace('/-+/', '-', $slug);
        return trim($slug, '-');
    }
}
