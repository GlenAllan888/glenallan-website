<?php

// ---------------------------------------------------------------------------
// OpenAI adapter.
// ---------------------------------------------------------------------------
// Normalised entry point:
//   ai_openai_complete($model, $messages, $opts, $key)
//     → ['text' => string, 'usage' => [...], 'stop_reason' => string]
//
// OpenAI's Chat Completions API accepts the canonical OpenAI-style messages
// array directly, so no translation is needed beyond picking the right
// max-tokens parameter for the model family.

require_once __DIR__ . '/../client.php';

function ai_openai_complete(string $model, array $messages, array $opts, string $key): array {
    $turns = [];
    foreach ($messages as $m) {
        $role = $m['role'] ?? 'user';
        if (!in_array($role, ['system', 'user', 'assistant'], true)) {
            $role = 'user';
        }
        $turns[] = [
            'role'    => $role,
            'content' => (string) ($m['content'] ?? ''),
        ];
    }

    if (empty($turns)) {
        throw new RuntimeException('OpenAI: at least one message is required.');
    }

    $body = [
        'model'    => $model,
        'messages' => $turns,
    ];

    // o-series reasoning models use max_completion_tokens and reject
    // temperature. Keep the behaviour tidy instead of 400-ing on the user.
    $max_tokens = (int) ($opts['max_tokens'] ?? 2048);
    if (preg_match('/^(o\d|gpt-5)/i', $model)) {
        $body['max_completion_tokens'] = $max_tokens;
    } else {
        $body['max_tokens'] = $max_tokens;
        if (isset($opts['temperature'])) {
            $body['temperature'] = (float) $opts['temperature'];
        }
    }

    [$status, $data, $err] = ai_http_json(
        'https://api.openai.com/v1/chat/completions',
        ['Authorization: Bearer ' . $key],
        $body,
        (int) ($opts['timeout'] ?? 60)
    );

    if ($err !== null) {
        throw new RuntimeException('OpenAI: network error: ' . $err);
    }
    if ($status < 200 || $status >= 300) {
        $msg = is_array($data) && isset($data['error']['message'])
            ? $data['error']['message']
            : ('HTTP ' . $status);
        throw new RuntimeException('OpenAI: ' . $msg);
    }

    $choice = $data['choices'][0] ?? [];
    $text = (string) ($choice['message']['content'] ?? '');

    return [
        'text'        => $text,
        'usage'       => [
            'input_tokens'  => (int) ($data['usage']['prompt_tokens']     ?? 0),
            'output_tokens' => (int) ($data['usage']['completion_tokens'] ?? 0),
        ],
        'stop_reason' => (string) ($choice['finish_reason'] ?? ''),
    ];
}

// Light-touch key validation. GET /v1/models is the canonical health check —
// no tokens spent, no model picked, and 401/403 fire immediately on bad keys.
function ai_openai_ping(string $key): void {
    [$status, $data, $err] = ai_http_get_json(
        'https://api.openai.com/v1/models',
        ['Authorization: Bearer ' . $key],
        10
    );

    if ($err !== null) {
        throw new RuntimeException('OpenAI: network error: ' . $err);
    }
    if ($status === 401 || $status === 403) {
        throw new RuntimeException('OpenAI: invalid API key.');
    }
    if ($status < 200 || $status >= 300) {
        $msg = is_array($data) && isset($data['error']['message'])
            ? $data['error']['message']
            : ('HTTP ' . $status);
        throw new RuntimeException('OpenAI: ' . $msg);
    }
}
