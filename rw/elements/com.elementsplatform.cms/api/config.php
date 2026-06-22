<?php

return [
    'app' => [
        'env' => 'prod',
        'debug' => false,
        'version' => '1.0.0',
    ],

    'cms' => [
        'base_path' => __DIR__ . '/_content',
        'collections' => [
            'auto_discover' => true,
        ],
    ],

    'resources' => [
        'path' => '/resources',
        'fields' => ['image', 'thumbnail', 'featured_image'],
    ],

    'parser' => [
        'markdown' => [
            'allow_unsafe_links' => false,
            'allow_unsafe_images' => false,
            'html_input' => 'allow',
        ],
    ],

    'pagination' => [
        'default_per_page' => 10,
        'max_per_page' => 100,
    ],

    'security' => [
        'allowed_content_paths' => null,
    ],
];
