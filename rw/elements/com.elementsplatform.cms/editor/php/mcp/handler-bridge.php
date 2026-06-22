<?php

// ---------------------------------------------------------------------------
// MCP response envelope on top of the shared handler-bridge.
// ---------------------------------------------------------------------------
// Delegates context setup and output capture to editor/php/handler-bridge.php
// and provides the MCP-specific JSON-RPC wrapper.

require_once __DIR__ . '/../handler-bridge.php';

function mcp_prepare_handler_context(array $args, string $method, array $cfg, string $username): void {
    handler_bridge_prepare_context($args, $method, $cfg, $username, 'mcp_bridge_error');
}

function mcp_install_response_bridge(string|int|null $rpc_id, string $tool_name): void {
    $GLOBALS['__mcp_bridge_rpc_id'] = $rpc_id;
    $GLOBALS['__mcp_bridge_tool']   = $tool_name;

    handler_bridge_install(function (string $raw, int $status): void {
        // JSON-RPC responses are always HTTP 200; business errors are
        // conveyed inside the envelope.
        http_response_code(200);
        header('Content-Type: application/json');

        $rpc_id  = $GLOBALS['__mcp_bridge_rpc_id'] ?? null;
        $decoded = json_decode($raw, true);

        if ($status >= 400) {
            $msg = is_array($decoded) ? ($decoded['error'] ?? 'Tool error') : 'Tool error';
            echo json_encode([
                'jsonrpc' => '2.0',
                'id'      => $rpc_id,
                'result'  => [
                    'content' => [[
                        'type' => 'text',
                        'text' => is_string($msg) ? $msg : json_encode($msg),
                    ]],
                    'isError' => true,
                ],
            ], JSON_UNESCAPED_SLASHES);
            return;
        }

        $payload = is_array($decoded) ? $decoded : ['raw' => $raw];
        $text    = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);

        echo json_encode([
            'jsonrpc' => '2.0',
            'id'      => $rpc_id,
            'result'  => [
                'content' => [[
                    'type' => 'text',
                    'text' => $text,
                ]],
                'structuredContent' => $payload,
                'isError' => false,
            ],
        ], JSON_UNESCAPED_SLASHES);
    });
}

/**
 * Emit an MCP-level error and exit. Used for bridge setup failures
 * (before a handler has been invoked).
 */
function mcp_bridge_error(string $message, int $http_status = 400): never {
    http_response_code(200);
    header('Content-Type: application/json');
    $rpc_id = $GLOBALS['__mcp_bridge_rpc_id'] ?? null;
    echo json_encode([
        'jsonrpc' => '2.0',
        'id'      => $rpc_id,
        'error'   => [
            'code'    => $http_status === 401 ? -32001 : -32000,
            'message' => $message,
        ],
    ], JSON_UNESCAPED_SLASHES);
    exit;
}
