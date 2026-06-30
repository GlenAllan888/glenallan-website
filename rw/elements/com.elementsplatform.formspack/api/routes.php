<?php

/**
 * Forms API Routes Configuration
 * Handles email and webhook form submissions only
 * SecurityMiddleware is applied globally to ALL routes
 */

use App\Controllers\EmailFormController;
use App\Controllers\WebhookController;
use App\Middleware\SecurityMiddleware;
use App\Middleware\SpamProtectionMiddlewareFactory;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Routing\RouteCollectorProxy;

return function ($app, $emailFormController, $webhookController, $spamProtectionMiddlewareFactory = null) {

    // ========================================
    // REMOVE INDEX.PHP FROM PATH
    // ========================================
    // so that /api/index.php/{path} becomes /api/{path}
    $app->add(function (Request $request, $handler) {
        $uri = $request->getUri();
        $path = $uri->getPath();

        if (strpos($path, '/index.php') !== false) {
            $newPath = str_replace('/index.php', '', $path) ?: '/';
            $request = $request->withUri($uri->withPath($newPath));
        }

        return $handler->handle($request);
    });

    // ========================================
    // GLOBAL SECURITY MIDDLEWARE
    // ========================================
    // Apply SecurityMiddleware to ALL routes - blocks external requests
    $app->add(new SecurityMiddleware());

    // ========================================
    // ROOT & STATUS ROUTES
    // ========================================

    // Root endpoint
    $app->any('/', function (Request $request, Response $response) {
        $response->getBody()->write(json_encode([
            'success' => true,
            'name' => 'Forms API',
            'version' => '1.0.0',
            'description' => 'Minimal API for form submissions (email and webhook)',
            'endpoints' => [
                'GET /' => 'API information',
                'GET /status' => 'API status',
                'POST /email' => 'Submit form via email',
                'GET /email/status' => 'Email configuration status',
                'POST /webhook' => 'Submit form via webhook',
                'GET /webhook/status' => 'Webhook configuration status',
                'POST /webhook/test' => 'Test webhook connection'
            ],
            'timestamp' => date('c')
        ]));
        return $response->withHeader('Content-Type', 'application/json');
    });

    // API status endpoint
    $app->get('/status', function (Request $request, Response $response) {
        $response->getBody()->write(json_encode([
            'success' => true,
            'status' => 'operational',
            'name' => 'Forms API',
            'version' => '1.0.0',
            'php_version' => PHP_VERSION,
            'timestamp' => date('c')
        ]));
        return $response->withHeader('Content-Type', 'application/json');
    });

    // ========================================
    // EMAIL FORM ROUTES
    // ========================================
    $app->group('/email', function (RouteCollectorProxy $group) use ($emailFormController, $spamProtectionMiddlewareFactory) {
        // Apply spam protection middleware to the submit route
        if ($spamProtectionMiddlewareFactory) {
            $group->post('', [$emailFormController, 'submit'])
                ->add($spamProtectionMiddlewareFactory->forEmailForms());
        } else {
            $group->post('', [$emailFormController, 'submit']);
        }

        $group->get('/status', [$emailFormController, 'status']);
        $group->get('', [$emailFormController, 'info']);
    });

    // ========================================
    // WEBHOOK FORM ROUTES
    // ========================================
    $app->group('/webhook', function (RouteCollectorProxy $group) use ($webhookController, $spamProtectionMiddlewareFactory) {
        // Apply spam protection middleware to the submit route
        if ($spamProtectionMiddlewareFactory) {
            $group->post('', [$webhookController, 'submit'])
                ->add($spamProtectionMiddlewareFactory->forWebhookForms());
        } else {
            $group->post('', [$webhookController, 'submit']);
        }

        $group->get('/status', [$webhookController, 'status']);
        $group->post('/test', [$webhookController, 'test']);
        $group->get('', [$webhookController, 'info']);
    });

    // ========================================
    // CATCH-ALL ROUTE
    // ========================================
    $app->any('{path:.+}', function (Request $request, Response $response, array $args) {
        $response->getBody()->write(json_encode([
            'success' => false,
            'error' => 'Endpoint not found',
            'path' => $args['path'] ?? 'unknown',
            'timestamp' => date('c')
        ]));
        return $response->withHeader('Content-Type', 'application/json')->withStatus(404);
    });
};

