<?php

// ---------------------------------------------------------------------------
// Outbound HTTP for AI providers. Single curl helper so timeouts, error
// normalisation, and any future proxy settings live in one place.
// ---------------------------------------------------------------------------
// Returns [status, decoded_body, error_message]. status is 0 on network
// failure; decoded_body may be null if the response wasn't JSON.

function ai_http_json(
    string $url,
    array $headers,
    array $body,
    int $timeout = 60
): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($body, JSON_UNESCAPED_SLASHES),
        CURLOPT_HTTPHEADER     => array_merge(['Content-Type: application/json'], $headers),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_FOLLOWLOCATION => false,
    ]);

    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($raw === false) {
        return [0, null, $err !== '' ? $err : 'Network error.'];
    }

    $data = json_decode($raw, true);
    return [$status, $data, null];
}

// GET variant for lightweight ping/listing endpoints that don't need a body.
// Same return shape as ai_http_json().
function ai_http_get_json(
    string $url,
    array $headers,
    int $timeout = 10
): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_HTTPGET        => true,
        CURLOPT_HTTPHEADER     => array_merge(['Accept: application/json'], $headers),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_FOLLOWLOCATION => false,
    ]);

    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($raw === false) {
        return [0, null, $err !== '' ? $err : 'Network error.'];
    }

    $data = json_decode($raw, true);
    return [$status, $data, null];
}
