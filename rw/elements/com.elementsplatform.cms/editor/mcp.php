<?php

// ---------------------------------------------------------------------------
// Elements CMS — MCP (Model Context Protocol) endpoint
// ---------------------------------------------------------------------------
// Streamable HTTP transport, stateless, JSON-RPC 2.0.
// Clients authenticate via OAuth 2.1 + DCR — see /editor/oauth-*.php and
// /editor/.well-known/oauth-authorization-server. Access tokens look like
// `oauth_…` and arrive as Authorization: Bearer headers.

header('X-Content-Type-Options: nosniff');

require __DIR__ . '/php/helpers.php';
require __DIR__ . '/php/mcp/server.php';

mcp_serve();
