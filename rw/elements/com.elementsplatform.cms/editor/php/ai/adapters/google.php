<?php

// ---------------------------------------------------------------------------
// Google (Gemini) adapter.
// ---------------------------------------------------------------------------
// Normalised entry point:
//   ai_google_complete($model, $messages, $opts, $key)
//     → ['text' => string, 'usage' => [...], 'stop_reason' => string]
//
// Gemini's message shape differs enough from OpenAI that we translate here:
//  - system messages collapse into a top-level `systemInstruction`
//  - `assistant` turns are renamed to `model`
//  - every turn's content becomes `parts: [{ text }]`
//  - auth is via ?key= on the URL, not a header

require_once __DIR__ . '/../client.php';

function ai_google_complete(string $model, array $messages, array $opts, string $key): array {
    $system = '';
    $contents = [];
    foreach ($messages as $m) {
        $role = $m['role'] ?? 'user';
        $content = (string) ($m['content'] ?? '');
        if ($role === 'system') {
            $system = $system === '' ? $content : ($system . "\n\n" . $content);
            continue;
        }
        $contents[] = [
            'role'  => $role === 'assistant' ? 'model' : 'user',
            'parts' => [['text' => $content]],
        ];
    }

    if (empty($contents)) {
        throw new RuntimeException('Google: at least one user turn is required.');
    }

    $body = [
        'contents'         => $contents,
        'generationConfig' => [
            'maxOutputTokens' => (int) ($opts['max_tokens'] ?? 2048),
        ],
    ];
    if ($system !== '') {
        $body['systemInstruction'] = ['parts' => [['text' => $system]]];
    }
    if (isset($opts['temperature'])) {
        $body['generationConfig']['temperature'] = (float) $opts['temperature'];
    }

    $url = 'https://generativelanguage.googleapis.com/v1beta/models/'
        . rawurlencode($model) . ':generateContent?key=' . urlencode($key);

    [$status, $data, $err] = ai_http_json(
        $url,
        [],
        $body,
        (int) ($opts['timeout'] ?? 60)
    );

    if ($err !== null) {
        throw new RuntimeException('Google: network error: ' . $err);
    }
    if ($status < 200 || $status >= 300) {
        $msg = is_array($data) && isset($data['error']['message'])
            ? $data['error']['message']
            : ('HTTP ' . $status);
        throw new RuntimeException('Google: ' . $msg);
    }

    $candidate = $data['candidates'][0] ?? [];
    $text = '';
    foreach ($candidate['content']['parts'] ?? [] as $part) {
        if (isset($part['text'])) {
            $text .= $part['text'];
        }
    }

    return [
        'text'        => $text,
        'usage'       => [
            'input_tokens'  => (int) ($data['usageMetadata']['promptTokenCount']     ?? 0),
            'output_tokens' => (int) ($data['usageMetadata']['candidatesTokenCount'] ?? 0),
        ],
        'stop_reason' => (string) ($candidate['finishReason'] ?? ''),
    ];
}

// GET /v1beta/models surfaces auth errors immediately without spending tokens
// or committing to a specific model ID.
function ai_google_ping(string $key): void {
    [$status, $data, $err] = ai_http_get_json(
        'https://generativelanguage.googleapis.com/v1beta/models?key=' . urlencode($key),
        [],
        10
    );

    if ($err !== null) {
        throw new RuntimeException('Google: network error: ' . $err);
    }
    if ($status === 400 || $status === 401 || $status === 403) {
        throw new RuntimeException('Google: invalid API key.');
    }
    if ($status < 200 || $status >= 300) {
        $msg = is_array($data) && isset($data['error']['message'])
            ? $data['error']['message']
            : ('HTTP ' . $status);
        throw new RuntimeException('Google: ' . $msg);
    }
}
