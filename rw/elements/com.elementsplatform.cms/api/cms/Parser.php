<?php

namespace CMS;

use League\CommonMark\CommonMarkConverter;
use League\CommonMark\Extension\FrontMatter\FrontMatterExtension;
use League\CommonMark\Extension\FrontMatter\Output\RenderedContentWithFrontMatter;

class Parser
{
    private static ?CommonMarkConverter $converter = null;

    /**
     * Parse a markdown file with YAML frontmatter.
     *
     * @return array{frontmatter: array, html: string, raw: string}|null
     */
    public static function parse(string $filepath, array $options = []): ?array
    {
        if (!is_file($filepath) || !is_readable($filepath)) {
            return null;
        }

        $content = file_get_contents($filepath);
        if ($content === false) {
            return null;
        }

        $content = \ecms_normalize_text_encoding($content);
        $content = self::normalizeFrontmatterContent($content);

        $converter = self::getConverter($options);
        $result = $converter->convert($content);

        $frontmatter = [];
        if ($result instanceof RenderedContentWithFrontMatter) {
            $frontmatter = $result->getFrontMatter() ?? [];
        }

        $html = self::prefixHtmlPaths((string) $result, $options);
        $raw = self::extractRawBody($content);

        // Extract slug from filename
        $filename = pathinfo($filepath, PATHINFO_FILENAME);
        $slug = self::extractSlugFromFilename($filename, $frontmatter);

        // Normalize frontmatter
        $frontmatter = self::normalizeFrontmatter($frontmatter, $slug, $filepath, $options);

        return [
            'frontmatter' => $frontmatter,
            'html' => $html,
            'raw' => $raw,
        ];
    }

    /**
     * Extract slug from filename, handling date prefixes like 2023-01-01-slug.md
     */
    private static function extractSlugFromFilename(string $filename, array &$frontmatter): string
    {
        // Check for date-prefixed filename: YYYY-MM-DD-slug
        if (preg_match('/^(\d{4}-\d{2}-\d{2})-(.+)$/', $filename, $matches)) {
            // Use date from filename if not already in frontmatter
            if (!isset($frontmatter['date'])) {
                $frontmatter['date'] = $matches[1];
            }
            return $matches[2];
        }

        return $filename;
    }

    /**
     * Normalize frontmatter fields with defaults and type coercion.
     */
    private static function normalizeFrontmatter(array $fm, string $slug, string $filepath, array $options): array
    {
        $data = [];

        // Slug
        $data['slug'] = $fm['slug'] ?? $slug;

        // Title - required, fallback to slug
        $data['title'] = $fm['title'] ?? ucfirst(str_replace('-', ' ', $data['slug']));

        // Dates
        $fileMtime = file_exists($filepath) ? filemtime($filepath) : null;
        $data['date'] = self::normalizeDate($fm['date'] ?? null, $fileMtime);
        $data['date_published'] = self::normalizeDate($fm['date_published'] ?? null, $data['date']);
        $data['date_modified'] = self::normalizeDate($fm['date_modified'] ?? null, $fileMtime ? date('c', $fileMtime) : $data['date']);

        // Author(s)
        $data['author'] = $fm['author'] ?? null;
        $data['authors'] = $fm['authors'] ?? ($data['author'] ? [$data['author']] : []);
        if (is_string($data['author']) && !$data['author']) {
            $data['author'] = null;
        }

        // Boolean/status fields
        $data['featured'] = (bool) ($fm['featured'] ?? false);
        $data['status'] = $fm['status'] ?? 'published';

        // Array fields
        $data['tags'] = self::normalizeArrayField($fm['tags'] ?? []);
        $data['categories'] = self::normalizeArrayField($fm['categories'] ?? []);

        // Image
        $data['image'] = self::normalizeImage($fm['image'] ?? null);

        // Excerpt
        $data['excerpt'] = $fm['excerpt'] ?? null;

        // Filepath
        $data['filepath'] = $filepath;

        // All remaining non-standard keys go top-level
        $standardKeys = [
            'slug', 'title', 'date', 'date_published', 'date_modified',
            'author', 'authors', 'featured', 'status', 'tags', 'categories',
            'image', 'excerpt',
        ];

        foreach ($fm as $key => $value) {
            if (!in_array($key, $standardKeys, true) && !isset($data[$key])) {
                $data[$key] = $value;
            }
        }

        return self::prefixResourcePath($data, $options);
    }

    /**
     * Normalize a date value to ISO 8601 format.
     */
    private static function normalizeDate(mixed $value, mixed $fallback = null): string
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format('c');
        }

        if (is_int($value) || (is_string($value) && ctype_digit($value))) {
            $intVal = (int) $value;
            // Unix timestamp (10 digits)
            if (strlen((string) $intVal) === 10) {
                return date('c', $intVal);
            }
            // YYYYMMDD format (8 digits)
            if (strlen((string) $intVal) === 8) {
                $formatted = substr((string) $intVal, 0, 4) . '-' .
                    substr((string) $intVal, 4, 2) . '-' .
                    substr((string) $intVal, 6, 2);
                return (new \DateTimeImmutable($formatted))->format('c');
            }
        }

        if (is_string($value) && $value !== '') {
            try {
                return (new \DateTimeImmutable($value))->format('c');
            } catch (\Exception) {
                // Fall through to fallback
            }
        }

        // Use fallback
        if ($fallback) {
            if (is_string($fallback)) {
                return $fallback; // Already normalized
            }
            if (is_int($fallback)) {
                return date('c', $fallback);
            }
        }

        return date('c'); // Current time as last resort
    }

    /**
     * Normalize array fields (tags, categories) from comma-separated strings or arrays.
     */
    private static function normalizeArrayField(mixed $value): array
    {
        if (is_array($value)) {
            return array_values(array_filter(array_map('trim', $value)));
        }

        if (is_string($value) && $value !== '') {
            return array_values(array_filter(array_map('trim', explode(',', $value))));
        }

        return [];
    }

    /**
     * Normalize image field to standard array format.
     */
    private static function normalizeImage(mixed $value): ?array
    {
        if (empty($value)) {
            return null;
        }

        return is_string($value)
            ? ['src' => $value, 'type' => '', 'title' => '', 'width' => '', 'height' => '', 'alt' => '']
            : array_merge(['src' => '', 'type' => '', 'title' => '', 'width' => '', 'height' => '', 'alt' => ''], $value);
    }

    /**
     * Prefix resource path on any frontmatter value whose terminal key is 'src'.
     */
    private static function prefixResourcePath(mixed $value, array $options, string|int|null $key = null): mixed
    {
        $resourcesPath = $options['resources']['path'] ?? null;
        if (!$resourcesPath) {
            return $value;
        }

        if (is_array($value)) {
            foreach ($value as $childKey => $childValue) {
                $value[$childKey] = self::prefixResourcePath($childValue, $options, $childKey);
            }
            return $value;
        }

        if (is_string($value) && $value !== '' && self::isSrcKey($key) && !self::isAbsoluteUrl($value)) {
            return rtrim($resourcesPath, '/') . '/' . ltrim($value, '/');
        }

        return $value;
    }

    /**
     * Check if an array key represents a terminal src property.
     */
    private static function isSrcKey(string|int|null $key): bool
    {
        if (!is_string($key)) {
            return false;
        }

        return $key === 'src' || str_ends_with($key, '.src');
    }

    /**
     * Check if a URL is absolute (http/https/data URI).
     */
    private static function isAbsoluteUrl(string $url): bool
    {
        return (bool) preg_match('#^(https?://|data:)#i', $url);
    }

    /**
     * Prefix relative src attributes in HTML with the resources path.
     */
    private static function prefixHtmlPaths(string $html, array $options): string
    {
        $resourcesPath = $options['resources']['path'] ?? null;
        if (!$resourcesPath || !$html) {
            return $html;
        }

        return preg_replace_callback(
            '/(src=["\'])(?!https?:\/\/|data:)([^"\']+)(["\'])/i',
            function ($m) use ($resourcesPath) {
                return $m[1] . rtrim($resourcesPath, '/') . '/' . ltrim($m[2], '/') . $m[3];
            },
            $html
        );
    }

    /**
     * Extract the raw markdown body (everything after the second ---).
     */
    private static function extractRawBody(string $content): string
    {
        if (preg_match('/^---[ \t]*\R.*?\R---[ \t]*(?:\R(.*))?$/s', $content, $matches)) {
            return trim($matches[1] ?? '');
        }
        return trim($content);
    }

    /**
     * CommonMark's frontmatter extension requires a newline after the closing
     * fence, so frontmatter-only data files ending with bare "---" need one
     * appended in memory before parsing.
     */
    private static function normalizeFrontmatterContent(string $content): string
    {
        if (!str_starts_with($content, '---')) {
            return $content;
        }

        if ($content !== '' && preg_match('/\R$/', $content)) {
            return $content;
        }

        if (preg_match('/^---\R.*?\R---[ \t]*$/s', $content)) {
            return $content . "\n";
        }

        return $content;
    }

    /**
     * Get or create the CommonMark converter.
     */
    private static function getConverter(array $options = []): CommonMarkConverter
    {
        if (self::$converter === null) {
            $markdownConfig = $options['parser']['markdown'] ?? [];

            self::$converter = new CommonMarkConverter([
                'html_input' => $markdownConfig['html_input'] ?? 'allow',
                'allow_unsafe_links' => $markdownConfig['allow_unsafe_links'] ?? false,
            ]);

            self::$converter->getEnvironment()->addExtension(new FrontMatterExtension(new PermissiveFrontMatterDataParser()));
        }

        return self::$converter;
    }
}
