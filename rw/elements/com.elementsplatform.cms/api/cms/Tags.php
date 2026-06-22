<?php

namespace CMS;

/**
 * Tag enrichment from markdown files in a Tags/ folder parallel to content.
 */
class Tags
{
    /**
     * Get all tags from the Tags/ folder.
     */
    public static function getAll(string $contentPath, string $tagPagePath = '', bool $prettyUrls = true): array
    {
        $tagsDir = self::findTagsDir($contentPath);
        if (!$tagsDir || !is_dir($tagsDir)) {
            return [];
        }

        if ($prettyUrls && $tagPagePath) {
            $tagPagePath = cms_strip_page_filename($tagPagePath);
        }

        $files = glob($tagsDir . '/*.{md,markdown}', GLOB_BRACE);
        if (!$files) {
            return [];
        }

        $tags = [];
        foreach ($files as $file) {
            $tag = self::parseTagFile($file);
            if ($tag) {
                // Generate URL
                if ($tagPagePath) {
                    $normalizedPath = rtrim($tagPagePath, '/') . '/';
                    $tag['url'] = $prettyUrls
                        ? $normalizedPath . $tag['slug']
                        : $normalizedPath . '?tag=' . $tag['slug'];
                }
                $tags[] = $tag;
            }
        }

        // Sort by name
        usort($tags, fn($a, $b) => strcasecmp($a['name'], $b['name']));

        return $tags;
    }

    /**
     * Enrich item tags with data from tag markdown files.
     */
    public static function enrich(array $tags, string $contentPath, string $tagPagePath = '', bool $prettyUrls = true): array
    {
        $tagsDir = self::findTagsDir($contentPath);
        if (!$tagsDir) {
            return $tags;
        }

        if ($prettyUrls && $tagPagePath) {
            $tagPagePath = cms_strip_page_filename($tagPagePath);
        }

        $enriched = [];
        foreach ($tags as $tag) {
            $tagName = is_array($tag) ? ($tag['name'] ?? '') : (string) $tag;
            if (!$tagName) {
                $enriched[] = $tag;
                continue;
            }

            $tagData = self::findTag($tagsDir, $tagName);
            if ($tagData) {
                // Generate URL
                if ($tagPagePath) {
                    $normalizedPath = rtrim($tagPagePath, '/') . '/';
                    $tagData['url'] = $prettyUrls
                        ? $normalizedPath . $tagData['slug']
                        : $normalizedPath . '?tag=' . $tagData['slug'];
                }
                $enriched[] = $tagData;
            } else {
                // Fallback: simple tag object
                $slug = self::slugify($tagName);
                $simple = ['name' => $tagName, 'slug' => $slug];
                if ($tagPagePath) {
                    $normalizedPath = rtrim($tagPagePath, '/') . '/';
                    $simple['url'] = $prettyUrls
                        ? $normalizedPath . $slug
                        : $normalizedPath . '?tag=' . $slug;
                }
                $enriched[] = $simple;
            }
        }

        return $enriched;
    }

    /**
     * Find a tag file by name (case-insensitive).
     */
    private static function findTag(string $tagsDir, string $tagName): ?array
    {
        $slug = self::slugify($tagName);

        // Try exact filename match
        foreach (['md', 'markdown'] as $ext) {
            $path = $tagsDir . '/' . $slug . '.' . $ext;
            if (file_exists($path)) {
                return self::parseTagFile($path);
            }
        }

        // Case-insensitive search (also matches date-prefixed filenames: YYYY-MM-DD-slug)
        $files = glob($tagsDir . '/*.{md,markdown}', GLOB_BRACE);
        if ($files) {
            $needleSlug = strtolower($slug);
            $needleName = strtolower($tagName);
            foreach ($files as $file) {
                $filename = strtolower(pathinfo($file, PATHINFO_FILENAME));

                if ($filename === $needleSlug || $filename === $needleName) {
                    return self::parseTagFile($file);
                }

                if (preg_match('/^\d{4}-\d{2}-\d{2}-(.+)$/', $filename, $matches)) {
                    $stripped = $matches[1];
                    if ($stripped === $needleSlug || $stripped === $needleName) {
                        return self::parseTagFile($file);
                    }
                }
            }
        }

        return null;
    }

    /**
     * Parse a tag markdown file.
     */
    private static function parseTagFile(string $filepath): ?array
    {
        $parsed = Parser::parse($filepath, ['disable_enrichment' => true]);
        if (!$parsed) {
            return null;
        }

        $fm = $parsed['frontmatter'];
        $filename = pathinfo($filepath, PATHINFO_FILENAME);

        return [
            'name' => $fm['name'] ?? $fm['title'] ?? ucfirst(str_replace('-', ' ', $filename)),
            'slug' => $fm['slug'] ?? self::slugify($fm['name'] ?? $filename),
            'title' => $fm['title'] ?? null,
            'description' => $fm['description'] ?? null,
            'image' => $fm['image'] ?? null,
            'color' => $fm['color'] ?? null,
            'icon' => $fm['icon'] ?? null,
        ];
    }

    /**
     * Find the Tags/ directory relative to the content path.
     */
    private static function findTagsDir(string $contentPath): ?string
    {
        // Look for Tags/ folder parallel to content
        if (is_file($contentPath)) {
            $contentPath = dirname($contentPath);
        }

        // Check parallel: ../Tags/
        $parentDir = dirname($contentPath);
        $tagsDir = $parentDir . '/Tags';
        if (is_dir($tagsDir)) {
            return $tagsDir;
        }

        // Check same level: ./Tags/
        $tagsDir = $contentPath . '/Tags';
        if (is_dir($tagsDir)) {
            return $tagsDir;
        }

        // Case-insensitive fallback
        $tagsDir = $parentDir . '/tags';
        if (is_dir($tagsDir)) {
            return $tagsDir;
        }

        return null;
    }

    private static function slugify(string $text): string
    {
        $slug = strtolower($text);
        $slug = preg_replace('/[^a-z0-9\-]/', '-', $slug);
        $slug = preg_replace('/-+/', '-', $slug);
        return trim($slug, '-');
    }
}
