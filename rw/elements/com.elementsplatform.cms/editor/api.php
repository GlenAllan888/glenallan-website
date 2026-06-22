<?php

// ---------------------------------------------------------------------------
// Elements CMS — SPA JSON API
// ---------------------------------------------------------------------------

header('X-Content-Type-Options: nosniff');

require __DIR__ . '/php/helpers.php';

$action = $_GET['action'] ?? '';

// --- Public routes (no auth required) ---

if ($action === 'setup.status') {
    json_response(['configured' => config_exists()]);
}

if ($action === 'setup.requirements') {
    if (config_exists()) { json_error('Application is already configured.'); }
    require __DIR__ . '/php/handlers/setup.php';
    handle_setup_requirements();
}

if ($action === 'setup.complete') {
    if (config_exists()) { json_error('Application is already configured.'); }
    require __DIR__ . '/php/handlers/setup.php';
    handle_setup_complete();
}

if ($action === 'setup.browse') {
    if (config_exists()) { json_error('Application is already configured.'); }
    require __DIR__ . '/php/handlers/browse.php';
    handle_browse([], []);
}

// The editor depends on libsodium for Ed25519 license-response verification and
// for hashing across many handlers. If the extension is missing we cannot
// safely serve anything that touches a license or signed payload, so refuse
// every non-setup route up front rather than fataling deep in a handler.
if (!extension_loaded('sodium')
    || !defined('SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES')
    || !function_exists('sodium_crypto_sign_verify_detached')
) {
    json_error(
        'The PHP sodium extension is required by Elements CMS but is not '
        . 'enabled on this server. Ask your hosting provider to enable it.',
        503
    );
}

if ($action === 'login') {
    require __DIR__ . '/php/handlers/auth.php';
    handle_login();
}

if ($action === 'passkey.loginOptions') {
    require __DIR__ . '/php/handlers/passkey.php';
    handle_passkey_login_options();
}

if ($action === 'passkey.loginVerify') {
    require __DIR__ . '/php/handlers/passkey.php';
    handle_passkey_login_verify();
}

if ($action === 'password.resetInitiate') {
    require __DIR__ . '/php/handlers/password-reset.php';
    handle_reset_initiate();
}

if ($action === 'password.resetVerify') {
    require __DIR__ . '/php/handlers/password-reset.php';
    handle_reset_verify();
}

if ($action === 'password.resetComplete') {
    require __DIR__ . '/php/handlers/password-reset.php';
    handle_reset_complete();
}

// --- All other routes require config + session ---

$cfg = load_config();

// Ticket-authed multipart upload (no session, no CSRF — the ticket is the
// credential). Minted by the `resources_upload_request` MCP tool so clients
// can stream a file straight to disk without inlining base64 through the LLM.
if ($action === 'upload.with_ticket') {
    require_once __DIR__ . '/php/license-check.php';
    require_once __DIR__ . '/php/mcp/uploads.php';
    require __DIR__ . '/php/handlers/resources.php';
    $license = function_exists('get_license_state') ? get_license_state() : ['valid' => false];
    handle_upload_with_ticket($cfg, $license);
}

start_session($cfg);

// Invalidate sessions whose version no longer matches config (e.g. after password reset).
if (is_logged_in()) {
    $session_user = $_SESSION['username'] ?? '';
    $session_version = (int) ($_SESSION['session_version'] ?? 0);
    $current_version = (int) ($cfg['users'][$session_user]['session_version'] ?? 0);
    if (!isset($cfg['users'][$session_user]) || $session_version !== $current_version) {
        $_SESSION = [];
    }
}

// Load license early so session response can include it
require_once __DIR__ . '/php/license-check.php';
$license_early = is_logged_in() ? get_license_state() : null;

// Enforce the free-tier one-user clamp on every authenticated request:
// if the license is invalid and the session user isn't the surviving user,
// destroy the session so require_login() below returns 401.
if (
    is_logged_in()
    && empty(($license_early ?? [])['valid'])
    && $_SESSION['username'] !== surviving_user($cfg)
) {
    $_SESSION = [];
}

if ($action === 'session') {
    require __DIR__ . '/php/handlers/auth.php';
    handle_session($cfg, $license_early);
}

if ($action === 'logout') {
    require __DIR__ . '/php/handlers/auth.php';
    handle_logout();
}

// --- Authenticated routes ---

require_login();

// Re-read role from config (in case another admin changed it)
$username = current_user();
if (isset($cfg['users'][$username])) {
    $_SESSION['role'] = $cfg['users'][$username]['role'];
}

// Reuse license state loaded earlier, or load now
$license = $license_early ?? get_license_state();

// --- Route dispatch ---

$handler_map = [
    // Files
    'files.list'   => ['php/handlers/files.php', 'handle_files_list'],
    'files.read'   => ['php/handlers/files.php', 'handle_files_read'],
    'files.create'  => ['php/handlers/files.php', 'handle_files_create'],
    'files.update'  => ['php/handlers/files.php', 'handle_files_update'],
    'files.delete'  => ['php/handlers/files.php', 'handle_files_delete'],
    'files.draft'   => ['php/handlers/files.php', 'handle_files_draft'],
    'files.draftCleanup' => ['php/handlers/files.php', 'handle_files_draft_cleanup'],
    'files.createFolder' => ['php/handlers/files.php', 'handle_files_create_folder'],
    'files.rename'       => ['php/handlers/files.php', 'handle_files_rename'],
    'files.duplicate'    => ['php/handlers/files.php', 'handle_files_duplicate'],

    // Versions (Pro)
    'versions.list'    => ['php/handlers/versions.php', 'handle_versions_list'],
    'versions.read'    => ['php/handlers/versions.php', 'handle_versions_read'],
    'versions.restore' => ['php/handlers/versions.php', 'handle_versions_restore'],

    // Resources
    'resources.list'   => ['php/handlers/resources.php', 'handle_resources_list'],
    'resources.upload' => ['php/handlers/resources.php', 'handle_resources_upload'],
    'resources.delete' => ['php/handlers/resources.php', 'handle_resources_delete'],
    'resources.rename'        => ['php/handlers/resources.php', 'handle_resources_rename'],
    'resources.move'          => ['php/handlers/resources.php', 'handle_resources_move'],
    'resources.createFolder'  => ['php/handlers/resources.php', 'handle_resources_create_folder'],

    // Media (images for editor)
    'media.list'   => ['php/handlers/media.php', 'handle_media_list'],
    'media.upload' => ['php/handlers/media.php', 'handle_media_upload'],

    // Password & Account
    'password.change'  => ['php/handlers/password.php', 'handle_password_change'],
    'account.language' => ['php/handlers/password.php', 'handle_account_language'],

    // Passkeys (authenticated)
    'passkey.registerOptions' => ['php/handlers/passkey.php', 'handle_passkey_register_options'],
    'passkey.registerVerify'  => ['php/handlers/passkey.php', 'handle_passkey_register_verify'],
    'passkey.list'            => ['php/handlers/passkey.php', 'handle_passkey_list'],
    'passkey.rename'          => ['php/handlers/passkey.php', 'handle_passkey_rename'],
    'passkey.delete'          => ['php/handlers/passkey.php', 'handle_passkey_delete'],

    // Browse (directory browser)
    'browse' => ['php/handlers/browse.php', 'handle_browse'],

    // Users (admin)
    'users.list'   => ['php/handlers/users.php', 'handle_users_list'],
    'users.create'  => ['php/handlers/users.php', 'handle_users_create'],
    'users.update'  => ['php/handlers/users.php', 'handle_users_update'],
    'users.delete'  => ['php/handlers/users.php', 'handle_users_delete'],

    // Folders (admin)
    'folders.settings'                => ['php/handlers/folders.php', 'handle_folders_settings'],
    'folders.updateFields'            => ['php/handlers/folders.php', 'handle_folders_update_fields'],
    'folders.clearSubfolderOverrides' => ['php/handlers/folders.php', 'handle_folders_clear_subfolder_overrides'],
    'folders.redetect'                => ['php/handlers/folders.php', 'handle_folders_redetect'],
    'folders.add'                     => ['php/handlers/folders.php', 'handle_folders_add'],
    'folders.update'                  => ['php/handlers/folders.php', 'handle_folders_update'],
    'folders.remove'                  => ['php/handlers/folders.php', 'handle_folders_remove'],

    // Resource folders (admin)
    'resourceFolders.settings' => ['php/handlers/resource-folders.php', 'handle_resource_folders_settings'],
    'resourceFolders.update'   => ['php/handlers/resource-folders.php', 'handle_resource_folders_update'],
    'resourceFolders.add'      => ['php/handlers/resource-folders.php', 'handle_resource_folders_add'],
    'resourceFolders.remove'   => ['php/handlers/resource-folders.php', 'handle_resource_folders_remove'],

    // Theme (admin)
    'theme.get'    => ['php/handlers/theme.php', 'handle_theme_get'],
    'theme.update' => ['php/handlers/theme.php', 'handle_theme_update'],

    // Webhooks (owner)
    'webhooks.list'   => ['php/handlers/webhooks.php', 'handle_webhooks_list'],
    'webhooks.create' => ['php/handlers/webhooks.php', 'handle_webhooks_create'],
    'webhooks.update' => ['php/handlers/webhooks.php', 'handle_webhooks_update'],
    'webhooks.delete'       => ['php/handlers/webhooks.php', 'handle_webhooks_delete'],
    'webhooks.log'          => ['php/handlers/webhooks.php', 'handle_webhooks_log'],
    'webhooks.clear_log'    => ['php/handlers/webhooks.php', 'handle_webhooks_clear_log'],
    'webhooks.errors'       => ['php/handlers/webhooks.php', 'handle_webhooks_log'],
    'webhooks.clear_errors' => ['php/handlers/webhooks.php', 'handle_webhooks_clear_log'],

    // OAuth clients (owner) — DCR-registered MCP clients
    'oauthClients.list'   => ['php/handlers/oauth-clients.php', 'handle_oauth_clients_list'],
    'oauthClients.revoke' => ['php/handlers/oauth-clients.php', 'handle_oauth_clients_revoke'],

    // MCP bearer tokens (owner) — admin-issued bearers for /editor/mcp.php
    'mcpTokens.list'   => ['php/handlers/mcp-tokens.php', 'handle_mcp_tokens_list'],
    'mcpTokens.create' => ['php/handlers/mcp-tokens.php', 'handle_mcp_tokens_create'],
    'mcpTokens.revoke' => ['php/handlers/mcp-tokens.php', 'handle_mcp_tokens_revoke'],

    // JSON REST API keys (owner) — separate product from MCP tokens
    'apiTokens.list'   => ['php/handlers/api-tokens.php', 'handle_api_tokens_list'],
    'apiTokens.create' => ['php/handlers/api-tokens.php', 'handle_api_tokens_create'],
    'apiTokens.revoke' => ['php/handlers/api-tokens.php', 'handle_api_tokens_revoke'],

    // AI writing assistant (owner for settings, any logged-in user for run)
    'ai.settings.get'        => ['php/handlers/ai.php', 'handle_ai_settings_get'],
    'ai.settings.save'       => ['php/handlers/ai.php', 'handle_ai_settings_save'],
    'ai.providers.setKey'    => ['php/handlers/ai.php', 'handle_ai_providers_set_key'],
    'ai.providers.clearKey'  => ['php/handlers/ai.php', 'handle_ai_providers_clear_key'],
    'ai.models.list'         => ['php/handlers/ai.php', 'handle_ai_models_list'],
    'ai.assist.run'          => ['php/handlers/ai.php', 'handle_ai_assist_run'],

    // Config (admin)
    'config.setAdminUrl' => ['php/handlers/auth.php', 'handle_set_admin_url'],

    // License (admin)
    'license.status'          => ['php/handlers/license.php', 'handle_license_status'],
    'license.verify'          => ['php/handlers/license.php', 'handle_license_verify'],
    'license.purchase'        => ['php/handlers/license.php', 'handle_license_purchase'],
    'license.checkoutSession' => ['php/handlers/license.php', 'handle_license_checkout_session'],
    'license.activate'        => ['php/handlers/license.php', 'handle_license_activate'],
    'license.billing'         => ['php/handlers/license.php', 'handle_license_billing'],
    'license.deactivate'      => ['php/handlers/license.php', 'handle_license_deactivate'],
];

if (!isset($handler_map[$action])) {
    json_error('Unknown action: ' . $action, 404);
}

[$file, $func] = $handler_map[$action];
require __DIR__ . '/' . $file;
$func($cfg, $license);
