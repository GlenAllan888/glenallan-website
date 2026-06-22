<?php

// ---------------------------------------------------------------------------
// Anthropic (Claude) adapter.
// ---------------------------------------------------------------------------
// Normalised entry point:
//   ai_anthropic_complete($model, $messages, $opts, $key)
//     → ['text' => string, 'usage' => [...], 'stop_reason' => string]
//
// $messages is a list of { role, content } in OpenAI-style shape. A single
// system message is lifted into Anthropic's top-level `system` field.

require_once __DIR__ . '/../client.php';

function ai_anthropic_complete(string $model, array $messages, array $opts, string $key): array {
    $system = '';
    $turns = [];
    foreach ($messages as $m) {
        $role = $m['role'] ?? 'user';
        $content = (string) ($m['content'] ?? '');
        if ($role === 'system') {
            $system = $system === '' ? $content : ($system . "\n\n" . $content);
        } else {
            $turns[] = [
                'role'    => $role === 'assistant' ? 'assistant' : 'user',
                'content' => $content,
            ];
        }
    }

    if (empty($turns)) {
        throw new RuntimeException('Anthropic: at least one user turn is required.');
    }

    $body = [
        'model'      => $model,
        'max_tokens' => (int) ($opts['max_tokens'] ?? 2048),
        'messages'   => $turns,
    ];
    if ($system !== '') {
        $body['system'] = $system;
    }
    if (isset($opts['temperature'])) {
        $body['temperature'] = (float) $opts['temperature'];
    }

    [$status, $data, $err] = ai_http_json(
        'https://api.anthropic.com/v1/messages',
        [
            'x-api-key: ' . $key,
            'anthropic-version: 2023-06-01',
        ],
        $body,
        (int) ($opts['timeout'] ?? 60)
    );

    if ($err !== null) {
        throw new RuntimeException('Anthropic: network error: ' . $err);
    }
    if ($status < 200 || $status >= 300) {
        $msg = is_array($data) && isset($data['error']['message'])
            ? $data['error']['message']
            : ('HTTP ' . $status);
        throw new RuntimeException('Anthropic: ' . $msg);
    }

    $text = '';
    foreach ($data['content'] ?? [] as $block) {
        if (($block['type'] ?? '') === 'text') {
            $text .= $block['text'] ?? '';
        }
    }

    return [
        'text'        => $text,
        'usage'       => [
            'input_tokens'  => (int) ($data['usage']['input_tokens']  ?? 0),
            'output_tokens' => (int) ($data['usage']['output_tokens'] ?? 0),
        ],
        'stop_reason' => (string) ($data['stop_reason'] ?? ''),
    ];
}

// Light ping — used when the Providers UI wants to validate a key without
// spending real tokens. Sends a 1-token hello; surfaces any auth errors.
function ai_anthropic_ping(string $key, string $model = 'claude-haiku-4-5'): void {
    [$status, $data, $err] = ai_http_json(
        'https://api.anthropic.com/v1/messages',
        [
            'x-api-key: ' . $key,
            'anthropic-version: 2023-06-01',
        ],
        [
            'model'      => $model,
            'max_tokens' => 1,
            'messages'   => [['role' => 'user', 'content' => 'hi']],
        ],
        10
    );

    if ($err !== null) {
        throw new RuntimeException('Anthropic: network error: ' . $err);
    }
    if ($status === 401 || $status === 403) {
        throw new RuntimeException('Anthropic: invalid API key.');
    }
    if ($status < 200 || $status >= 300) {
        $msg = is_array($data) && isset($data['error']['message'])
            ? $data['error']['message']
            : ('HTTP ' . $status);
        throw new RuntimeException('Anthropic: ' . $msg);
    }
}
