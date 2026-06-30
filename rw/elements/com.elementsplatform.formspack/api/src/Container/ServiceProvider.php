<?php

namespace App\Container;

use App\Config\FormConfig;
use App\Contracts\FileSystemInterface;
use App\Contracts\CacheInterface;
use App\Services\FileSystemService;
use App\Cache\FileCacheDriver;
use InvalidArgumentException;
use Exception;

/**
 * Service provider for registering application services
 * Simplified version for Forms-only API
 */
class ServiceProvider
{
    /**
     * Register all application services
     */
    public static function registerAll(Container $container, array $config): void
    {
        try {
            self::registerCore($container, $config);
            self::registerSpamProtection($container, $config);
            self::registerForms($container);
            self::registerHttp($container);
        } catch (Exception $e) {
            throw new InvalidArgumentException("Failed to register services: " . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Register core infrastructure services
     */
    public static function registerCore(Container $container, array $config): void
    {
        self::validateConfig($config);

        // Configuration service (singleton)
        $container->singleton(FormConfig::class, function () use ($config) {
            return new FormConfig($config);
        });

        // File system service (singleton)
        $container->singleton(FileSystemInterface::class, function () {
            return new FileSystemService();
        });

        // Cache service (singleton)
        $container->singleton(CacheInterface::class, function (Container $container) {
            $config = $container->make(FormConfig::class);
            $filesystem = $container->make(FileSystemInterface::class);
            $cacheConfig = $config->getCacheConfig();

            if (empty($cacheConfig['path'])) {
                throw new InvalidArgumentException('Cache path is required');
            }

            return new FileCacheDriver($cacheConfig['path'], $filesystem);
        });

        // Event dispatcher (singleton)
        $container->singleton(\App\Events\EventDispatcher::class, function () {
            return new \App\Events\EventDispatcher();
        });
    }

    /**
     * Register spam protection services
     */
    public static function registerSpamProtection(Container $container, array $config): void
    {
        // Spam protection service (singleton)
        $container->singleton(\App\Services\SpamProtectionService::class, function (Container $container) use ($config) {
            return new \App\Services\SpamProtectionService($config);
        });

        // Spam protection middleware factory (singleton)
        $container->singleton(\App\Middleware\SpamProtectionMiddlewareFactory::class, function (Container $container) {
            return new \App\Middleware\SpamProtectionMiddlewareFactory(
                $container->make(\App\Services\SpamProtectionService::class),
                $container->make(\App\Services\FormProcessor::class)
            );
        });
    }

    /**
     * Register form processing and communication services
     */
    public static function registerForms(Container $container): void
    {
        // Email service (singleton)
        $container->singleton(\App\Services\EmailService::class, function (Container $container) {
            $config = $container->make(FormConfig::class);
            $emailConfig = $config->get('email', []);

            self::validateEmailConfig($emailConfig);

            return new \App\Services\EmailService(
                $emailConfig,
                $container->make(\App\Events\EventDispatcher::class)
            );
        });

        // Webhook service (singleton)
        $container->singleton(\App\Services\WebhookService::class, function (Container $container) {
            $config = $container->make(FormConfig::class);
            $webhookConfig = $config->get('webhook', []);
            $timeout = $webhookConfig['timeout'] ?? 30;

            if ($timeout <= 0) {
                throw new InvalidArgumentException('Webhook timeout must be positive');
            }

            return new \App\Services\WebhookService($timeout);
        });

        // Form processor service (singleton)
        $container->singleton(\App\Services\FormProcessor::class, function (Container $container) {
            $configLoader = new \App\Config\DynamicConfigLoader(
                include __DIR__ . '/../../config.php'
            );
            $pathResolver = new \App\Services\PathResolverService();
            return new \App\Services\FormProcessor($configLoader, $pathResolver);
        });

        // Email form controller (transient)
        $container->bind(\App\Controllers\EmailFormController::class, function (Container $container) {
            return new \App\Controllers\EmailFormController(
                $container->make(\App\Services\EmailService::class),
                $container->make(\App\Services\FormProcessor::class),
                $container->make(\App\Services\SpamProtectionService::class)
            );
        });

        // Webhook controller (transient)
        $container->bind(\App\Controllers\WebhookController::class, function (Container $container) {
            return new \App\Controllers\WebhookController(
                $container->make(\App\Services\WebhookService::class),
                $container->make(\App\Services\FormProcessor::class),
                $container->make(\App\Services\SpamProtectionService::class)
            );
        });
    }

    /**
     * Register HTTP-related services
     */
    public static function registerHttp(Container $container): void
    {
        // HTTP request (transient - new per request)
        $container->bind(\App\Http\Request::class, function () {
            return new \App\Http\Request();
        });
    }

    /**
     * Validate base configuration structure
     */
    private static function validateConfig(array $config): void
    {
        $requiredKeys = ['cache_path'];

        foreach ($requiredKeys as $key) {
            if (!isset($config[$key])) {
                throw new InvalidArgumentException("Missing required configuration key: {$key}");
            }
        }

        if (!is_dir(dirname($config['cache_path']))) {
            throw new InvalidArgumentException("Cache directory parent does not exist: " . dirname($config['cache_path']));
        }
    }

    /**
     * Validate email configuration
     */
    private static function validateEmailConfig(array $emailConfig): void
    {
        // Allow empty config for base service since forms provide their own config
        if (empty($emailConfig)) {
            return; // Forms will provide their own email config as overrides
        }

        if (!empty($emailConfig['from_email']) && !filter_var($emailConfig['from_email'], FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('Email from_email must be a valid email address');
        }

        if (isset($emailConfig['driver']) && !in_array($emailConfig['driver'], ['mail', 'smtp'])) {
            throw new InvalidArgumentException('Email driver must be either "mail" or "smtp"');
        }

        // SMTP-specific validation (only if SMTP config is provided)
        if (($emailConfig['driver'] ?? 'smtp') === 'smtp' && !empty($emailConfig['smtp_host'])) {
            if (!empty($emailConfig['smtp_port']) && (!is_numeric($emailConfig['smtp_port']) || $emailConfig['smtp_port'] <= 0)) {
                throw new InvalidArgumentException('SMTP port must be a positive number');
            }
        }
    }

    /**
     * Get list of all registered service classes for testing/debugging
     */
    public static function getRegisteredServices(): array
    {
        return [
            // Core services
            FormConfig::class,
            FileSystemInterface::class,
            CacheInterface::class,
            \App\Events\EventDispatcher::class,

            // Form services
            \App\Services\EmailService::class,
            \App\Services\WebhookService::class,
            \App\Services\FormProcessor::class,
            \App\Controllers\EmailFormController::class,
            \App\Controllers\WebhookController::class,

            // Spam protection services
            \App\Services\SpamProtectionService::class,
            \App\Middleware\SpamProtectionMiddlewareFactory::class,

            // HTTP services
            \App\Http\Request::class,
        ];
    }
}

