<?php

namespace CMS\Core;

class Response
{
    public static function json(mixed $data, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    public static function success(mixed $data, ?int $count = null): never
    {
        $response = [
            'success' => true,
            'data' => $data,
            'timestamp' => date('c'),
        ];

        if ($count !== null) {
            $response['count'] = $count;
        }

        self::json($response);
    }

    public static function paginated(array $items, array $meta): never
    {
        self::json([
            'success' => true,
            'data' => $items,
            'meta' => $meta,
            'timestamp' => date('c'),
        ]);
    }

    public static function error(string $message, int $status = 400): never
    {
        self::json([
            'success' => false,
            'error' => $message,
            'code' => $status,
            'timestamp' => date('c'),
        ], $status);
    }

    public static function xml(string $xml, int $status = 200, string $contentType = 'application/xml'): never
    {
        http_response_code($status);
        header("Content-Type: {$contentType}; charset=utf-8");
        echo $xml;
        exit;
    }

    public static function rss(string $xml): never
    {
        self::xml($xml, 200, 'application/rss+xml');
    }

    public static function html(string $html, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: text/html; charset=utf-8');
        echo $html;
        exit;
    }

    public static function cors(): void
    {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token');

        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
    }

    public static function notFound(string $message = 'Not found'): never
    {
        self::error($message, 404);
    }
}
