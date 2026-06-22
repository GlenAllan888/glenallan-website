<?php

// ---------------------------------------------------------------------------
// MCP resources.
// ---------------------------------------------------------------------------
// URI scheme: cms://...
//
//   cms://site                              → site identity + user role
//   cms://collections                       → collections + field schemas
//   cms://collection/{index}                → list of items in the collection
//   cms://item/{folder_index}/{filename}    → full frontmatter + raw markdown
//
// Individual items are enumerated dynamically under resources/list via the
// `collections` listing — full trees of thousands of files would overwhelm
// the MCP client, so we surface collection-scoped listings instead.

/**
 * Static, always-available resources.
 */
function mcp_resource_catalog(array $cfg, string $token_owner): array {
    $out = [
        [
            'uri'         => 'cms://site',
            'name'        => 'Site identity',
            'description' => 'Site name, theme, enabled features, and the role assigned to this MCP token.',
            'mimeType'    => 'application/json',
        ],
        [
            'uri'         => 'cms://collections',
            'name'        => 'Collections',
            'description' => 'All configured content collections with their field schemas.',
            'mimeType'    => 'application/json',
        ],
    ];

    foreach (($cfg['folders'] ?? []) as $i => $f) {
        $out[] = [
            'uri'         => 'cms://collection/' . $i,
            'name'        => 'Collection: ' . ($f['label'] ?? ('#' . $i)),
            'description' => 'Items in the "' . ($f['label'] ?? ('#' . $i)) . '" collection.',
            'mimeType'    => 'application/json',
        ];
    }

    return $out;
}

/**
 * Read a resource by URI. Returns [mimeType, text] or null on not-found.
 */
function mcp_resource_read(string $uri, array $cfg, string $token_owner): ?array {
    if ($uri === 'cms://site') {
        return mcp_json_resource($uri, mcp_resource_site($cfg, $token_owner));
    }
    if ($uri === 'cms://collections') {
        return mcp_json_resource($uri, mcp_synth_list_collections($cfg));
    }
    if (preg_match('#^cms://collection/(\d+)$#', $uri, $m)) {
        $data = mcp_resource_collection((int) $m[1], $cfg);
        return $data === null ? null : mcp_json_resource($uri, $data);
    }
    if (preg_match('#^cms://item/(\d+)/([^/]+)$#', $uri, $m)) {
        $data = mcp_resource_item((int) $m[1], rawurldecode($m[2]), $cfg);
        return $data === null ? null : mcp_markdown_resource($uri, $data);
    }
    return null;
}

function mcp_resource_site(array $cfg, string $token_owner): array {
    $theme = $cfg['theme'] ?? [];
    $user = $cfg['users'][$token_owner] ?? null;
    return [
        'site_name'    => $theme['site_name'] ?? 'Elements CMS',
        'theme'        => [
            'preset'        => $theme['preset']        ?? 'light',
            'accent_color'  => $theme['accent_color']  ?? null,
            'surface_color' => $theme['surface_color'] ?? null,
        ],
        'install' => [
            'language'       => $cfg['language'] ?? 'en',
            'folder_count'   => count($cfg['folders'] ?? []),
            'resource_count' => count($cfg['resource_folders'] ?? []),
        ],
        'user' => [
            'email' => $token_owner,
            'role'  => $user['role'] ?? 'editor',
        ],
    ];
}

function mcp_resource_collection(int $folder_index, array $cfg): ?array {
    $folder = $cfg['folders'][$folder_index] ?? null;
    if (!$folder) return null;
    $path = $folder['path'] ?? '';
    if (!is_dir($path)) return null;

    $items = [];
    foreach (scandir($path) as $entry) {
        if ($entry[0] === '.') continue;
        $full = $path . '/' . $entry;
        if (!is_file($full) || !str_ends_with($entry, '.md') || str_ends_with($entry, '.draft.md')) {
            continue;
        }
        $parsed = parse_front_matter(file_get_contents($full));
        $file_parts = parse_dated_filename($entry);
        $items[] = [
            'uri'       => 'cms://item/' . $folder_index . '/' . rawurlencode($entry),
            'filename'  => $entry,
            'slug'      => $file_parts['slug'],
            'date'      => $parsed['meta']['date'] ?? $file_parts['date'],
            'title'     => $parsed['meta']['title'] ?? '',
            'status'    => $parsed['meta']['status'] ?? 'published',
            'modified'  => filemtime($full),
        ];
    }
    usort($items, fn($a, $b) => $b['modified'] - $a['modified']);

    return [
        'folder' => [
            'index' => $folder_index,
            'label' => $folder['label'] ?? '',
            'path'  => $path,
        ],
        'items' => $items,
        'count' => count($items),
    ];
}

function mcp_resource_item(int $folder_index, string $filename, array $cfg): ?array {
    $folder = $cfg['folders'][$folder_index] ?? null;
    if (!$folder) return null;
    $path = safe_path($folder['path'], $filename);
    if ($path === false || !file_exists($path)) return null;
    return [
        'frontmatter' => parse_front_matter(file_get_contents($path))['meta'],
        'raw'         => file_get_contents($path),
    ];
}

function mcp_json_resource(string $uri, array $data): array {
    return [
        'uri'      => $uri,
        'mimeType' => 'application/json',
        'text'     => json_encode($data, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
    ];
}

function mcp_markdown_resource(string $uri, array $item): array {
    return [
        'uri'      => $uri,
        'mimeType' => 'text/markdown',
        'text'     => $item['raw'] ?? '',
    ];
}
