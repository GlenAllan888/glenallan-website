<?php

namespace CMS;

class CollectionResult
{
    public array $items;
    public array $pagination;
    public ?string $rssURL = null;
    public ?string $sitemapURL = null;

    public function __construct(array $items, array $pagination)
    {
        $this->items = $items;
        $this->pagination = $pagination;
    }

    public function each(callable $callback): void
    {
        foreach ($this->items as $item) {
            $callback($item);
        }
    }
}
