<?php

// ---------------------------------------------------------------------------
// AI provider + model registry.
// ---------------------------------------------------------------------------
// Centralised so model IDs don't leak into adapters, dispatch, or the UI.
// Expect to bump this file whenever providers deprecate / ship new models.

function ai_provider_registry(): array {
    return [
        'anthropic' => [
            'id'               => 'anthropic',
            'label'            => 'Anthropic (Claude)',
            'key_prefix_hint'  => 'sk-ant-',
            'api_key_url'      => 'https://console.anthropic.com/settings/keys',
            'models'           => [
                ['id' => 'claude-opus-4-7',   'label' => 'Claude Opus 4.7',   'capabilities' => ['text']],
                ['id' => 'claude-sonnet-4-6', 'label' => 'Claude Sonnet 4.6', 'capabilities' => ['text']],
                ['id' => 'claude-haiku-4-5',  'label' => 'Claude Haiku 4.5',  'capabilities' => ['text']],
            ],
            'default_model'    => 'claude-sonnet-4-6',
        ],
        'openai' => [
            'id'               => 'openai',
            'label'            => 'OpenAI',
            'key_prefix_hint'  => 'sk-',
            'api_key_url'      => 'https://platform.openai.com/api-keys',
            'models'           => [
                ['id' => 'gpt-4o',      'label' => 'GPT-4o',      'capabilities' => ['text']],
                ['id' => 'gpt-4o-mini', 'label' => 'GPT-4o mini', 'capabilities' => ['text']],
                ['id' => 'o3-mini',     'label' => 'o3-mini',     'capabilities' => ['text']],
            ],
            'default_model'    => 'gpt-4o-mini',
        ],
        'google' => [
            'id'               => 'google',
            'label'            => 'Google (Gemini)',
            'key_prefix_hint'  => 'AIza',
            'api_key_url'      => 'https://aistudio.google.com/apikey',
            'models'           => [
                ['id' => 'gemini-2.5-pro',   'label' => 'Gemini 2.5 Pro',   'capabilities' => ['text']],
                ['id' => 'gemini-2.5-flash', 'label' => 'Gemini 2.5 Flash', 'capabilities' => ['text']],
                ['id' => 'gemini-2.0-flash', 'label' => 'Gemini 2.0 Flash', 'capabilities' => ['text']],
            ],
            'default_model'    => 'gemini-2.5-flash',
        ],
    ];
}

function ai_provider_def(string $id): ?array {
    $reg = ai_provider_registry();
    return $reg[$id] ?? null;
}

function ai_provider_model_ids(string $id): array {
    $def = ai_provider_def($id);
    if (!$def) return [];
    return array_map(fn($m) => $m['id'], $def['models']);
}

function ai_provider_supports_model(string $provider, string $model): bool {
    return in_array($model, ai_provider_model_ids($provider), true);
}

// Public shape for the Providers settings UI. Never includes ciphertext
// or plaintext keys.
function ai_providers_public(array $cfg): array {
    $ai = $cfg['ai'] ?? [];
    $configured = $ai['providers'] ?? [];
    $out = [];
    foreach (ai_provider_registry() as $id => $def) {
        $stored = $configured[$id] ?? [];
        $out[] = [
            'id'              => $id,
            'label'           => $def['label'],
            'api_key_url'     => $def['api_key_url'],
            'key_prefix_hint' => $def['key_prefix_hint'],
            'models'          => $def['models'],
            'default_model'   => $def['default_model'],
            'has_key'         => !empty($stored['key_cipher']),
            'key_last4'       => $stored['key_last4'] ?? '',
            'key_set_at'      => $stored['key_set_at'] ?? 0,
            'enabled'         => $stored['enabled'] ?? true,
        ];
    }
    return $out;
}
