<?php

namespace CMS;

class Feed
{
    /**
     * Generate an RSS 2.0 XML feed from items.
     */
    public static function generateRss(array $items, array $config = []): string
    {
        $title = htmlspecialchars($config['title'] ?? 'RSS Feed', ENT_XML1);
        $description = htmlspecialchars($config['description'] ?? '', ENT_XML1);
        $link = htmlspecialchars($config['link'] ?? '', ENT_XML1);
        $language = htmlspecialchars($config['language'] ?? 'en', ENT_XML1);
        $lastBuildDate = date('r');

        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">' . "\n";
        $xml .= '<channel>' . "\n";
        $xml .= "  <title>{$title}</title>\n";
        $xml .= "  <description>{$description}</description>\n";
        $xml .= "  <link>{$link}</link>\n";
        $xml .= "  <language>{$language}</language>\n";
        $xml .= "  <lastBuildDate>{$lastBuildDate}</lastBuildDate>\n";

        foreach ($items as $item) {
            $itemTitle = htmlspecialchars($item->title(), ENT_XML1);
            $itemLink = htmlspecialchars($item->url() ?? '', ENT_XML1);
            $itemDesc = htmlspecialchars($item->excerpt() ?? '', ENT_XML1);
            $itemDate = '';

            try {
                $date = new \DateTimeImmutable($item->datePublished('c'));
                $itemDate = $date->format('r');
            } catch (\Exception) {
                $itemDate = date('r');
            }

            $itemGuid = $itemLink ?: htmlspecialchars($item->slug(), ENT_XML1);

            $xml .= "  <item>\n";
            $xml .= "    <title>{$itemTitle}</title>\n";
            $xml .= "    <link>{$itemLink}</link>\n";
            $xml .= "    <description>{$itemDesc}</description>\n";
            $xml .= "    <pubDate>{$itemDate}</pubDate>\n";
            $xml .= "    <guid>{$itemGuid}</guid>\n";

            // Tags as categories
            foreach ($item->tags() as $tag) {
                $tagName = is_array($tag) ? ($tag['name'] ?? '') : (string) $tag;
                if ($tagName) {
                    $xml .= '    <category>' . htmlspecialchars($tagName, ENT_XML1) . "</category>\n";
                }
            }

            $xml .= "  </item>\n";
        }

        $xml .= "</channel>\n";
        $xml .= '</rss>';

        return $xml;
    }
}
