<?php

namespace CMS;

class Item implements \JsonSerializable
{
    private array $data;
    private ?string $url = null;
    private ?string $canonicalBaseUrl = null;

    public function __construct(array $data)
    {
        $this->data = $data;
    }

    /**
     * Create an Item from a markdown file.
     */
    public static function fromFile(string $filepath, array $options = []): ?self
    {
        $parsed = Parser::parse($filepath, $options);
        if (!$parsed) {
            return null;
        }

        $data = $parsed['frontmatter'];
        $data['body'] = $parsed['html'];
        $data['raw_body'] = $parsed['raw'];

        // Enrich tags/authors from parallel Tags/ and Authors/ folders.
        // Skipped for relationship files themselves (which pass disable_enrichment)
        // to avoid recursive parsing.
        if (empty($options['disable_enrichment'])) {
            $tagPagePath    = $options['tag_page_path'] ?? '';
            $authorPagePath = $options['author_page_path'] ?? '';
            $prettyUrls     = $options['pretty_urls'] ?? true;

            if (!empty($data['tags'])) {
                $data['tags'] = Tags::enrich($data['tags'], $filepath, $tagPagePath, $prettyUrls);
            }
            if (!empty($data['authors'])) {
                $data['authors'] = Authors::enrich($data['authors'], $filepath, $authorPagePath, $prettyUrls);
            }
        }

        if (empty($data['excerpt']) && !empty($data['body'])) {
            $data['excerpt'] = self::generateExcerpt($data['body']);
        }

        return new self($data);
    }

    /**
     * Create an Item from a pre-parsed data array.
     */
    public static function fromArray(array $data): self
    {
        return new self($data);
    }

    // --- Standard Accessors ---

    public function slug(): string
    {
        return $this->data['slug'] ?? '';
    }

    public function title(): string
    {
        return $this->data['title'] ?? '';
    }

    /**
     * First (or single) author as an enriched object, or raw string fallback.
     */
    public function author(): mixed
    {
        $authors = $this->authors();
        if (!empty($authors)) {
            return $authors[0];
        }
        return $this->data['author'] ?? null;
    }

    /**
     * Internal string helper for the first author's name.
     * Used by filter/search/related logic.
     */
    public function authorName(): ?string
    {
        $first = $this->author();
        if (is_array($first)) {
            return $first['name'] ?? $first['slug'] ?? null;
        }
        return $first !== null ? (string) $first : null;
    }

    public function authors(): array
    {
        return $this->data['authors'] ?? [];
    }

    public function featured(): bool
    {
        return (bool) ($this->data['featured'] ?? false);
    }

    public function status(): string
    {
        return $this->data['status'] ?? 'published';
    }

    public function tags(): array
    {
        return $this->data['tags'] ?? [];
    }

    /**
     * First (or single) tag as an enriched object, or raw string fallback.
     */
    public function tag(): mixed
    {
        $tags = $this->tags();
        return $tags[0] ?? null;
    }

    /**
     * Internal string helper for the first tag's name.
     * Used by filter/search/related logic.
     */
    public function tagName(): ?string
    {
        $first = $this->tag();
        if (is_array($first)) {
            return $first['name'] ?? $first['slug'] ?? null;
        }
        return $first !== null ? (string) $first : null;
    }

    public function categories(): array
    {
        return $this->data['categories'] ?? [];
    }

    public function image(): ?array
    {
        return $this->data['image'] ?? null;
    }

    public function excerpt(): ?string
    {
        return $this->data['excerpt'] ?? null;
    }

    public function body(): string
    {
        return $this->data['body'] ?? '';
    }

    public function rawBody(): string
    {
        return $this->data['raw_body'] ?? '';
    }

    public function date(string $format = 'F j, Y'): string
    {
        return self::formatDate($this->data['date'] ?? '', $format);
    }

    public function datePublished(string $format = 'F j, Y'): string
    {
        return self::formatDate($this->data['date_published'] ?? '', $format);
    }

    public function dateModified(string $format = 'F j, Y'): string
    {
        return self::formatDate($this->data['date_modified'] ?? '', $format);
    }

    public function file(): string
    {
        return $this->data['filepath'] ?? '';
    }

    public function fileName(): string
    {
        return basename($this->file());
    }

    public function isPublished(): bool
    {
        return $this->status() === 'published';
    }

    public function isDraft(): bool
    {
        return $this->status() === 'draft';
    }

    public function url(): ?string
    {
        return $this->url ?? $this->data['url'] ?? null;
    }

    public function canonicalUrl(): ?string
    {
        $url = $this->url();
        if (!$url) {
            return $this->data['canonicalUrl'] ?? null;
        }

        if (preg_match('#^https?://#i', $url)) {
            return $url;
        }

        $baseUrl = $this->canonicalBaseUrl ?? $this->data['canonical_base_url'] ?? null;
        if (!$baseUrl) {
            return null;
        }

        return rtrim($baseUrl, '/') . '/' . ltrim($url, '/');
    }

    public function setUrl(string $url): void
    {
        // Ensure trailing slash before query string
        $qPos = strpos($url, '?');
        if ($qPos !== false) {
            $path = substr($url, 0, $qPos);
            $query = substr($url, $qPos);
            $this->url = rtrim($path, '/') . '/' . $query;
        } else {
            $this->url = $url;
        }
    }

    public function setCanonicalBaseUrl(?string $baseUrl): void
    {
        $baseUrl = trim((string) $baseUrl);
        $this->canonicalBaseUrl = $baseUrl !== '' ? rtrim($baseUrl, '/') : null;
    }

    /**
     * Get the collection path this item belongs to.
     */
    public function collectionPath(): ?string
    {
        return $this->data['collection_path'] ?? null;
    }

    public function setCollectionPath(string $path): void
    {
        $this->data['collection_path'] = $path;
    }

    // --- Related Items ---

    public function getRelatedItems(array $criteria = ['tags'], int $limit = 5): array
    {
        $collection = $this->data['_collection'] ?? null;
        if (!$collection) {
            return [];
        }

        $options = $this->data['_options'] ?? [];

        return Collection::getRelated($collection, $this, $criteria, $limit, $options);
    }

    /**
     * Attach a reference to the parent collection path for related items lookup.
     *
     * The options are retained so that subsequent lookups (e.g. getRelatedItems)
     * can load sibling items using the same configuration (resources path,
     * enrichment, pretty urls, etc.) as the source item.
     */
    public function attachCollection(string $collectionPath, array $options = []): void
    {
        $this->data['_collection'] = $collectionPath;
        $this->data['_options']    = $options;
    }

    // --- Magic Access ---

    public function __get(string $name): mixed
    {
        // Method aliases
        if (method_exists($this, $name)) {
            return $this->$name();
        }
        // Direct data access (custom fields are top-level)
        return $this->data[$name] ?? null;
    }

    public function __isset(string $name): bool
    {
        return method_exists($this, $name) || isset($this->data[$name]);
    }

    public function __toString(): string
    {
        return $this->title();
    }

    // --- Serialization ---

    public function toArray(): array
    {
        $result = [];
        foreach ($this->data as $key => $value) {
            // Skip internal keys
            if (str_starts_with($key, '_')) {
                continue;
            }
            $result[$key] = $value;
        }

        $result['author'] = $this->author();
        $result['tag']    = $this->tag();
        $result['url']    = $this->url();
        $result['canonicalUrl'] = $this->canonicalUrl();

        return $result;
    }

    public function jsonSerialize(): array
    {
        return $this->toArray();
    }

    // --- Helpers ---

    private static function formatDate(string $dateString, string $format): string
    {
        if (empty($dateString)) {
            return '';
        }

        try {
            $date = new \DateTimeImmutable($dateString);
            return $date->format($format);
        } catch (\Exception) {
            return $dateString;
        }
    }

    private static function generateExcerpt(string $html, int $words = 30): string
    {
        $text = strip_tags($html);
        $text = trim(preg_replace('/\s+/', ' ', $text));

        $wordArray = explode(' ', $text);
        if (count($wordArray) <= $words) {
            return $text;
        }

        return implode(' ', array_slice($wordArray, 0, $words)) . '...';
    }
}
