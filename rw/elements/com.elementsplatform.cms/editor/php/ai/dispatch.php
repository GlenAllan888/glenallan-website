<?php

// ---------------------------------------------------------------------------
// AI dispatch — resolves feature → provider → model → adapter and hands off.
// ---------------------------------------------------------------------------
// Callers pass $cfg, a feature id ('writing_assistant'), and a normalised
// OpenAI-style messages array. Per-feature overrides can pin a specific
// provider+model; otherwise we fall through to the global text defaults.

require_once __DIR__ . '/providers.php';
require_once __DIR__ . '/secrets.php';
require_once __DIR__ . '/client.php';
require_once __DIR__ . '/adapters/anthropic.php';
require_once __DIR__ . '/adapters/openai.php';
require_once __DIR__ . '/adapters/google.php';

function ai_resolve_text_target(array $cfg, string $feature_id): array {
    $ai = $cfg['ai'] ?? [];
    $feature = $ai['features'][$feature_id] ?? [];

    $provider = $feature['provider']
        ?? $ai['defaults']['text']['provider']
        ?? 'anthropic';
    $model = $feature['model']
        ?? $ai['defaults']['text']['model']
        ?? (ai_provider_def($provider)['default_model'] ?? '');

    return [$provider, $model];
}

function ai_text(array $cfg, string $feature_id, array $messages, array $opts = []): array {
    $ai = $cfg['ai'] ?? [];

    if (empty($ai['master_enabled'])) {
        throw new RuntimeException('AI is disabled for this install.');
    }
    if (empty($ai['features'][$feature_id]['enabled'])) {
        throw new RuntimeException('This AI feature is disabled.');
    }

    [$provider, $model] = ai_resolve_text_target($cfg, $feature_id);
    $def = ai_provider_def($provider);
    if (!$def) {
        throw new RuntimeException("Unknown AI provider: $provider");
    }
    if (!ai_provider_supports_model($provider, $model)) {
        throw new RuntimeException("Model $model is not registered for $provider.");
    }

    $stored = $ai['providers'][$provider] ?? [];
    if (empty($stored['enabled']) || empty($stored['key_cipher'])) {
        throw new RuntimeException("No API key configured for $provider.");
    }

    $key = ai_decrypt($stored['key_cipher']);
    if ($key === null || $key === '') {
        throw new RuntimeException("Failed to decrypt API key for $provider.");
    }

    $fn = 'ai_' . $provider . '_complete';
    if (!function_exists($fn)) {
        throw new RuntimeException("No adapter registered for provider: $provider");
    }

    return $fn($model, $messages, $opts, $key);
}

// Adapter-level key validation. Used when setting a key so the UI can
// surface auth errors immediately instead of at first real use.
function ai_provider_ping(string $provider, string $key): void {
    $fn = 'ai_' . $provider . '_ping';
    if (!function_exists($fn)) {
        throw new RuntimeException("No ping adapter for provider: $provider");
    }
    $fn($key);
}
