<?php

// ---------------------------------------------------------------------------
// MCP JSON-RPC server (stateless, Streamable HTTP transport, JSON-only).
// ---------------------------------------------------------------------------
// Flow:
//   1. Validate method (POST expected; GET/HEAD return 405 per spec since
//      the server has no SSE stream to open). Note: server is stateless and
//      never issues an Mcp-Session-Id — the spec allows this. Don't add
//      session storage here without re-reading the Streamable HTTP spec.
//   2. Parse request body as JSON-RPC 2.0.
//   3. Authenticate. Two bearer families are accepted, in order:
//        a. `mcp_<...>`   — admin-issued static tokens (php/mcp/tokens.php).
//                           Accepted via Authorization header *or* ?token=
//                           query param (the URL-paste path used by
//                           Claude Desktop's Custom Connector).
//        b. `oauth_<...>` — OAuth 2.1 + DCR access tokens. Header only.
//      The OAuth path remains the recommended option for clients that can
//      drive a browser; static tokens exist for environments that can't
//      (one-click .mcpb installs, automated tools, etc.).
//   4. Dispatch on method:
//        initialize                  → server info + capabilities
//        ping                        → {}
//        tools/list                  → descriptors
//        tools/call                  → native handler OR bridged handler
//        resources/list              → catalog
//        resources/read              → read a resource
//        notifications/initialized   → no-op (202)
//
// Bridged tool calls terminate the request inside the handler (json_response
// exits). Everything else returns via mcp_rpc_success/error.

require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../license-check.php';
require_once __DIR__ . '/../oauth/storage.php';
require_once __DIR__ . '/tokens.php';
require_once __DIR__ . '/tools.php';
require_once __DIR__ . '/resources.php';
require_once __DIR__ . '/handler-bridge.php';

const MCP_PROTOCOL_VERSION = '2025-11-25';
const MCP_SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const MCP_SERVER_NAME      = 'rw-elements-cms';
const MCP_SERVER_VERSION   = '1.0.0';

function mcp_serve(): void {
    // --- Transport-level checks ---

    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($method === 'OPTIONS') {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version, Accept');
        header('Access-Control-Max-Age: 3600');
        http_response_code(204);
        exit;
    }

    header('Access-Control-Allow-Origin: *');

    // GET/HEAD: per the Streamable HTTP spec, GET opens an SSE stream for
    // server→client notifications. This server has nothing to push, so we
    // return 405 with Allow per spec. Spec-compliant clients (including
    // Claude.ai) discover this via OAuth instead of probing GET.
    if ($method === 'GET' || $method === 'HEAD') {
        http_response_code(405);
        header('Allow: POST, OPTIONS');
        exit;
    }

    if ($method === 'DELETE') {
        // No persistent session to terminate.
        http_response_code(405);
        header('Allow: POST, OPTIONS');
        exit;
    }

    if ($method !== 'POST') {
        mcp_http_error(405, 'Method not allowed.');
    }

    // Optional protocol-version pin: clients may send MCP-Protocol-Version
    // to assert which spec revision they expect. Reject unsupported values.
    $client_proto = (string) ($_SERVER['HTTP_MCP_PROTOCOL_VERSION'] ?? '');
    if ($client_proto !== '' && !in_array($client_proto, MCP_SUPPORTED_PROTOCOL_VERSIONS, true)) {
        mcp_http_error(400, 'Unsupported MCP protocol version: ' . $client_proto);
    }

    // Soft Accept negotiation: clients SHOULD send `application/json,
    // text/event-stream`, but we always respond with JSON and stay permissive.

    // --- Parse request body ---

    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) {
        mcp_rpc_error(null, -32700, 'Parse error: empty body');
    }
    $req = json_decode($raw, true);
    if (!is_array($req)) {
        mcp_rpc_error(null, -32700, 'Parse error: invalid JSON');
    }

    // JSON-RPC batching: allowed for notification/list requests but
    // forbidden if any member triggers a handler bridge (handler exits
    // the process). We simply refuse batches in v1 — clients may still
    // send single requests.
    if (array_is_list($req)) {
        mcp_rpc_error(null, -32600, 'Batched requests are not supported.');
    }

    $rpc_id = $req['id'] ?? null;
    $rpc_method = $req['method'] ?? '';
    $params = $req['params'] ?? [];

    // --- Auth ---

    if (!config_exists()) {
        mcp_rpc_error($rpc_id, -32001, 'CMS install is not configured.');
    }
    $cfg = require config_path();

    // License gate — MCP is a paid-tier feature. Inlined verify-and-read of
    // the cached signed licence payload using only libsodium primitives. NOT
    // factored into a shared helper — see plan in /Users/ben/.claude/plans/.
    $license = get_license_state();
    $_lic_path = __DIR__ . '/../.elements_license_state.json';
    $_lic_data = is_file($_lic_path) ? json_decode((string) @file_get_contents($_lic_path), true) : null;
    $_lic_entry = null;
    if (is_array($_lic_data)) foreach ($_lic_data as $_e) {
        if (!is_array($_e) || ($_e['valid'] ?? false) !== true) continue;
        if (($_e['key_id'] ?? '') !== 'v1') continue;
        $_b64 = strtr((string) ($_e['signature'] ?? ''), '-_', '+/');
        $_b64 .= str_repeat('=', (4 - strlen($_b64) % 4) % 4);
        $_sig = base64_decode($_b64, true);
        if (!is_string($_sig) || strlen($_sig) !== SODIUM_CRYPTO_SIGN_BYTES) continue;
        $_body = $_e; unset($_body['signature']);
        $_sort = function ($v) use (&$_sort) {
            if (!is_array($v)) return $v;
            $list = true; $i = 0;
            foreach ($v as $k => $_) { if ($k !== $i++) { $list = false; break; } }
            if (!$list) ksort($v);
            return array_map($_sort, $v);
        };
        $_canonical = json_encode($_sort($_body), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        // Generated from tools/license-gate-public-keys.json; run npm run sync:license-gates after rotations.
        foreach ([
            'G8OMWLmn6Mmga5u0f9r+3WN15R507VffM+lEDRKO9VY=',
        ] as $_pub_b64) {
            $_pub = base64_decode($_pub_b64, true);
            if (!is_string($_pub) || strlen($_pub) !== SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES) continue;
            try {
                if (sodium_crypto_sign_verify_detached($_sig, $_canonical, $_pub)) { $_lic_entry = $_e; break 2; }
            } catch (\SodiumException $_ex) {}
        }
    }
    if (!is_array($_lic_entry['limits'] ?? null) || empty($_lic_entry['limits']['mcp_tokens'])) {
        mcp_rpc_error($rpc_id, -32001, 'MCP access requires Studio plan for this domain.');
    }

    // Try the static `mcp_…` family first (header *or* ?token= query param);
    // fall through to OAuth `oauth_…` (header only) if no MCP token matched.
    $username = null;

    $mcp_bearer = mcp_read_bearer();
    if ($mcp_bearer !== null) {
        $match = mcp_token_resolve($cfg, $mcp_bearer);
        if ($match === null) {
            mcp_send_bearer_challenge($rpc_id, 'Invalid bearer token.', 'invalid_token');
        }
        $username = (string) ($match['token']['username'] ?? '');
        if ($username === '' || !isset($cfg['users'][$username])) {
            mcp_send_bearer_challenge($rpc_id, 'Token owner no longer exists.', 'invalid_token');
        }
        mcp_token_touch($cfg, $match['index']);
    } else {
        $oauth_bearer = oauth_read_bearer_header();
        if ($oauth_bearer === null) {
            mcp_send_bearer_challenge($rpc_id, 'Missing bearer token.');
        }
        $match = oauth_access_token_resolve($cfg, $oauth_bearer);
        if ($match === null) {
            mcp_send_bearer_challenge($rpc_id, 'Invalid bearer token.', 'invalid_token');
        }
        $username = (string) $match['username'];
        if ($username === '' || !isset($cfg['users'][$username])) {
            mcp_send_bearer_challenge($rpc_id, 'Token owner no longer exists.', 'invalid_token');
        }
        oauth_access_token_touch($cfg, $match['index']);
    }

    // --- Method dispatch ---

    // JSON-RPC notifications (no `id`) never get a response body.
    $is_notification = !array_key_exists('id', $req);

    switch ($rpc_method) {
        case 'initialize':
            $client_version = (string) ($params['protocolVersion'] ?? '');
            mcp_rpc_success($rpc_id, mcp_initialize_result($cfg, $username, $client_version));
            return;

        case 'notifications/initialized':
        case 'notifications/cancelled':
            http_response_code(202);
            exit;

        case 'ping':
            mcp_rpc_success($rpc_id, new stdClass());
            return;

        case 'tools/list':
            mcp_rpc_success($rpc_id, ['tools' => mcp_tool_descriptors()]);
            return;

        case 'tools/call':
            mcp_handle_tools_call($rpc_id, $params, $cfg, $username);
            return;

        case 'resources/list':
            mcp_rpc_success($rpc_id, ['resources' => mcp_resource_catalog($cfg, $username)]);
            return;

        case 'resources/read':
            $uri = (string) ($params['uri'] ?? '');
            $read = mcp_resource_read($uri, $cfg, $username);
            if ($read === null) {
                mcp_rpc_error($rpc_id, -32002, 'Resource not found: ' . $uri);
            }
            mcp_rpc_success($rpc_id, ['contents' => [$read]]);
            return;

        case 'prompts/list':
            mcp_rpc_success($rpc_id, ['prompts' => []]);
            return;

        default:
            if ($is_notification) {
                http_response_code(202);
                exit;
            }
            mcp_rpc_error($rpc_id, -32601, 'Method not found: ' . $rpc_method);
    }
}

// ---------------------------------------------------------------------------
// initialize
// ---------------------------------------------------------------------------

function mcp_initialize_result(array $cfg, string $username, string $client_version = ''): array {
    $theme = $cfg['theme'] ?? [];
    $user = $cfg['users'][$username] ?? [];
    // Echo back the client's requested version when we support it. Some clients
    // disconnect if the server unilaterally bumps to a newer spec revision.
    $version = in_array($client_version, MCP_SUPPORTED_PROTOCOL_VERSIONS, true)
        ? $client_version
        : MCP_PROTOCOL_VERSION;
    return [
        'protocolVersion' => $version,
        'capabilities' => [
            'tools'     => ['listChanged' => false],
            'resources' => ['listChanged' => false, 'subscribe' => false],
        ],
        'serverInfo' => [
            'name'    => MCP_SERVER_NAME,
            'title'   => ($theme['site_name'] ?? 'Elements CMS') . ' — MCP',
            'version' => MCP_SERVER_VERSION,
        ],
        'instructions' => mcp_server_instructions($cfg, $username, $user['role'] ?? 'editor'),
    ];
}

function mcp_server_instructions(array $cfg, string $username, string $role): string {
    $site = $cfg['theme']['site_name'] ?? 'this site';
    $folder_count = count($cfg['folders'] ?? []);
    return <<<TXT
You are connected to the Elements CMS for "{$site}".

This install has {$folder_count} content collection(s). Start with the
`content_list_collections` tool to see what's available, then use
`content_list_items` and `content_read_item` to explore specific items.

For authoring, use `content_create_item` / `content_update_item` /
`content_delete_item`. Collection field schemas are exposed under
each collection's field_types.

To add a new top-level content collection, use `content_create_collection`
with a user-confirmed label and server filesystem path. If the desired
location is ambiguous, inspect existing collection paths, suggest a likely
sibling path, and ask the user to confirm before creating it.

Resources under cms://site, cms://collections, and cms://collection/{N}
give you browseable context without tool calls.

You are acting as the user "{$username}" with role "{$role}".
TXT;
}

// ---------------------------------------------------------------------------
// tools/call
// ---------------------------------------------------------------------------

function mcp_handle_tools_call(string|int|null $rpc_id, array $params, array $cfg, string $username): void {
    $name = (string) ($params['name'] ?? '');
    $args = $params['arguments'] ?? [];
    if (!is_array($args)) $args = [];

    $registry = mcp_tool_registry();
    if (!isset($registry[$name])) {
        mcp_rpc_error($rpc_id, -32602, 'Unknown tool: ' . $name);
    }
    $def = $registry[$name];

    // Load license once — both native and bridged tools need it.
    require_once __DIR__ . '/../license-check.php';
    $license = function_exists('get_license_state') ? get_license_state() : ['valid' => false];

    // Native tools: call directly, wrap result.
    if (isset($def['native'])) {
        $result = ($def['native'])($args, $cfg, $license, $username);
        if (is_array($result) && !empty($result['__mcp_native_error'])) {
            $payload = ['content' => [[
                'type' => 'text',
                'text' => $result['message'] ?? 'Error',
            ]], 'isError' => true];
            mcp_rpc_success($rpc_id, $payload);
            return;
        }
        mcp_rpc_success($rpc_id, [
            'content' => [[
                'type' => 'text',
                'text' => json_encode($result, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
            ]],
            'structuredContent' => $result,
            'isError' => false,
        ]);
        return;
    }

    // Bridged tools: set up fake globals, install output capture, invoke.
    if (!isset($def['handler'])) {
        mcp_rpc_error($rpc_id, -32603, 'Tool has no handler: ' . $name);
    }

    [$handler_file, $handler_func] = $def['handler'];
    $method = $def['method'] ?? 'GET';

    mcp_install_response_bridge($rpc_id, $name);
    mcp_prepare_handler_context($args, $method, $cfg, $username);

    require_once __DIR__ . '/../handlers/' . $handler_file;
    if (!function_exists($handler_func)) {
        mcp_bridge_error('Handler function not found: ' . $handler_func, 500);
    }
    $handler_func($cfg, $license);
    // never reached — handler calls json_response which exits
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function mcp_rpc_success(string|int|null $id, mixed $result): never {
    http_response_code(200);
    header('Content-Type: application/json');
    echo json_encode([
        'jsonrpc' => '2.0',
        'id'      => $id,
        'result'  => $result,
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

function mcp_rpc_error(string|int|null $id, int $code, string $message): never {
    http_response_code(200);
    header('Content-Type: application/json');
    echo json_encode([
        'jsonrpc' => '2.0',
        'id'      => $id,
        'error'   => ['code' => $code, 'message' => $message],
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

function mcp_http_error(int $status, string $message): never {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode(['error' => $message]);
    exit;
}

/**
 * Send a 401 with an RFC 9728-style WWW-Authenticate challenge that points
 * clients at our protected-resource metadata document. Body is JSON-RPC so
 * spec-compliant clients can still parse the error.
 */
function mcp_send_bearer_challenge(string|int|null $rpc_id, string $message, ?string $error_code = null): never {
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $self   = strtok($_SERVER['REQUEST_URI'] ?? '/', '?');
    $base   = rtrim(dirname($self), '/');
    $metadata_url = $scheme . '://' . $host . $base . '/.well-known/oauth-protected-resource';

    $challenge = 'Bearer realm="mcp", resource_metadata="' . $metadata_url . '"';
    if ($error_code !== null) {
        $challenge .= ', error="' . $error_code . '", error_description="' . str_replace('"', '\\"', $message) . '"';
    }
    header('WWW-Authenticate: ' . $challenge);
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode([
        'jsonrpc' => '2.0',
        'id'      => $rpc_id,
        'error'   => ['code' => -32001, 'message' => $message],
    ], JSON_UNESCAPED_SLASHES);
    exit;
}
