<?php

// ---------------------------------------------------------------------------
// Free-tier defaults
// ---------------------------------------------------------------------------

const ALLOWED_LANGUAGES = ['en', 'sv', 'fr', 'de', 'nl'];

const FREE_TIER_THEME = [
    'site_name'      => 'Elements CMS',
    'logo'           => null,
    'logo_dark'      => null,
    'preset'         => 'light',
    'accent_color'   => 'purple',
    'surface_color'  => 'stone',
    'font_heading'   => 'system',
    'font_body'      => 'system',
    'custom_palette' => null,
];

if (!function_exists('ecms_normalize_text_encoding')) {
    /**
     * Normalize text content to UTF-8 while leaving obvious binary data alone.
     */
    function ecms_normalize_text_encoding(string $content): string
    {
        if ($content === '') {
            return $content;
        }

        if (str_starts_with($content, "\xEF\xBB\xBF")) {
            $content = substr($content, 3);
        }

        if (mb_check_encoding($content, 'UTF-8')) {
            return $content;
        }

        if (str_contains($content, "\0")) {
            return $content;
        }

        $converted = mb_convert_encoding($content, 'UTF-8', 'Windows-1252');
        return mb_check_encoding($converted, 'UTF-8') ? $converted : $content;
    }
}

// ---------------------------------------------------------------------------
// JSON Response Helpers
// ---------------------------------------------------------------------------

function json_response(mixed $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data, JSON_HEX_TAG | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error(string $message, int $status = 400): never {
    json_response(['error' => $message], $status);
}

function json_ok(string $message = 'OK'): never {
    json_response(['ok' => true, 'message' => $message]);
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function config_path(): string {
    return __DIR__ . '/config.php';
}

function config_exists(): bool {
    return file_exists(config_path());
}

function load_config(): array {
    if (!config_exists()) {
        json_error('Application not configured. Run setup first.', 503);
    }
    return require config_path();
}

function save_config(array $cfg): bool {
    $export = "<?php\nreturn " . var_export($cfg, true) . ";\n";
    $ok = file_put_contents(config_path(), $export, LOCK_EX) !== false;
    if ($ok && function_exists('opcache_invalidate')) {
        @opcache_invalidate(config_path(), true);
    }
    return $ok;
}

function admin_base_url(array $cfg): string {
    if (!empty($cfg['admin_url'])) {
        return $cfg['admin_url'];
    }
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host     = $_SERVER['HTTP_HOST'] ?? '';
    $base     = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
    return $protocol . '://' . $host . $base . '/';
}

// ---------------------------------------------------------------------------
// Session & Auth
// ---------------------------------------------------------------------------

const REMEMBER_ME_LIFETIME = 60 * 60 * 24 * 30; // 30 days
const REMEMBER_ME_COOKIE   = 'elements_spa_remember';

function start_session(array $cfg): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;

    $remember = !empty($_COOKIE[REMEMBER_ME_COOKIE]);
    $lifetime = $remember ? REMEMBER_ME_LIFETIME : 0;

    if ($remember) {
        ini_set('session.gc_maxlifetime', (string) REMEMBER_ME_LIFETIME);
    }

    session_set_cookie_params([
        'lifetime' => $lifetime,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_name($cfg['session_name'] ?? 'elements_spa_session');
    session_start();
}

function current_user(): string {
    return $_SESSION['username'] ?? '';
}

function current_role(): string {
    return $_SESSION['role'] ?? 'editor';
}

function is_admin(): bool {
    return in_array(current_role(), ['admin', 'owner'], true);
}

function is_owner(): bool {
    return current_role() === 'owner';
}

function is_logged_in(): bool {
    return !empty($_SESSION['logged_in']);
}

function require_login(): void {
    if (!is_logged_in()) {
        json_error('Authentication required.', 401);
    }
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
    }
}

function require_admin(): void {
    require_login();
    if (!is_admin()) {
        json_error('Admin access required.', 403);
    }
}

function require_owner(): void {
    require_login();
    if (!is_owner()) {
        json_error('Owner access required.', 403);
    }
}

// ---------------------------------------------------------------------------
// CSRF Protection
// ---------------------------------------------------------------------------

function verify_csrf(): void {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['csrf'] ?? '';
    if (empty($token) || empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $token)) {
        json_error('Invalid CSRF token.', 403);
    }
}

// ---------------------------------------------------------------------------
// Request Helpers
// ---------------------------------------------------------------------------

function require_post(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_error('Method not allowed.', 405);
    }
}

function get_json_body(): array {
    if (isset($GLOBALS['__handler_body_override']) && is_array($GLOBALS['__handler_body_override'])) {
        return $GLOBALS['__handler_body_override'];
    }
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) return $_POST;
    $data = json_decode($raw, true);
    return is_array($data) ? $data : $_POST;
}

function h(string $s): string {
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

// ---------------------------------------------------------------------------
// Front Matter Parsing
// ---------------------------------------------------------------------------

function is_assoc(array $arr): bool {
    return $arr !== [] && array_keys($arr) !== range(0, count($arr) - 1);
}

function parse_front_matter(string $content): array {
    $content = ecms_normalize_text_encoding($content);

    if (!str_starts_with($content, "---\n") && !str_starts_with($content, "---\r\n")) {
        return ['meta' => [], 'body' => $content];
    }
    $end = strpos($content, "\n---", 4);
    if ($end === false) {
        return ['meta' => [], 'body' => $content];
    }
    $yaml_block = substr($content, 4, $end - 4);
    $body = ltrim(substr($content, $end + 4));
    $meta = [];
    $parent_key = null;
    $item_index = -1;

    foreach (explode("\n", $yaml_block) as $line) {
        $line = rtrim($line, "\r");
        if ($line === '' || $line[0] === '#') continue;

        $is_indented = $line !== ltrim($line);

        if ($is_indented && $parent_key !== null) {
            $trimmed = ltrim($line);
            $is_list_item = str_starts_with($trimmed, '- ');
            if ($is_list_item) {
                $item_index++;
                $trimmed = substr($trimmed, 2);
            }
            $parts = explode(':', $trimmed, 2);
            if (count($parts) === 2) {
                $sub_key = trim($parts[0]);
                $sub_val = trim($parts[1]);
                $sub_val = trim($sub_val, '"\'');
                if (!is_array($meta[$parent_key])) {
                    $meta[$parent_key] = [];
                }
                if ($item_index >= 0) {
                    if (!isset($meta[$parent_key][$item_index])) {
                        $meta[$parent_key][$item_index] = [];
                    }
                    $meta[$parent_key][$item_index][$sub_key] = $sub_val;
                } else {
                    $meta[$parent_key][$sub_key] = $sub_val;
                }
            }
            continue;
        }

        $parent_key = null;
        $item_index = -1;
        $parts = explode(':', $line, 2);
        if (count($parts) === 2) {
            $key = trim($parts[0]);
            $val = trim($parts[1]);
            if ($val === '') {
                $parent_key = $key;
                $meta[$key] = [];
                continue;
            }
            if (str_starts_with($val, '[') && str_ends_with($val, ']')) {
                $inner = substr($val, 1, -1);
                $val = array_map(function ($i) {
                    $i = trim($i);
                    return trim($i, '"\'');
                }, explode(',', $inner));
                $val = array_values(array_filter($val, fn($i) => $i !== ''));
            } else {
                $val = trim($val, '"\'');
            }
            $meta[$key] = $val;
        }
    }
    return ['meta' => $meta, 'body' => $body];
}

function build_front_matter(array $meta, string $body, array $field_types = []): string {
    $yaml = "---\n";
    foreach ($meta as $k => $v) {
        if (is_array($v) && !is_assoc($v) && !empty($v) && is_array($v[0] ?? null) && is_assoc($v[0])) {
            $yaml .= "$k:\n";
            foreach ($v as $item) {
                $first = true;
                foreach ($item as $sk => $sv) {
                    $sv = (string) $sv;
                    if (needs_quoting($sv)) {
                        $sv = '"' . str_replace('"', '\\"', $sv) . '"';
                    }
                    $prefix = $first ? '  - ' : '    ';
                    $yaml .= "$prefix$sk: $sv\n";
                    $first = false;
                }
            }
            continue;
        }
        if (is_array($v) && is_assoc($v)) {
            $yaml .= "$k:\n";
            foreach ($v as $sk => $sv) {
                $sv = (string) $sv;
                if (needs_quoting($sv)) {
                    $sv = '"' . str_replace('"', '\\"', $sv) . '"';
                }
                $yaml .= "    $sk: $sv\n";
            }
            continue;
        }
        if (is_array($v)) {
            $v = '[' . implode(', ', $v) . ']';
            $yaml .= "$k: $v\n";
            continue;
        }
        $type = $field_types[$k] ?? null;
        if ($type === 'list') {
            $items = array_map('trim', explode(',', $v));
            $items = array_filter($items, fn($i) => $i !== '');
            $v = '[' . implode(', ', $items) . ']';
            $yaml .= "$k: $v\n";
            continue;
        }
        if (needs_quoting($v)) {
            $v = '"' . str_replace('"', '\\"', $v) . '"';
        }
        $yaml .= "$k: $v\n";
    }
    $yaml .= "---\n\n";
    return $yaml . $body;
}

function needs_quoting(string $v): bool {
    return str_contains($v, ':') ||
           str_contains($v, '#') ||
           str_starts_with($v, '[') ||
           str_starts_with($v, '{') ||
           $v !== trim($v);
}

// ---------------------------------------------------------------------------
// Field Type Inference
// ---------------------------------------------------------------------------

function infer_field_types(string $folder_path): array {
    $files = glob($folder_path . '/*.md');
    if (!$files) return ['title' => 'text'];

    usort($files, fn($a, $b) => filemtime($b) - filemtime($a));
    $parsed = parse_front_matter(file_get_contents($files[0]));
    if (empty($parsed['meta'])) return ['title' => 'text'];

    $types = [];
    foreach ($parsed['meta'] as $k => $v) {
        if (is_array($v) && !is_assoc($v) && !empty($v) && is_array($v[0] ?? null) && is_assoc($v[0])) {
            $sub_types = [];
            foreach ($v[0] as $sk => $sv) {
                $sub_types[$sk] = infer_single_type((string) $sv);
            }
            $types[$k] = ['object_list', $sub_types];
        } elseif (is_array($v) && is_assoc($v)) {
            foreach ($v as $sk => $sv) {
                $types["$k.$sk"] = infer_single_type($sv);
            }
        } elseif (is_array($v)) {
            $types[$k] = 'list';
        } else {
            $types[$k] = infer_single_type($v);
        }
    }
    return $types;
}

function infer_single_type(string $value): string {
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) return 'date';
    if (str_contains($value, '/resources/') || str_contains($value, '/uploads/')) return 'resource';
    return 'text';
}

function ensure_field_types(array $field_types, string $folder_path, array $file_meta = []): array {
    if (empty($field_types)) {
        $field_types = infer_field_types($folder_path);
    }

    foreach ($file_meta as $k => $v) {
        if (is_array($v) && !is_assoc($v) && !empty($v) && is_array($v[0] ?? null) && is_assoc($v[0])) {
            if (!isset($field_types[$k])) {
                $sub_types = [];
                foreach ($v[0] as $sk => $sv) {
                    $sub_types[$sk] = infer_single_type((string) $sv);
                }
                $field_types[$k] = ['object_list', $sub_types];
            }
        } elseif (is_array($v) && is_assoc($v)) {
            foreach ($v as $sk => $sv) {
                $dotKey = "$k.$sk";
                if (!isset($field_types[$dotKey])) {
                    $field_types[$dotKey] = infer_single_type((string) $sv);
                }
            }
        } elseif (is_array($v)) {
            if (!isset($field_types[$k])) {
                $field_types[$k] = 'list';
            }
        } else {
            if (!isset($field_types[$k])) {
                $field_types[$k] = infer_single_type((string) $v);
            }
        }
    }

    return $field_types;
}

function normalize_subpath(string $subpath): string {
    $subpath = trim($subpath, "/ \t\n\r\0\x0B");
    if ($subpath === '') return '';
    if (str_contains($subpath, '..') || str_contains($subpath, "\0")) return '';
    return preg_replace('#/+#', '/', $subpath);
}

function resolve_folder_schema(array $folder, string $subpath): array {
    $resolved = [
        'field_types'    => $folder['field_types']    ?? [],
        'field_defaults' => $folder['field_defaults'] ?? [],
        'preview_url'    => $folder['preview_url']    ?? '',
    ];

    $normalized = normalize_subpath($subpath);
    if ($normalized === '') return $resolved;

    $overrides = $folder['subfolder_schemas'] ?? [];
    if (!is_array($overrides) || empty($overrides)) return $resolved;

    $segments = explode('/', $normalized);
    $cumulative = '';
    foreach ($segments as $segment) {
        $cumulative = $cumulative === '' ? $segment : $cumulative . '/' . $segment;
        $entry = $overrides[$cumulative] ?? null;
        if (!is_array($entry)) continue;
        if (isset($entry['field_types']) && is_array($entry['field_types'])) {
            $resolved['field_types'] = $entry['field_types'];
        }
        if (isset($entry['field_defaults']) && is_array($entry['field_defaults'])) {
            $resolved['field_defaults'] = $entry['field_defaults'];
        }
        if (isset($entry['preview_url']) && is_string($entry['preview_url'])) {
            $resolved['preview_url'] = $entry['preview_url'];
        }
    }

    return $resolved;
}

function field_types_to_template(array $field_types, array $defaults = []): array {
    if (empty($field_types)) return ['title' => ''];

    $template = [];
    foreach ($field_types as $key => $type) {
        if (is_array($type) && ($type[0] ?? '') === 'object_list') {
            $template[$key] = [];
            continue;
        }
        if (str_contains($key, '.')) {
            [$parent, $child] = explode('.', $key, 2);
            if (!isset($template[$parent]) || !is_array($template[$parent])) {
                $template[$parent] = [];
            }
            $template[$parent][$child] = $defaults[$key] ?? '';
        } else {
            $template[$key] = $defaults[$key] ?? '';
        }
    }
    return $template;
}

// ---------------------------------------------------------------------------
// Path Validation
// ---------------------------------------------------------------------------

function safe_path(string $folder_path, string $filename): string|false {
    if (!preg_match('/^[\w\-]+\.md$/', $filename)) return false;
    $real_folder = realpath($folder_path);
    if ($real_folder === false) return false;
    $full = $real_folder . '/' . $filename;
    if (!str_starts_with($full, $real_folder . '/')) return false;
    return $full;
}

function safe_resource_path(string $uploads_path, string $filename): string|false {
    if ($filename === '' || str_contains($filename, '/') || str_contains($filename, '\\') || str_contains($filename, "\0")) {
        return false;
    }
    $real_folder = realpath($uploads_path);
    if ($real_folder === false) return false;
    $full = $real_folder . '/' . $filename;
    $real_full = realpath($full);
    if ($real_full === false || !str_starts_with($real_full, $real_folder . '/')) return false;
    return $real_full;
}

function safe_subpath(string $uploads_path, string $subpath): string|false {
    if ($subpath === '') return realpath($uploads_path) ?: false;
    if (str_contains($subpath, '..') || str_contains($subpath, "\0")) return false;
    $full = $uploads_path . '/' . $subpath;
    $real = realpath($full);
    $real_root = realpath($uploads_path);
    if ($real === false || $real_root === false) return false;
    if (!str_starts_with($real, $real_root . '/') && $real !== $real_root) return false;
    if (!is_dir($real)) return false;
    return $real;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function slugify(string $title): string {
    $s = mb_strtolower($title);
    $s = preg_replace('/[^a-z0-9\s\-]/', '', $s);
    $s = preg_replace('/[\s\-]+/', '-', $s);
    return trim($s, '-');
}

function parse_dated_filename(string $filename): array {
    $name = preg_replace('/\.md$/', '', $filename);
    if (preg_match('/^(\d{4}-\d{2}-\d{2})-(.+)$/', $name, $m)) {
        return ['date' => $m[1], 'slug' => $m[2]];
    }
    return ['date' => '', 'slug' => $name];
}

function sanitize_upload_name(string $name): string {
    $name = mb_strtolower($name);
    $name = preg_replace('/[^a-z0-9\-]/', '-', $name);
    $name = preg_replace('/-+/', '-', $name);
    return trim($name, '-');
}

function resize_image(string $path, array $resize_cfg): bool {
    $max_w = (int) ($resize_cfg['max_width'] ?? 1920);
    $max_h = (int) ($resize_cfg['max_height'] ?? 1920);
    $quality = max(10, min(100, (int) ($resize_cfg['quality'] ?? 85)));

    $info = @getimagesize($path);
    if ($info === false) return false;

    [$w, $h, $type] = $info;
    if ($w <= $max_w && $h <= $max_h) return false;

    $src = match ($type) {
        IMAGETYPE_JPEG => @imagecreatefromjpeg($path),
        IMAGETYPE_PNG  => @imagecreatefrompng($path),
        IMAGETYPE_WEBP => @imagecreatefromwebp($path),
        default        => false,
    };
    if ($src === false) return false;

    $scale = min($max_w / $w, $max_h / $h);
    $new_w = (int) round($w * $scale);
    $new_h = (int) round($h * $scale);

    $dst = imagescale($src, $new_w, $new_h, IMG_BICUBIC);
    imagedestroy($src);
    if ($dst === false) return false;

    if ($type === IMAGETYPE_PNG) {
        imagealphablending($dst, false);
        imagesavealpha($dst, true);
    }

    $ok = match ($type) {
        IMAGETYPE_JPEG => imagejpeg($dst, $path, $quality),
        IMAGETYPE_PNG  => imagepng($dst, $path),
        IMAGETYPE_WEBP => imagewebp($dst, $path, $quality),
        default        => false,
    };

    imagedestroy($dst);
    return $ok;
}

function detect_file_mime(string $path): ?string {
    if (defined('FILEINFO_MIME_TYPE') && function_exists('finfo_open') && function_exists('finfo_file') && function_exists('finfo_close')) {
        $finfo = @finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo !== false) {
            $mime = @finfo_file($finfo, $path);
            @finfo_close($finfo);
            if (is_string($mime) && $mime !== '') {
                return $mime;
            }
        }
    }

    if (function_exists('mime_content_type')) {
        $mime = @mime_content_type($path);
        if (is_string($mime) && $mime !== '') {
            return $mime;
        }
    }

    return null;
}

function detect_buffer_mime(string $bytes): ?string {
    if (!defined('FILEINFO_MIME_TYPE') || !function_exists('finfo_open') || !function_exists('finfo_buffer') || !function_exists('finfo_close')) {
        return null;
    }

    $finfo = @finfo_open(FILEINFO_MIME_TYPE);
    if ($finfo === false) {
        return null;
    }

    $mime = @finfo_buffer($finfo, $bytes);
    @finfo_close($finfo);

    return is_string($mime) && $mime !== '' ? $mime : null;
}

function image_mime_validation_error(?string $mime, array $allowed_img): ?string {
    if ($mime === null || $mime === '') {
        return 'Unable to verify image file type because the PHP fileinfo extension is unavailable.';
    }

    if (!in_array($mime, $allowed_img, true)) {
        return 'Only image files are allowed: ' . implode(', ', $allowed_img);
    }

    return null;
}

function human_filesize(int $bytes): string {
    if ($bytes < 1024) return $bytes . ' B';
    $units = ['KB', 'MB', 'GB'];
    $bytes = (float) $bytes;
    $i = -1;
    do { $bytes /= 1024; $i++; } while ($bytes >= 1024 && $i < count($units) - 1);
    return round($bytes, 1) . ' ' . $units[$i];
}

function get_folder(array $cfg, int|string $index): array|false {
    return $cfg['folders'][(int) $index] ?? false;
}

function get_resource_folder(array $cfg, int|string $index): array|false {
    return $cfg['resource_folders'][(int) $index] ?? false;
}

function require_folder(array $cfg, int|string|null $index, array $license = []): array {
    $i = (int) ($index ?? 0);
    if (empty($license['valid']) && $i > 0) json_error('Folder not found.', 404);
    $folder = get_folder($cfg, $i);
    if ($folder === false) json_error('Folder not found.', 404);
    return $folder;
}

function require_resource_folder(array $cfg, int|string|null $index, array $license = []): array {
    $i = (int) ($index ?? 0);
    if (empty($license['valid']) && $i > 0) json_error('Resource folder not found.', 404);
    $folder = get_resource_folder($cfg, $i);
    if ($folder === false) json_error('Resource folder not found.', 404);
    return $folder;
}

function label_conflicts(array $existing, string $label, ?int $ignore_index = null): bool {
    $needle = strtolower(trim($label));
    if ($needle === '') return false;
    foreach ($existing as $i => $entry) {
        if ($ignore_index !== null && $i === $ignore_index) continue;
        if (strtolower(trim($entry['label'] ?? '')) === $needle) return true;
    }
    return false;
}

function validate_folder_path(string $path): ?string {
    if (!is_dir($path)) return "Folder path does not exist: $path";
    if (!is_readable($path)) return "Folder is not readable: $path";
    if (!is_writable($path)) return "Folder is not writable: $path";
    return null;
}

function folder_display_path(string $path): string {
    $real_path = realpath($path) ?: rtrim($path, DIRECTORY_SEPARATOR);
    $real_path = rtrim(str_replace(DIRECTORY_SEPARATOR, '/', $real_path), '/');
    $doc_root_raw = $_SERVER['DOCUMENT_ROOT'] ?? '';
    $doc_root = $doc_root_raw !== '' ? realpath($doc_root_raw) : false;

    if ($doc_root !== false) {
        $doc_root = rtrim(str_replace(DIRECTORY_SEPARATOR, '/', $doc_root), '/');
        if ($real_path === $doc_root) {
            return '/';
        }
        if ($doc_root !== '' && str_starts_with($real_path, $doc_root . '/')) {
            return '/' . ltrim(substr($real_path, strlen($doc_root)), '/');
        }
    }

    $fallback = basename($real_path);
    return $fallback !== '' ? $fallback : $path;
}

function generate_uploads_url(string $real_path): string {
    $doc_root = realpath($_SERVER['DOCUMENT_ROOT']);
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'];

    if ($doc_root && str_starts_with($real_path, $doc_root)) {
        $relative = str_replace(DIRECTORY_SEPARATOR, '/', substr($real_path, strlen($doc_root)));
        return $protocol . '://' . $host . $relative;
    }
    $base = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
    return $protocol . '://' . $host . $base . '/uploads';
}

function resource_info(string $uploads_path, string $uploads_url, array $allowed_img, string $name, string $subpath = ''): array {
    $full = $uploads_path . '/' . $name;
    $mime = detect_file_mime($full);

    $url_prefix = $uploads_url;
    if ($subpath !== '') {
        $url_prefix .= '/' . implode('/', array_map('rawurlencode', explode('/', $subpath)));
    }

    return [
        'name'     => $name,
        'url'      => $url_prefix . '/' . rawurlencode($name),
        'size'     => filesize($full),
        'modified' => filemtime($full),
        'is_image' => $mime !== null && in_array($mime, $allowed_img, true),
    ];
}

// ---------------------------------------------------------------------------
// Client Config
// ---------------------------------------------------------------------------

/**
 * The single user permitted under the free tier: the first owner in
 * insertion order. All other users are blocked at login when unlicensed.
 */
function surviving_user(array $cfg): ?string {
    foreach ($cfg['users'] ?? [] as $username => $data) {
        if (($data['role'] ?? null) === 'owner') {
            return $username;
        }
    }
    return null;
}

/**
 * Free-tier numeric defaults applied when no signed licence payload is present.
 * Kept intentionally minimal — these are the only limit values that exist in
 * CMS code. All other tier limits arrive in the Ed25519-signed `/api/check`
 * payload and can't be changed by editing source.
 */
function free_tier_limits(): array {
    return [
        'version_history_days' => 7,
        'max_users'            => 1,
        'max_content_folders'  => 1,
        'max_resource_folders' => 1,
        'theme_customization'  => false,
        'webhooks'             => false,
        'ai'                   => false,
        'api_tokens'           => false,
        'mcp_tokens'           => false,
    ];
}

/**
 * Return a safe subset of config for the client.
 * Limits come from the signed licence payload (paid tiers) or free defaults.
 * Server-side enforcement of limits lives inline in each gated handler — this
 * function only shapes the client-visible config for SPA UX (clamping display
 * lists, telling the SPA which features are unlocked).
 */
function client_config(array $cfg, array $license = []): array {
    $limits = is_array($license['limits'] ?? null) ? $license['limits'] : free_tier_limits();

    $folders = [];
    foreach ($cfg['folders'] as $i => $f) {
        $entry = [
            'index'        => $i,
            'label'        => $f['label'],
            'display_path' => folder_display_path($f['path'] ?? ''),
        ];
        if (!empty($f['preview_url'])) {
            $entry['preview_url'] = $f['preview_url'];
        }
        $folders[] = $entry;
    }

    $resource_folders = [];
    foreach ($cfg['resource_folders'] ?? [] as $i => $uf) {
        $resource_folders[] = [
            'index'        => $i,
            'label'        => $uf['label'],
            'display_path' => folder_display_path($uf['path'] ?? ''),
        ];
    }

    $theme = $cfg['theme'] ?? FREE_TIER_THEME;
    $clamped = [];
    $users_total     = count($cfg['users'] ?? []);
    $users_surviving = surviving_user($cfg);

    $max_content_folders  = $limits['max_content_folders']  ?? null;
    $max_resource_folders = $limits['max_resource_folders'] ?? null;
    $max_users            = $limits['max_users']            ?? null;

    if ($max_content_folders !== null && count($folders) > $max_content_folders) {
        $folders = array_slice($folders, 0, $max_content_folders);
        $clamped[] = 'folders';
    }
    if ($max_resource_folders !== null && count($resource_folders) > $max_resource_folders) {
        $resource_folders = array_slice($resource_folders, 0, $max_resource_folders);
        $clamped[] = 'resource_folders';
    }
    if (empty($limits['theme_customization']) && $theme !== FREE_TIER_THEME) {
        $theme = FREE_TIER_THEME;
        $clamped[] = 'theme';
    }
    if ($max_users !== null && $users_total > $max_users) {
        $clamped[] = 'users';
    }

    return [
        'folders'          => $folders,
        'resource_folders' => $resource_folders,
        'theme'            => $theme,
        'max_upload_bytes' => $cfg['max_upload_bytes'] ?? 5242880,
        'resources_path'   => $cfg['resources']['path'] ?? '/resources',
        'language'         => $cfg['language'] ?? 'en',
        'limits'           => $limits,
        'clamped_features' => $clamped,
        'users_total'      => $users_total,
        'users_surviving'  => $users_surviving,
    ];
}
