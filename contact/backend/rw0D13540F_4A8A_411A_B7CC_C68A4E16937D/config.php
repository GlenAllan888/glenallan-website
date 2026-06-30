<?php

return [
    'email' => [
        'enabled' => '1' === '1',
        'to' => 'john.doe@example.com',
        'subject' => 'New Form Submission',
        'template' => 'default',
        'from_email' => 'john.doe@example.com',
        'from_name' => 'John Doe',
        'smtp_host' => 'smtp.example.com',
        'smtp_port' => '587',
        'smtp_username' => 'username@example.com',
        'smtp_password' => 's3cr3t!',
        'smtp_encryption' => 'tls', // tls, ssl, or none
        'smtp_auth' => 'username@example.com' !== '' && 's3cr3t!' !== '',
        'smtp_timeout' => 30,
        'charset' => 'UTF-8',

        // Email Template Customization
        'email_title' => 'New Form Submission',
        'email_footer' => '',

        // SSL Configuration (for troubleshooting hosting issues)
        'smtp_verify_peer' =>  'true' === 'true', // Set to false if certificate issues
        'smtp_verify_peer_name' => 'true' === 'true', // Set to false if hostname mismatch
        'smtp_allow_self_signed' => 'false' === 'true', // Allow self-signed certificates
    ],

    'webhook' => [
        'enabled' => '0' === '1',
        'url' => '',
        'method' => 'POST',
        'format' => 'json'
    ],

    'validation' => [
        'rules' => [
            // Form validation rules will be added dynamically
        ],
        'messages' => [
            // Custom validation messages
        ]
    ],

    'spam_protection' => [
        'enabled' => 'none' !== 'none',
        'provider' => 'none',
        'providers' => [
            'recaptcha' => [
                'enabled' => 'none' === 'recaptcha',
                'secret_key' => '',
                'site_key' => '',
            ],
            'turnstile' => [
                'enabled' => 'none' === 'turnstile',
                'secret_key' => '',
                'site_key' => '',
            ],
            'hcaptcha' => [
                'enabled' => 'none' === 'hcaptcha',
                'secret_key' => '',
                'site_key' => '',
            ],
            'honeypot' => [
                'enabled' => 'none' === 'honeypot',
            ],
        ],
    ],

    'response' => [
        'message' => 'Thank you! Your form has been submitted successfully.'
    ],

    'logging' => [
        'enabled' => true,
        'level' => 'info', // Changed from 'debug' to reduce log file size
        'file' => 'form_rw0D13540F_4A8A_411A_B7CC_C68A4E16937D.log',
        'rotation' => [
            'enabled' => true,
            'max_size' => '5MB', // Rotate when file reaches 5MB
            'max_files' => 5 // Keep 5 rotated files (total ~25MB max per form)
        ]
    ],

    // Component metadata
    'component_id' => 'rw0D13540F_4A8A_411A_B7CC_C68A4E16937D',
    'generated_at' => '',
];
