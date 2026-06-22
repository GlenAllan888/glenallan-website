<?php

// ---------------------------------------------------------------------------
// MCP tool registry.
// ---------------------------------------------------------------------------
// Tools come in two flavours:
//
//   [handler]  Bridged to an existing editor handler. Bridge sets up fake
//              $_SESSION/$_GET/$_POST, invokes the handler, captures the
//              json_response output, and wraps it in the MCP envelope.
//              Used for content CRUD, versions, settings reads, etc.
//
//   [native]   A closure(args, cfg, license) that returns a plain array.
//              Used for tools that don't have a matching handler (the
//              synthesized collection list) or can't go through the bridge
//              (uploads — move_uploaded_file only accepts genuine POSTed
//              files).
//
// Role gates piggy-back on the existing handlers' require_admin/require_owner
// calls. The bridge populates $_SESSION['role'] from the token owner, so
// role checks inside the handler still work.

require_once __DIR__ . '/uploads.php';

function mcp_tool_registry(): array {
    return [
        // -------------------------------------------------------------------
        // Content — read
        // -------------------------------------------------------------------
        'content_list_collections' => [
            'description' => 'List configured content collections (folders) for this CMS install. Returns each folder\'s index, label, path, and field schema.',
            'input' => ['type' => 'object', 'properties' => new stdClass(), 'additionalProperties' => false],
            'native' => fn(array $a, array $cfg, array $lic) => mcp_synth_list_collections($cfg),
        ],
        'content_list_items' => [
            'description' => 'List markdown items inside a collection. Optionally drill into a subfolder (licensed installs only).',
            'input' => [
                'type' => 'object',
                'properties' => [
                    'folder'  => ['type' => 'integer', 'description' => 'Collection index (see content_list_collections)'],
                    'subpath' => ['type' => 'string', 'description' => 'Optional sub-directory inside the collection'],
                ],
                'required' => ['folder'],
                'additionalProperties' => false,
            ],
            'handler' => ['files.php', 'handle_files_list'],
            'method' => 'GET',
        ],
        'content_read_item' => [
            'description' => 'Read a single markdown item (frontmatter + body) from a collection.',
            'input' => [
                'type' => 'object',
                'properties' => [
                    'folder'  => ['type' => 'integer'],
                    'file'    => ['type' => 'string', 'description' => 'Filename, e.g. 2026-04-17-my-post.md'],
                    'subpath' => ['type' => 'string'],
                ],
                'required' => ['folder', 'file'],
                'additionalProperties' => false,
            ],
            'handler' => ['files.php', 'handle_files_read'],
            'method' => 'GET',
        ],

        // -------------------------------------------------------------------
        // Content — write
        // -------------------------------------------------------------------
        'content_create_collection' => [
            'description' => 'Create/register a new top-level content collection. Requires an admin-role token. '
                           . 'If the directory path does not exist, it will be created recursively before registration. '
                           . 'When the destination is ambiguous, ask the user to confirm the path before calling this tool.',
            'input' => [
                'type' => 'object',
                'properties' => [
                    'label' => ['type' => 'string', 'description' => 'Display name for the content collection'],
                    'path'  => ['type' => 'string', 'description' => 'Server filesystem path for the collection directory'],
                ],
                'required' => ['label', 'path'],
                'additionalProperties' => false,
            ],
            'handler' => ['folders.php', 'handle_folders_add'],
            'method' => 'POST',
        ],
        'content_create_item' => [
            'description' => 'Create a new markdown item in a collection. Slug is derived from fm.title if not supplied. Filename is prefixed with today\'s date by default; pass date_prefix=false to omit it.',
            'input' => [
                'type' => 'object',
                'properties' => [
                    'folder'      => ['type' => 'integer'],
                    'subpath'     => ['type' => 'string'],
                    'slug'        => ['type' => 'string', 'description' => 'Optional slug; derived from fm.title if omitted'],
                    'fm'          => ['type' => 'object', 'description' => 'Frontmatter fields (title, author, tags, status, …)'],
                    'body'        => ['type' => 'string', 'description' => 'Markdown body'],
                    'date_prefix' => ['type' => 'boolean', 'description' => 'Prepend today\'s date (YYYY-MM-DD-) to the filename. Default true.'],
                ],
                'required' => ['folder', 'fm'],
                'additionalProperties' => false,
            ],
            'handler' => ['files.php', 'handle_files_create'],
            'method' => 'POST',
        ],
        'content_update_item' => [
            'description' => 'Update an existing markdown item. Submitted frontmatter fields are merged over the existing ones; omitted fields (including body) are preserved.',
            'input' => [
                'type' => 'object',
                'properties' => [
                    'folder'  => ['type' => 'integer'],
                    'file'    => ['type' => 'string'],
                    'subpath' => ['type' => 'string'],
                    'slug'    => ['type' => 'string', 'description' => 'New slug; omit to keep current'],
                    'fm'      => ['type' => 'object'],
                    'body'    => ['type' => 'string', 'description' => 'New markdown body. Omit to preserve the existing body; pass an empty string to clear it.'],
                ],
                'required' => ['folder', 'file'],
                'additionalProperties' => false,
            ],
            'handler' => ['files.php', 'handle_files_update'],
            'method' => 'POST',
        ],
        'content_delete_item' => [
            'description' => 'Delete a markdown item. Version history is cleaned up.',
            'input' => [
                'type' => 'object',
                'properties' => [
                    'folder'  => ['type' => 'integer'],
                    'file'    => ['type' => 'string'],
                    'subpath' => ['type' => 'string'],
                ],
                'required' => ['folder', 'file'],
                'additionalProperties' => false,
            ],
            'handler' => ['files.php', 'handle_files_delete'],
            'method' => 'POST',
        ],

        // -------------------------------------------------------------------
        // Resources (general files) & Media (editor images) — native
        // (Upload handlers use move_uploaded_file which rejects in-process
        // files, so we implement upload natively and delegate listing to
        // the existing handlers.)
        // -------------------------------------------------------------------
        'resources_list' => [
            'description' => 'List files inside a resource folder.',
            'input' => [
                'type' => 'object',
                'properties' => [
                    'folder'  => ['type' => 'integer'],
                    'subpath' => ['type' => 'string'],
                ],
                'required' => ['folder'],
                'additionalProperties' => false,
            ],
            'handler' => ['resources.php', 'handle_resources_list'],
            'method' => 'GET',
        ],
        'resources_upload_request' => [
            'description' => 'PREFERRED upload path. Mints a one-shot, short-lived (120s) multipart upload URL. '
                           . 'Call this first, then POST the file to the returned upload_url with field name `file` '
                           . '(e.g. `curl -sS -F file=@/path/to/file \'<upload_url>\'`). The file bytes never pass '
                           . 'through the model this way, so this is the only path that works for non-trivial sizes. '
                           . 'Set `media_only=true` to require an image MIME type on the uploaded file.',
            'input' => [
                'type' => 'object',
                'properties' => [
                    'folder'     => ['type' => 'integer', 'description' => 'Resource folder index'],
                    'subpath'    => ['type' => 'string'],
                    'filename'   => ['type' => 'string', 'description' => 'Original filename (extension is kept, name is sanitized)'],
                    'media_only' => ['type' => 'boolean', 'description' => 'If true, the uploaded file must be an allowed image type'],
                ],
                'required' => ['folder', 'filename'],
                'additionalProperties' => false,
            ],
            'native' => fn(array $a, array $cfg, array $lic, string $user) =>
                mcp_upload_request($a, $cfg, $lic, $user, !empty($a['media_only'])),
        ],
        'resources_upload' => [
            'description' => 'Inline base64 upload — for TINY files only (under ~256 KB, e.g. favicons). '
                           . 'For anything larger, use `resources_upload_request` instead; inlining large base64 '
                           . 'strings will be rejected because they overflow the tool-call token budget.',
            'input' => [
                'type' => 'object',
                'properties' => [
                    'folder'       => ['type' => 'integer'],
                    'subpath'      => ['type' => 'string'],
                    'filename'     => ['type' => 'string'],
                    'content_b64'  => ['type' => 'string', 'description' => 'File bytes, base64-encoded. Max ~256 KB decoded.'],
                ],
                'required' => ['folder', 'filename', 'content_b64'],
                'additionalProperties' => false,
            ],
            'native' => fn(array $a, array $cfg, array $lic) => mcp_upload_resource($a, $cfg, $lic),
        ],
        'media_upload' => [
            'description' => 'Inline base64 image upload — for TINY images only (under ~256 KB). '
                           . 'For anything larger, use `resources_upload_request` with `media_only=true`. '
                           . 'Validates that the content is an allowed image type.',
            'input' => [
                'type' => 'object',
                'properties' => [
                    'folder'      => ['type' => 'integer', 'description' => 'Resource folder index (uses the primary resource folder by default)'],
                    'subpath'     => ['type' => 'string'],
                    'filename'    => ['type' => 'string'],
                    'content_b64' => ['type' => 'string', 'description' => 'Image bytes, base64-encoded. Max ~256 KB decoded.'],
                ],
                'required' => ['filename', 'content_b64'],
                'additionalProperties' => false,
            ],
            'native' => fn(array $a, array $cfg, array $lic) => mcp_upload_media($a, $cfg, $lic),
        ],

        // -------------------------------------------------------------------
        // Resource management (move / rename / delete / create folder) —
        // bridged to the SPA handlers, which the MCP bridge can drive
        // directly since it provides a matching CSRF token.
        // -------------------------------------------------------------------
        'resources_move' => [
            'description' => 'Move a resource file to a different subfolder and/or rename it. '
                           . 'The destination subfolder must already exist — call resources_create_folder first if needed. '
                           . 'The file extension is preserved from the source.',
            'input' => [
                'type' => 'object',
                'properties' => [
                    'folder'       => ['type' => 'integer', 'description' => 'Resource folder index'],
                    'file'         => ['type' => 'string', 'description' => 'Current filename (inside `subpath`)'],
                    'subpath'      => ['type' => 'string', 'description' => 'Current subfolder. Empty = folder root.'],
                    'dest_subpath' => ['type' => 'string', 'description' => 'Destination subfolder. Must already exist. Defaults to `subpath`.'],
                    'new_filename' => ['type' => 'string', 'description' => 'New base name. Extension is always preserved from the source. Optional — defaults to current name.'],
                ],
                'required' => ['folder', 'file'],
                'additionalProperties' => false,
            ],
            'handler' => ['resources.php', 'handle_resources_move'],
            'method'  => 'POST',
        ],
        'resources_rename' => [
            'description' => 'Rename a resource file in place. The file extension is preserved from the source.',
            'input' => [
                'type' => 'object',
                'properties' => [
                    'folder'  => ['type' => 'integer'],
                    'file'    => ['type' => 'string'],
                    'newName' => ['type' => 'string', 'description' => 'New base name (extension preserved)'],
                    'subpath' => ['type' => 'string'],
                ],
                'required' => ['folder', 'file', 'newName'],
                'additionalProperties' => false,
            ],
            'handler' => ['resources.php', 'handle_resources_rename'],
            'method'  => 'POST',
        ],
        'resources_delete' => [
            'description' => 'Delete a resource file. Unlike content_delete_item (which works on markdown items), this targets binary resources/media.',
            'input' => [
                'type' => 'object',
                'properties' => [
                    'folder'  => ['type' => 'integer'],
                    'file'    => ['type' => 'string'],
                    'subpath' => ['type' => 'string'],
                ],
                'required' => ['folder', 'file'],
                'additionalProperties' => false,
            ],
            'handler' => ['resources.php', 'handle_resources_delete'],
            'method'  => 'POST',
        ],
        'resources_create_folder' => [
            'description' => 'Create a subfolder inside a resource folder. Requires a license. '
                           . 'Name must be letters, numbers, hyphens, or underscores.',
            'input' => [
                'type' => 'object',
                'properties' => [
                    'folder'  => ['type' => 'integer'],
                    'subpath' => ['type' => 'string', 'description' => 'Parent subfolder (empty = root)'],
                    'name'    => ['type' => 'string', 'description' => 'New folder name'],
                ],
                'required' => ['folder', 'name'],
                'additionalProperties' => false,
            ],
            'handler' => ['resources.php', 'handle_resources_create_folder'],
            'method'  => 'POST',
        ],

        // -------------------------------------------------------------------
        // Settings (role enforcement happens inside the underlying handler)
        // -------------------------------------------------------------------
        'settings_get_theme' => [
            'description' => 'Read site theme settings.',
            'input' => ['type' => 'object', 'properties' => new stdClass(), 'additionalProperties' => false],
            'handler' => ['theme.php', 'handle_theme_get'],
            'method' => 'GET',
        ],
        'settings_update_theme' => [
            'description' => 'Update site theme settings (owner only).',
            'input' => [
                'type' => 'object',
                'properties' => [
                    'site_name'      => ['type' => 'string'],
                    'preset'         => ['type' => 'string', 'enum' => ['light', 'dark', 'auto']],
                    'accent_color'   => ['type' => 'string'],
                    'surface_color'  => ['type' => 'string'],
                    'font_heading'   => ['type' => 'string'],
                    'font_body'      => ['type' => 'string'],
                ],
                'additionalProperties' => true,
            ],
            'handler' => ['theme.php', 'handle_theme_update'],
            'method' => 'POST',
        ],
        'settings_list_users' => [
            'description' => 'List admin users (admin role required).',
            'input' => ['type' => 'object', 'properties' => new stdClass(), 'additionalProperties' => false],
            'handler' => ['users.php', 'handle_users_list'],
            'method' => 'GET',
        ],
        'settings_list_webhooks' => [
            'description' => 'List configured webhooks (owner role required).',
            'input' => ['type' => 'object', 'properties' => new stdClass(), 'additionalProperties' => false],
            'handler' => ['webhooks.php', 'handle_webhooks_list'],
            'method' => 'GET',
        ],

        // -------------------------------------------------------------------
        // Versions (Pro)
        // -------------------------------------------------------------------
        'versions_list' => [
            'description' => 'List saved versions for an item (requires license).',
            'input' => [
                'type' => 'object',
                'properties' => [
                    'folder'  => ['type' => 'integer'],
                    'file'    => ['type' => 'string'],
                    'subpath' => ['type' => 'string'],
                ],
                'required' => ['folder', 'file'],
                'additionalProperties' => false,
            ],
            'handler' => ['versions.php', 'handle_versions_list'],
            'method' => 'GET',
        ],
        'versions_read' => [
            'description' => 'Read a specific saved version of an item.',
            'input' => [
                'type' => 'object',
                'properties' => [
                    'folder'  => ['type' => 'integer'],
                    'file'    => ['type' => 'string'],
                    'version' => ['type' => 'string'],
                    'subpath' => ['type' => 'string'],
                ],
                'required' => ['folder', 'file', 'version'],
                'additionalProperties' => false,
            ],
            'handler' => ['versions.php', 'handle_versions_read'],
            'method' => 'GET',
        ],
        'versions_restore' => [
            'description' => 'Restore a previous version of an item (overwrites current).',
            'input' => [
                'type' => 'object',
                'properties' => [
                    'folder'  => ['type' => 'integer'],
                    'file'    => ['type' => 'string'],
                    'version' => ['type' => 'string'],
                    'subpath' => ['type' => 'string'],
                ],
                'required' => ['folder', 'file', 'version'],
                'additionalProperties' => false,
            ],
            'handler' => ['versions.php', 'handle_versions_restore'],
            'method' => 'POST',
        ],
    ];
}

/**
 * Tool definition in the shape MCP clients expect (tools/list response).
 */
function mcp_tool_descriptors(): array {
    $out = [];
    foreach (mcp_tool_registry() as $name => $def) {
        $out[] = [
            'name'        => $name,
            'description' => $def['description'],
            'inputSchema' => $def['input'],
        ];
    }
    return $out;
}

/**
 * Synthesized list of content collections — we don't have a direct handler
 * for this; the SPA reads it from the session response. For MCP clients we
 * surface it as a dedicated tool so the AI can discover what collections
 * exist on this install.
 */
function mcp_synth_list_collections(array $cfg): array {
    $folders = [];
    foreach (($cfg['folders'] ?? []) as $i => $f) {
        $folders[] = [
            'index'       => $i,
            'label'       => $f['label'] ?? '',
            'path'        => $f['path'] ?? '',
            'preview_url' => $f['preview_url'] ?? null,
            'field_types' => ensure_field_types($f['field_types'] ?? [], $f['path'] ?? ''),
        ];
    }
    return ['folders' => $folders, 'count' => count($folders)];
}
