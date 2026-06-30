<?php

namespace App\Config;

use InvalidArgumentException;

/**
 * Form Configuration management with validation and defaults
 * Simplified version of CMSConfig for form-only API
 */
class FormConfig
{
    private array $config;
    private array $defaults = [
        'cache_path' => null,
        'cache_ttl' => 3600,
        'email' => [
            'driver' => 'smtp',
            'from_email' => '',
            'from_name' => '',
        ],
        'webhook' => [
            'timeout' => 30,
        ],
        'spam_protection' => [
            'enabled' => false,
            'default_provider' => 'recaptcha',
            'providers' => [
                'recaptcha' => [
                    'secret_key' => '',
                    'site_key' => '',
                    'score_threshold' => 0.5,
                    'timeout' => 5
                ],
                'hcaptcha' => [
                    'secret_key' => '',
                    'site_key' => '',
                    'timeout' => 5
                ],
                'turnstile' => [
                    'secret_key' => '',
                    'site_key' => '',
                    'timeout' => 5
                ]
            ],
            'error_messages' => [
                'missing_token' => 'Captcha verification required',
                'invalid_token' => 'Captcha verification failed',
                'provider_error' => 'Unable to verify captcha at this time',
                'score_too_low' => 'Captcha score too low, please try again'
            ]
        ],
        'logging' => [
            'enabled' => true,
            'level' => 'info',
        ]
    ];

    public function __construct(array $config = [])
    {
        $this->config = $this->validateAndMergeDefaults($config);
    }

    /**
     * Get a configuration value
     */
    public function get(string $key, mixed $default = null): mixed
    {
        return $this->getNestedValue($this->config, $key, $default);
    }

    /**
     * Check if a configuration key exists
     */
    public function has(string $key): bool
    {
        return $this->getNestedValue($this->config, $key) !== null;
    }

    /**
     * Set a configuration value
     */
    public function set(string $key, mixed $value): void
    {
        $this->setNestedValue($this->config, $key, $value);
    }

    /**
     * Get all configuration
     */
    public function all(): array
    {
        return $this->config;
    }

    /**
     * Validate and merge with defaults
     */
    private function validateAndMergeDefaults(array $config): array
    {
        // Validate required fields
        $this->validateRequired($config);

        // Merge with defaults
        $merged = $this->mergeRecursive($this->defaults, $config);

        // Set dynamic defaults
        $merged = $this->setDynamicDefaults($merged);

        return $merged;
    }

    /**
     * Validate required configuration
     */
    private function validateRequired(array $config): void
    {
        // For forms API, cache_path is the only truly required field
        $required = ['cache_path'];

        foreach ($required as $key) {
            if (empty($config[$key])) {
                throw new InvalidArgumentException("Configuration key '{$key}' is required");
            }
        }
    }

    /**
     * Set dynamic defaults based on other config values
     */
    private function setDynamicDefaults(array $config): array
    {
        return $config;
    }

    /**
     * Recursively merge arrays
     */
    private function mergeRecursive(array $array1, array $array2): array
    {
        $merged = $array1;

        foreach ($array2 as $key => $value) {
            if (is_array($value) && isset($merged[$key]) && is_array($merged[$key])) {
                $merged[$key] = $this->mergeRecursive($merged[$key], $value);
            } else {
                $merged[$key] = $value;
            }
        }

        return $merged;
    }

    /**
     * Get nested array value using dot notation
     */
    private function getNestedValue(array $array, string $key, mixed $default = null): mixed
    {
        if (strpos($key, '.') === false) {
            return $array[$key] ?? $default;
        }

        $keys = explode('.', $key);
        $value = $array;

        foreach ($keys as $k) {
            if (!is_array($value) || !array_key_exists($k, $value)) {
                return $default;
            }
            $value = $value[$k];
        }

        return $value;
    }

    /**
     * Set nested array value using dot notation
     */
    private function setNestedValue(array &$array, string $key, mixed $value): void
    {
        if (strpos($key, '.') === false) {
            $array[$key] = $value;
            return;
        }

        $keys = explode('.', $key);
        $current = &$array;

        foreach ($keys as $k) {
            if (!isset($current[$k]) || !is_array($current[$k])) {
                $current[$k] = [];
            }
            $current = &$current[$k];
        }

        $current = $value;
    }

    /**
     * Get cache configuration
     */
    public function getCacheConfig(): array
    {
        return [
            'path' => $this->get('cache_path'),
            'ttl' => $this->get('cache_ttl'),
        ];
    }

    /**
     * Get email configuration
     */
    public function getEmailConfig(): array
    {
        return $this->get('email', []);
    }

    /**
     * Get webhook configuration
     */
    public function getWebhookConfig(): array
    {
        return $this->get('webhook', []);
    }

    /**
     * Get spam protection configuration
     */
    public function getSpamProtectionConfig(): array
    {
        return $this->get('spam_protection', []);
    }
}

