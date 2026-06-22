<?php

namespace CMS;

class Sitemap
{
    /**
     * Generate an XML sitemap from items.
     */
    public static function generate(array $items, string $baseUrl, string $changefreq = 'weekly', string $priority = '0.8'): string
    {
        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

        foreach ($items as $item) {
            $url = $item->url();
            if (!$url) {
                continue;
            }

            // Make URL absolute if it isn't already
            if (!str_starts_with($url, 'http')) {
                $url = rtrim($baseUrl, '/') . '/' . ltrim($url, '/');
            }

            $loc = htmlspecialchars($url, ENT_XML1);
            $lastmod = '';

            try {
                $date = new \DateTimeImmutable($item->dateModified('c'));
                $lastmod = $date->format('Y-m-d');
            } catch (\Exception) {
                // Skip lastmod
            }

            $xml .= "  <url>\n";
            $xml .= "    <loc>{$loc}</loc>\n";
            if ($lastmod) {
                $xml .= "    <lastmod>{$lastmod}</lastmod>\n";
            }
            $xml .= "    <changefreq>{$changefreq}</changefreq>\n";
            $xml .= "    <priority>{$priority}</priority>\n";
            $xml .= "  </url>\n";
        }

        $xml .= '</urlset>';

        return $xml;
    }
}
