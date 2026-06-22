<?php

// ---------------------------------------------------------------------------
// Handler bridge: invoke existing editor handlers from non-SPA transports.
// ---------------------------------------------------------------------------
// Existing handler functions (handle_files_read, handle_files_save, …)
// call json_response() which emits JSON and exits. When the caller is MCP
// or the REST API rather than the admin SPA, we want their output wrapped
// in a transport-specific envelope. Within PHP's request lifecycle this is:
//
//   1. ob_start() before invoking the handler
//   2. register_shutdown_function() to re-wrap the captured output
//   3. Let the handler run and call exit via json_response
//   4. The shutdown function reads the buffer and emits the wrapped response
//
// Because the handler terminates the request, exactly one bridged call may
// be handled per HTTP request.

/**
 * Set up PHP globals so that an existing editor handler runs as if the
 * bound user had submitted the request via the admin SPA.
 *
 *   $args         Tool/route arguments (used for $_GET, $_POST, and json body override)
 *   $method       HTTP method the handler expects ('GET' or 'POST')
 *   $cfg          Loaded config array (used to resolve role)
 *   $username     Username the token is bound to
 *   $on_missing   Callable invoked if the user no longer exists; must not return
 */
function handler_bridge_prepare_context(
    array $args,
    string $method,
    array $cfg,
    string $username,
    callable $on_missing
): void {
    $user = $cfg['users'][$username] ?? null;
    if (!$user) {
        $on_missing('Token owner no longer exists.', 401);
        return; // unreachable — $on_missing is expected to exit
    }

    if (session_status() !== PHP_SESSION_ACTIVE) {
        @session_start();
    }
    $_SESSION['logged_in'] = true;
    $_SESSION['username']  = $username;
    $_SESSION['role']      = $user['role'] ?? 'editor';
    $_SESSION['csrf']      = bin2hex(random_bytes(16));

    $_SERVER['REQUEST_METHOD'] = $method;

    foreach ($args as $k => $v) {
        if (is_scalar($v) || $v === null) {
            $_GET[$k] = (string) ($v ?? '');
            $_POST[$k] = (string) ($v ?? '');
        }
    }
    $_POST['csrf'] = $_SESSION['csrf'];

    // Handlers that use get_json_body() will pick this up.
    $GLOBALS['__handler_body_override'] = $args;
}

/**
 * Install the output-capture shutdown function. Must be called immediately
 * before invoking the handler. The $wrapper callback receives:
 *   (string $raw, int $status): void
 * and is responsible for setting the Content-Type header and echoing the
 * wrapped body.
 */
function handler_bridge_install(callable $wrapper): void {
    $GLOBALS['__handler_bridge_active']  = true;
    $GLOBALS['__handler_bridge_wrapper'] = $wrapper;

    ob_start();

    register_shutdown_function(function () {
        if (empty($GLOBALS['__handler_bridge_active'])) return;
        $GLOBALS['__handler_bridge_active'] = false;

        $raw = '';
        while (ob_get_level() > 0) {
            $chunk = ob_get_clean();
            if ($chunk !== false) $raw = $chunk . $raw;
        }

        $status = http_response_code();
        if (!is_int($status)) $status = 200;

        if (function_exists('header_remove')) {
            header_remove('Content-Type');
        }

        $wrapper = $GLOBALS['__handler_bridge_wrapper'] ?? null;
        if (is_callable($wrapper)) {
            $wrapper($raw, $status);
        } else {
            // Fallback — just echo the raw response untouched.
            header('Content-Type: application/json');
            echo $raw;
        }
    });
}
