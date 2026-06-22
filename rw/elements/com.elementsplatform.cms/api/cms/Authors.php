<?php

namespace CMS;

/**
 * Author enrichment from markdown files in an Authors/ folder parallel to content.
 */
class Authors
{
    /**
     * Get all authors from the Authors/ folder.
     */
    public static function getAll(string $contentPath, string $authorPagePath = '', bool $prettyUrls = true): array
    {
        $authorsDir = self::findAuthorsDir($contentPath);
        if (!$authorsDir || !is_dir($authorsDir)) {
            return [];
        }

        if ($prettyUrls && $authorPagePath) {
            $authorPagePath = cms_strip_page_filename($authorPagePath);
        }

        $files = glob($authorsDir . '/*.{md,markdown}', GLOB_BRACE);
        if (!$files) {
            return [];
        }

        $authors = [];
        foreach ($files as $file) {
            $author = self::parseAuthorFile($file);
            if ($author) {
                if ($authorPagePath) {
                    $normalizedPath = rtrim($authorPagePath, '/') . '/';
                    $author['url'] = $prettyUrls
                        ? $normalizedPath . $author['slug']
                        : $normalizedPath . '?author=' . $author['slug'];
                }
                $authors[] = $author;
            }
        }

        usort($authors, fn($a, $b) => strcasecmp($a['name'], $b['name']));

        return $authors;
    }

    /**
     * Enrich item authors with data from author markdown files.
     */
    public static function enrich(array $authors, string $contentPath, string $authorPagePath = '', bool $prettyUrls = true): array
    {
        $authorsDir = self::findAuthorsDir($contentPath);
        if (!$authorsDir) {
            return $authors;
        }

        if ($prettyUrls && $authorPagePath) {
            $authorPagePath = cms_strip_page_filename($authorPagePath);
        }

        $enriched = [];
        foreach ($authors as $author) {
            $authorName = is_array($author) ? ($author['name'] ?? '') : (string) $author;
            if (!$authorName) {
                $enriched[] = $author;
                continue;
            }

            $authorData = self::findAuthor($authorsDir, $authorName);
            if ($authorData) {
                if ($authorPagePath) {
                    $normalizedPath = rtrim($authorPagePath, '/') . '/';
                    $authorData['url'] = $prettyUrls
                        ? $normalizedPath . $authorData['slug']
                        : $normalizedPath . '?author=' . $authorData['slug'];
                }
                $enriched[] = $authorData;
            } else {
                $slug = self::slugify($authorName);
                $simple = ['name' => $authorName, 'slug' => $slug];
                if ($authorPagePath) {
                    $normalizedPath = rtrim($authorPagePath, '/') . '/';
                    $simple['url'] = $prettyUrls
                        ? $normalizedPath . $slug
                        : $normalizedPath . '?author=' . $slug;
                }
                $enriched[] = $simple;
            }
        }

        return $enriched;
    }

    private static function findAuthor(string $authorsDir, string $authorName): ?array
    {
        $slug = self::slugify($authorName);

        foreach (['md', 'markdown'] as $ext) {
            $path = $authorsDir . '/' . $slug . '.' . $ext;
            if (file_exists($path)) {
                return self::parseAuthorFile($path);
            }
        }

        // Case-insensitive search
        $files = glob($authorsDir . '/*.{md,markdown}', GLOB_BRACE);
        if ($files) {
            foreach ($files as $file) {
                $filename = strtolower(pathinfo($file, PATHINFO_FILENAME));
                if ($filename === strtolower($slug) || $filename === strtolower($authorName)) {
                    return self::parseAuthorFile($file);
                }
            }
        }

        return null;
    }

    private static function parseAuthorFile(string $filepath): ?array
    {
        $parsed = Parser::parse($filepath, ['disable_enrichment' => true]);
        if (!$parsed) {
            return null;
        }

        $fm = $parsed['frontmatter'];
        $filename = pathinfo($filepath, PATHINFO_FILENAME);

        $name = $fm['name'] ?? $fm['title'] ?? ucfirst(str_replace('-', ' ', $filename));

        return [
            'name' => $name,
            'slug' => $fm['slug'] ?? self::slugify($name),
            'title' => $fm['title'] ?? null,
            'bio' => $fm['bio'] ?? $fm['description'] ?? null,
            'image' => self::normalizeImage($fm['image'] ?? null),
            'email' => $fm['email'] ?? null,
            'social' => $fm['social'] ?? null,
            'website' => $fm['website'] ?? $fm['url'] ?? null,
        ];
    }

    private static function normalizeImage(mixed $image): ?array
    {
        if (empty($image)) {
            return null;
        }

        if (is_string($image)) {
            return ['src' => $image, 'alt' => null, 'title' => null];
        }

        if (is_array($image)) {
            return [
                'src' => $image['src'] ?? $image['url'] ?? '',
                'alt' => $image['alt'] ?? null,
                'title' => $image['title'] ?? null,
            ];
        }

        return null;
    }

    private static function findAuthorsDir(string $contentPath): ?string
    {
        if (is_file($contentPath)) {
            $contentPath = dirname($contentPath);
        }

        $parentDir = dirname($contentPath);
        foreach (['Authors', 'authors'] as $name) {
            $dir = $parentDir . '/' . $name;
            if (is_dir($dir)) {
                return $dir;
            }

            $dir = $contentPath . '/' . $name;
            if (is_dir($dir)) {
                return $dir;
            }
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
