<?php

namespace CMS\Core;

class Router
{
    private array $routes = [];

    public function get(string $pattern, callable $handler): void
    {
        $this->addRoute('GET', $pattern, $handler);
    }

    public function post(string $pattern, callable $handler): void
    {
        $this->addRoute('POST', $pattern, $handler);
    }

    public function put(string $pattern, callable $handler): void
    {
        $this->addRoute('PUT', $pattern, $handler);
    }

    public function patch(string $pattern, callable $handler): void
    {
        $this->addRoute('PATCH', $pattern, $handler);
    }

    public function delete(string $pattern, callable $handler): void
    {
        $this->addRoute('DELETE', $pattern, $handler);
    }

    public function any(string $pattern, callable $handler): void
    {
        $this->addRoute('GET', $pattern, $handler);
        $this->addRoute('POST', $pattern, $handler);
    }

    private function addRoute(string $method, string $pattern, callable $handler): void
    {
        $this->routes[] = [
            'method' => $method,
            'pattern' => $pattern,
            'handler' => $handler,
        ];
    }

    public function dispatch(string $method, string $uri): mixed
    {
        $method = strtoupper($method);

        // Strip query string
        $path = parse_url($uri, PHP_URL_PATH) ?: '/';

        // Remove trailing slash (except root)
        if ($path !== '/') {
            $path = rtrim($path, '/');
        }

        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) {
                continue;
            }

            $params = $this->match($route['pattern'], $path);
            if ($params !== false) {
                return call_user_func($route['handler'], ...array_values($params));
            }
        }

        return null; // No match
    }

    private function match(string $pattern, string $path): array|false
    {
        // Convert {param} to named capture groups
        $regex = preg_replace_callback('/\{(\w+)(?::([^}]+))?\}/', function ($m) {
            $name = $m[1];
            $constraint = $m[2] ?? '[^/]+';
            return "(?P<{$name}>{$constraint})";
        }, $pattern);

        $regex = '#^' . $regex . '$#';

        if (preg_match($regex, $path, $matches)) {
            // Return only named captures
            return array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
        }

        return false;
    }
}
