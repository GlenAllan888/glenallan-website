<?php

// ---------------------------------------------------------------------------
// Native upload tools for MCP.
// ---------------------------------------------------------------------------
// Two ingestion paths:
//
//   1. Inline base64 (resources_upload / media_upload). Kept for very small
//      files only — anything over ~256 KB blows up the model's tool-call
//      context window. The cap here is deliberately aggressive so the model
//      falls back to the ticket flow for real uploads.
//
//   2. One-shot upload ticket (resources_upload_request). An MCP call mints
//      a short-lived URL; the client does a genuine multipart POST to that
//      URL (e.g. via curl). The bytes never pass through the model.
//
// Both paths converge on mcp_write_bytes(), which runs the same pipeline
// the legacy handlers use: subpath resolution, extension guard, MIME sniff
// for media, write, optional resize, resource_info.

// Hard ceilings:
const MCP_UPLOAD_MAX_BYTES       = 10 * 1024 * 1024;   // ticket path
const MCP_UPLOAD_MAX_BYTES_B64   = 256 * 1024;         // inline b64 path (decoded)
const MCP_UPLOAD_TICKET_TTL_SEC  = 120;

// ---------------------------------------------------------------------------
// Inline base64 uploads (resources_upload / media_upload).
// ---------------------------------------------------------------------------

function mcp_upload_resource(array $args, array $cfg, array $license): array {
    $folder_index = (int) ($args['folder'] ?? 0);
    $folder = get_resource_folder($cfg, $folder_index);
    if ($folder === false) {
        return mcp_native_error('Resource folder not found.', 404);
    }
    return mcp_upload_to_folder($args, $cfg, $license, $folder, false);
}

function mcp_upload_media(array $args, array $cfg, array $license): array {
    $folder_index = (int) ($args['folder'] ?? 0);
    $folder = get_resource_folder($cfg, $folder_index);
    if ($folder === false) {
        return mcp_native_error('Resource folder not found.', 404);
    }
    return mcp_upload_to_folder($args, $cfg, $license, $folder, true);
}

function mcp_upload_to_folder(array $args, array $cfg, array $license, array $folder, bool $image_only): array {
    $filename = trim((string) ($args['filename'] ?? ''));
    $content_b64 = (string) ($args['content_b64'] ?? '');
    $subpath = (string) ($args['subpath'] ?? '');

    if ($filename === '' || $content_b64 === '') {
        return mcp_native_error('filename and content_b64 are required.');
    }

    // Reject outsized base64 before we even decode, so we don't waste
    // memory on payloads we're going to refuse anyway. ~4/3 expansion +
    // slack for line breaks.
    $b64_ceiling = (int) (MCP_UPLOAD_MAX_BYTES_B64 * 4 / 3) + 256;
    if (strlen($content_b64) > $b64_ceiling) {
        return mcp_native_error(mcp_oversize_b64_message());
    }

    $bytes = base64_decode($content_b64, true);
    if ($bytes === false) {
        return mcp_native_error('content_b64 is not valid base64.');
    }

    if (strlen($bytes) > MCP_UPLOAD_MAX_BYTES_B64) {
        return mcp_native_error(mcp_oversize_b64_message());
    }

    return mcp_write_bytes($bytes, $cfg, $license, $folder, $filename, $subpath, $image_only);
}

function mcp_oversize_b64_message(): string {
    $kb = (int) round(MCP_UPLOAD_MAX_BYTES_B64 / 1024);
    return "Inline base64 upload is limited to ~{$kb} KB. "
         . "For larger files call resources_upload_request to mint a one-shot "
         . "upload URL, then POST the file to it (e.g. curl -F file=@path URL).";
}

// ---------------------------------------------------------------------------
// Upload tickets (resources_upload_request).
// ---------------------------------------------------------------------------

function mcp_upload_request(array $args, array $cfg, array $license, string $username, bool $image_only): array {
    $folder_index = (int) ($args['folder'] ?? 0);
    $folder = get_resource_folder($cfg, $folder_index);
    if ($folder === false) {
        return mcp_native_error('Resource folder not found.', 404);
    }

    $filename = trim((string) ($args['filename'] ?? ''));
    if ($filename === '') {
        return mcp_native_error('filename is required.');
    }

    $subpath = (string) ($args['subpath'] ?? '');
    if ($subpath !== '' && empty($license['valid'])) {
        return mcp_native_error('License required to upload to subfolders.', 403);
    }

    // Basic extension guard up-front so we don't hand out a URL that's
    // guaranteed to fail on consume.
    $ext = mb_strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    if (in_array($ext, ['php', 'phtml', 'php3', 'php4', 'php5', 'shtml'], true)) {
        return mcp_native_error('File type not allowed.');
    }

    $ticket_id = bin2hex(random_bytes(16));
    $expires_at = time() + MCP_UPLOAD_TICKET_TTL_SEC;

    // Purge expired/used tickets, then append the new one.
    $tickets = array_values(array_filter(
        $cfg['upload_tickets'] ?? [],
        fn($t) => empty($t['used']) && (int) ($t['expires_at'] ?? 0) > time()
    ));
    $tickets[] = [
        'id'         => $ticket_id,
        'folder'     => $folder_index,
        'subpath'    => $subpath,
        'filename'   => $filename,
        'image_only' => $image_only,
        'email'      => $username,
        'expires_at' => $expires_at,
        'used'       => false,
    ];
    $cfg['upload_tickets'] = $tickets;
    if (!save_config($cfg)) {
        return mcp_native_error('Failed to persist upload ticket.', 500);
    }

    $upload_url = mcp_ticket_upload_url($ticket_id);
    $mb = (int) round(MCP_UPLOAD_MAX_BYTES / 1024 / 1024);
    return [
        'upload_url' => $upload_url,
        'ticket_id'  => $ticket_id,
        'expires_at' => gmdate('c', $expires_at),
        'ttl_seconds'=> MCP_UPLOAD_TICKET_TTL_SEC,
        'max_bytes'  => MCP_UPLOAD_MAX_BYTES,
        'curl_hint'  => "curl -sS -F file=@/path/to/{$filename} '{$upload_url}'",
        'notes'      => "POST the file as multipart/form-data with field name 'file'. "
                      . "The URL is one-shot and expires in " . MCP_UPLOAD_TICKET_TTL_SEC . "s. "
                      . "Max file size: {$mb} MB.",
    ];
}

function mcp_ticket_upload_url(string $ticket_id): string {
    $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    $protocol = $https ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    // mcp.php lives next to api.php in /editor/.
    $base = rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/editor/mcp.php'), '/');
    return $protocol . '://' . $host . $base . '/api.php?action=upload.with_ticket&ticket=' . $ticket_id;
}

/**
 * Find a valid ticket by id, mark it used, and return its record.
 * Returns null if missing / expired / already used. Writes config.
 */
function mcp_consume_upload_ticket(array &$cfg, string $ticket_id): ?array {
    $tickets = $cfg['upload_tickets'] ?? [];
    $now = time();
    $found = null;

    $kept = [];
    foreach ($tickets as $t) {
        $expired = (int) ($t['expires_at'] ?? 0) <= $now;
        $used    = !empty($t['used']);
        if (!$found && !$expired && !$used && ($t['id'] ?? '') === $ticket_id) {
            $found = $t;
            // Drop it — one-shot.
            continue;
        }
        if (!$expired && !$used) {
            $kept[] = $t;
        }
    }

    if ($found === null) return null;

    $cfg['upload_tickets'] = $kept;
    save_config($cfg);
    return $found;
}

// ---------------------------------------------------------------------------
// Shared write pipeline (used by inline b64 and by the ticket consumer).
// ---------------------------------------------------------------------------

/**
 * Write $bytes into $folder under $filename/$subpath, running the same
 * guards the legacy handlers use. Returns either a resource_info array
 * (success) or an mcp_native_error array.
 */
function mcp_write_bytes(
    string $bytes,
    array $cfg,
    array $license,
    array $folder,
    string $filename,
    string $subpath,
    bool $image_only
): array {
    if ($subpath !== '' && empty($license['valid'])) {
        return mcp_native_error('License required to upload to subfolders.', 403);
    }

    $max_bytes = min((int) ($cfg['max_upload_bytes'] ?? MCP_UPLOAD_MAX_BYTES), MCP_UPLOAD_MAX_BYTES);
    if (strlen($bytes) > $max_bytes) {
        return mcp_native_error('File exceeds maximum size of ' . round($max_bytes / 1024 / 1024) . ' MB.');
    }

    $uploads_path = $folder['path'];
    $uploads_url = rtrim($folder['url'] ?? '', '/');
    $allowed_img = $cfg['allowed_image_types'] ?? ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    $blocked_ext = ['php', 'phtml', 'php3', 'php4', 'php5', 'shtml'];

    $resolved = safe_subpath($uploads_path, $subpath);
    if ($resolved === false) {
        return mcp_native_error('Invalid subpath.');
    }

    $ext = mb_strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    if (in_array($ext, $blocked_ext, true)) {
        return mcp_native_error('File type not allowed.');
    }

    if ($image_only) {
        $mime = detect_buffer_mime($bytes);
        $mime_error = image_mime_validation_error($mime, $allowed_img);
        if ($mime_error !== null) {
            return mcp_native_error($mime_error, $mime === null ? 500 : 400);
        }
    }

    $original = sanitize_upload_name(pathinfo($filename, PATHINFO_FILENAME));
    if ($original === '') $original = $image_only ? 'image' : 'file';
    $ext_suffix = $ext ? '.' . preg_replace('/[^a-z0-9]/', '', $ext) : '';
    $dest_name = $original . '-' . uniqid() . $ext_suffix;
    $dest = $resolved . '/' . $dest_name;

    if (file_put_contents($dest, $bytes, LOCK_EX) === false) {
        return mcp_native_error('Failed to save file.', 500);
    }

    $resize_cfg = $folder['image_resize'] ?? [];
    if (!empty($resize_cfg['enabled']) && !empty($license['valid'])) {
        resize_image($dest, $resize_cfg);
    }

    return resource_info($resolved, $uploads_url, $allowed_img, $dest_name, $subpath);
}

function mcp_native_error(string $message, int $status = 400): array {
    return ['__mcp_native_error' => true, 'status' => $status, 'message' => $message];
}
