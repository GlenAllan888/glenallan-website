<?php

namespace CMS;

class Search
{
    /**
     * Build a compact search index from items.
     * Returns array of records optimized for client-side search.
     */
    public static function buildIndex(array $items): array
    {
        return array_values(array_map(function (Item $item) {
            return [
                'slug'    => $item->slug(),
                'title'   => $item->title(),
                'excerpt' => strip_tags($item->excerpt() ?? ''),
                'body'    => self::compactBody($item->rawBody()),
                'tags'    => self::flattenTags($item->tags()),
                'author'  => $item->authorName() ?? '',
                'date'    => $item->date('Y-m-d'),
                'url'     => $item->url(),
                'image'   => $item->image(),
            ];
        }, $items));
    }

    /**
     * Generate a JSON search index file.
     * Returns the web-relative path to the file.
     */
    public static function generateIndex(array $items, string $outputPath): string
    {
        $index = self::buildIndex($items);
        $json = json_encode($index, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        $dir = dirname($outputPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        file_put_contents($outputPath, $json);

        return str_replace($_SERVER['DOCUMENT_ROOT'], '', $outputPath);
    }

    /**
     * Check if the cached index is stale (any .md file newer than the index).
     */
    public static function isCacheStale(string $contentDir, string $indexPath): bool
    {
        if (!file_exists($indexPath)) {
            return true;
        }

        $indexTime = filemtime($indexPath);
        $files = glob($contentDir . '/*.{md,markdown,txt}', GLOB_BRACE);

        if (!$files) {
            return true;
        }

        foreach ($files as $file) {
            if (filemtime($file) > $indexTime) {
                return true;
            }
        }

        return false;
    }

    /**
     * Strip markdown/HTML, collapse whitespace, truncate for index size.
     */
    private static function compactBody(string $raw, int $maxChars = 500): string
    {
        $text = strip_tags($raw);
        $text = preg_replace('/\s+/', ' ', trim($text));
        return mb_substr($text, 0, $maxChars);
    }

    /**
     * Flatten tags array to a comma-separated string for searching.
     */
    private static function flattenTags(array $tags): string
    {
        return implode(', ', array_map(function ($tag) {
            return is_array($tag) ? ($tag['name'] ?? '') : (string) $tag;
        }, $tags));
    }
}
