<?php

namespace CMS;

class Collection
{
    /**
     * Discover all .md files in a content directory and return as Item array.
     */
    public static function discover(string $contentDir, array $options = []): array
    {
        if (!is_dir($contentDir) || !is_readable($contentDir)) {
            return [];
        }

        $files = glob($contentDir . '/*.{md,markdown,txt}', GLOB_BRACE);
        if (!$files) {
            return [];
        }

        $items = [];
        foreach ($files as $file) {
            $item = Item::fromFile($file, $options);
            if ($item) {
                $items[] = $item;
            }
        }

        return $items;
    }

    /**
     * Filter items by the given criteria.
     *
     * Supported criteria keys:
     * - status: string ('published', 'draft')
     * - featured: bool
     * - tags: string|array (OR logic - matches any)
     * - author: string|array (matches any)
     * - date_before: string (strtotime-parseable)
     * - date_after: string (strtotime-parseable)
     * - category: string|array
     */
    public static function filter(array $items, array $criteria): array
    {
        if (empty($criteria)) {
            return $items;
        }

        return array_values(array_filter($items, function (Item $item) use ($criteria) {
            // Status filter
            if (isset($criteria['status']) && $criteria['status'] !== '') {
                if (strtolower($item->status()) !== strtolower($criteria['status'])) {
                    return false;
                }
            }

            // Featured filter
            if (isset($criteria['featured'])) {
                $featured = is_string($criteria['featured'])
                    ? in_array(strtolower($criteria['featured']), ['true', '1', 'yes'], true)
                    : (bool) $criteria['featured'];
                if ($item->featured() !== $featured) {
                    return false;
                }
            }

            // Tags filter (OR logic)
            if (!empty($criteria['tags'])) {
                $filterTags = is_string($criteria['tags'])
                    ? array_map('trim', explode(',', $criteria['tags']))
                    : (array) $criteria['tags'];
                $filterTags = array_map('strtolower', $filterTags);

                $itemTags = array_map(function ($tag) {
                    if (is_array($tag)) {
                        return strtolower($tag['name'] ?? $tag['slug'] ?? '');
                    }
                    return strtolower((string) $tag);
                }, $item->tags());

                if (!array_intersect($filterTags, $itemTags)) {
                    return false;
                }
            }

            // Author filter
            if (!empty($criteria['author'])) {
                $filterAuthors = is_string($criteria['author'])
                    ? array_map('trim', explode(',', $criteria['author']))
                    : (array) $criteria['author'];
                $filterAuthors = array_map('strtolower', $filterAuthors);

                $itemAuthor = strtolower($item->authorName() ?? '');
                if (!in_array($itemAuthor, $filterAuthors, true)) {
                    return false;
                }
            }

            // Date before filter
            if (!empty($criteria['date_before'])) {
                $beforeTs = strtotime($criteria['date_before']);
                $itemTs = strtotime($item->date('c'));
                if ($beforeTs && $itemTs && $itemTs > $beforeTs) {
                    return false;
                }
            }

            // Date after filter
            if (!empty($criteria['date_after'])) {
                $afterTs = strtotime($criteria['date_after']);
                $itemTs = strtotime($item->date('c'));
                if ($afterTs && $itemTs && $itemTs < $afterTs) {
                    return false;
                }
            }

            // Category filter
            if (!empty($criteria['category'])) {
                $filterCats = is_string($criteria['category'])
                    ? array_map('trim', explode(',', $criteria['category']))
                    : (array) $criteria['category'];
                $filterCats = array_map('strtolower', $filterCats);

                $itemCats = array_map('strtolower', $item->categories());
                if (!array_intersect($filterCats, $itemCats)) {
                    return false;
                }
            }

            return true;
        }));
    }

    /**
     * Sort items by a field and direction.
     */
    public static function sort(array $items, string $field = 'date_published', string $direction = 'desc'): array
    {
        usort($items, function (Item $a, Item $b) use ($field, $direction) {
            $aVal = self::getFieldValue($a, $field);
            $bVal = self::getFieldValue($b, $field);

            // Date fields: compare as ISO strings
            if (in_array($field, ['date', 'date_published', 'date_modified'])) {
                $cmp = strcmp($aVal, $bVal);
            } else {
                $cmp = $aVal <=> $bVal;
            }

            return $direction === 'desc' ? -$cmp : $cmp;
        });

        return $items;
    }

    /**
     * Paginate items.
     *
     * @return array{items: Item[], pagination: array}
     */
    public static function paginate(array $items, int $page = 1, int $perPage = 10, int $offset = 0): array
    {
        // Apply offset first
        if ($offset > 0) {
            $items = array_slice($items, $offset);
        }

        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));

        $totalItems = count($items);
        $lastPage = max(1, (int) ceil($totalItems / $perPage));

        $startIndex = ($page - 1) * $perPage;
        $pageItems = array_slice($items, $startIndex, $perPage);

        return [
            'items' => $pageItems,
            'pagination' => [
                'current_page' => $page,
                'total_pages' => $lastPage,
                'total_items' => $totalItems,
                'items_per_page' => $perPage,
                'has_prev' => $page > 1,
                'has_next' => $page < $lastPage,
            ],
        ];
    }

    /**
     * Get a single item by slug from a content directory.
     */
    public static function getBySlug(string $contentDir, string $slug, array $options = []): ?Item
    {
        if (!is_dir($contentDir)) {
            return null;
        }

        $files = glob($contentDir . '/*.{md,markdown,txt}', GLOB_BRACE);
        if (!$files) {
            return null;
        }

        // Check for a draft file first (written by the editor's live preview)
        $draftFile = $contentDir . '/' . $slug . '.draft.md';
        if (file_exists($draftFile)) {
            return Item::fromFile($draftFile, $options);
        }

        foreach ($files as $file) {
            $filename = pathinfo($file, PATHINFO_FILENAME);

            // Check direct match
            if ($filename === $slug) {
                return Item::fromFile($file, $options);
            }

            // Check date-prefixed match: YYYY-MM-DD-slug
            if (preg_match('/^\d{4}-\d{2}-\d{2}-(.+)$/', $filename, $matches)) {
                if ($matches[1] === $slug) {
                    return Item::fromFile($file, $options);
                }
            }
        }

        return null;
    }

    /**
     * Find items related to the given item by shared tags or author.
     */
    public static function getRelated(string $contentDir, Item $sourceItem, array $criteria = ['tags'], int $limit = 5, array $options = []): array
    {
        $allItems = self::discover($contentDir, $options);

        // Filter out the source item and drafts
        $candidates = array_filter($allItems, function (Item $item) use ($sourceItem) {
            return $item->slug() !== $sourceItem->slug() && $item->isPublished();
        });

        // Score each candidate
        $scored = [];
        foreach ($candidates as $item) {
            $score = 0;

            if (in_array('tags', $criteria)) {
                $sourceTags = array_map(function ($t) {
                    return strtolower(is_array($t) ? ($t['name'] ?? '') : (string) $t);
                }, $sourceItem->tags());

                $itemTags = array_map(function ($t) {
                    return strtolower(is_array($t) ? ($t['name'] ?? '') : (string) $t);
                }, $item->tags());

                $score += count(array_intersect($sourceTags, $itemTags)) * 3;
            }

            if (in_array('author', $criteria)) {
                if ($sourceItem->authorName() && $item->authorName()
                    && strtolower($sourceItem->authorName()) === strtolower($item->authorName())) {
                    $score += 5;
                }
            }

            if ($score > 0) {
                $scored[] = ['item' => $item, 'score' => $score];
            }
        }

        // Sort by score descending
        usort($scored, fn($a, $b) => $b['score'] <=> $a['score']);

        // Return top items
        $relatedItems = array_map(
            fn($s) => $s['item'],
            array_slice($scored, 0, $limit)
        );

        foreach ($relatedItems as $item) {
            $item->attachCollection($contentDir, $options);
            self::applyUrlContext($item, $options);
        }

        return $relatedItems;
    }

    /**
     * Discover all collections (subdirectories containing .md files).
     */
    public static function discoverCollections(string $basePath): array
    {
        if (!is_dir($basePath)) {
            return [];
        }

        $collections = [];
        $dirs = glob($basePath . '/*', GLOB_ONLYDIR);

        foreach ($dirs as $dir) {
            $name = basename($dir);

            // Skip hidden directories and special folders
            if (str_starts_with($name, '.') || str_starts_with($name, '_')) {
                continue;
            }

            $files = glob($dir . '/*.{md,markdown,txt}', GLOB_BRACE);
            if ($files && count($files) > 0) {
                $collections[] = [
                    'name' => $name,
                    'path' => $dir,
                    'item_count' => count($files),
                    'last_modified' => date('c', max(array_map('filemtime', $files))),
                ];
            }
        }

        return $collections;
    }

    /**
     * Get a field value from an item for sorting.
     */
    private static function getFieldValue(Item $item, string $field): mixed
    {
        return match ($field) {
            'date_published' => $item->datePublished('c'),
            'date_modified' => $item->dateModified('c'),
            'date' => $item->date('c'),
            'raw_body' => $item->rawBody(),
            'file_name' => $item->fileName(),
            'is_published' => $item->isPublished(),
            'is_draft' => $item->isDraft(),
            default => $item->$field ?? '',
        };
    }

    private static function applyUrlContext(Item $item, array $options): void
    {
        $item->setCanonicalBaseUrl(cms_canonical_base_url($options));

        $pagePath = $options['page_path'] ?? null;
        if (!is_string($pagePath) || $pagePath === '') {
            return;
        }

        $prettyUrls = $options['pretty_urls'] ?? true;
        if (is_string($prettyUrls)) {
            $prettyUrls = strtolower($prettyUrls) !== 'false';
        } else {
            $prettyUrls = (bool) $prettyUrls;
        }

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
