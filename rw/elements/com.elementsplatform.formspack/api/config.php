<?php

/**
 * Forms API Configuration
 * 
 * This is the main configuration file used by the Forms API.
 * Individual form configurations are loaded dynamically from backend/{component_id}/config.php
 */

return [
    'APP_ENV' => 'prod',
    'APP_DEBUG' => false,
    'APP_SECRET' => 'your-secret-key-change-this-in-production',
    'API_VERSION' => '1.0.0',

    // Cache Configuration
    'cache_path' => __DIR__ . '/_cache',
    'cache_ttl' => 3600,

    // Default Email Configuration (can be overridden per-form)
    'email' => [
        'driver' => 'smtp',
        'from_email' => '',
        'from_name' => '',
    ],

    // Default Webhook Configuration (can be overridden per-form)
    'webhook' => [
        'timeout' => 30,
    ],

    // Spam Protection Configuration
    'spam_protection' => [
        'enabled' => false, // Global default - can be overridden per form
        'default_provider' => 'recaptcha',
        'providers' => [
            'recaptcha' => [
                'secret_key' => '', // Set your reCAPTCHA secret key
                'site_key' => '',   // Optional, for client-side reference
                'score_threshold' => 0.5, // For reCAPTCHA v3 (0.0 to 1.0)
                'timeout' => 5
            ],
            'hcaptcha' => [
                'secret_key' => '', // Set your hCAPTCHA secret key
                'site_key' => '',   // Optional, for client-side reference
                'timeout' => 5
            ],
            'turnstile' => [
                'secret_key' => '', // Set your Turnstile secret key
                'site_key' => '',   // Optional, for client-side reference
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

    // Logging Configuration
    'logging' => [
        'enabled' => true,
        'level' => 'info',
        'path' => __DIR__ . '/logs',
    ],
];

