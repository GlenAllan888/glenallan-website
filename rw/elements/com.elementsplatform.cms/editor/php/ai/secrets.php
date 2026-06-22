<?php

// ---------------------------------------------------------------------------
// AI key storage — libsodium-encrypted with plaintext fallback.
// ---------------------------------------------------------------------------
// Keys round-trip through ai_encrypt / ai_decrypt. Ciphertext is an opaque
// base64 string that embeds the scheme version so we can migrate later.
//
//   Scheme "sb1": sodium_crypto_secretbox  (preferred — available on PHP 7.2+
//                 with libsodium, which is default since 7.2.)
//   Scheme "pt0": plaintext fallback, only used when libsodium is missing.
//                 The UI surfaces a warning so admins know keys are at rest
//                 unencrypted.
//
// Master key lives in a sibling dotfile that matches the existing naming
// convention (see license-check.php). 32 random bytes, 0600.

const AI_SECRET_KEY_FILE = __DIR__ . '/../.elements_ai_secret';

function ai_has_libsodium(): bool {
    return function_exists('sodium_crypto_secretbox')
        && function_exists('sodium_crypto_secretbox_open')
        && defined('SODIUM_CRYPTO_SECRETBOX_KEYBYTES');
}

function ai_master_key(): string {
    if (file_exists(AI_SECRET_KEY_FILE)) {
        $bytes = @file_get_contents(AI_SECRET_KEY_FILE);
        if ($bytes !== false && strlen($bytes) === SODIUM_CRYPTO_SECRETBOX_KEYBYTES) {
            return $bytes;
        }
    }
    $bytes = random_bytes(SODIUM_CRYPTO_SECRETBOX_KEYBYTES);
    @file_put_contents(AI_SECRET_KEY_FILE, $bytes, LOCK_EX);
    @chmod(AI_SECRET_KEY_FILE, 0600);
    return $bytes;
}

function ai_encrypt(string $plaintext): string {
    if (!ai_has_libsodium()) {
        return 'pt0:' . base64_encode($plaintext);
    }
    $key = ai_master_key();
    $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    $cipher = sodium_crypto_secretbox($plaintext, $nonce, $key);
    return 'sb1:' . base64_encode($nonce . $cipher);
}

function ai_decrypt(string $stored): ?string {
    if (str_starts_with($stored, 'pt0:')) {
        $raw = base64_decode(substr($stored, 4), true);
        return $raw === false ? null : $raw;
    }
    if (str_starts_with($stored, 'sb1:')) {
        if (!ai_has_libsodium()) return null;
        $raw = base64_decode(substr($stored, 4), true);
        if ($raw === false || strlen($raw) < SODIUM_CRYPTO_SECRETBOX_NONCEBYTES + 1) return null;
        $nonce = substr($raw, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $cipher = substr($raw, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $plain = sodium_crypto_secretbox_open($cipher, $nonce, ai_master_key());
        return $plain === false ? null : $plain;
    }
    return null;
}

function ai_mask_key(string $raw): string {
    $len = strlen($raw);
    if ($len <= 4) return str_repeat('•', 4);
    return '••••' . substr($raw, -4);
}

function ai_key_last4(string $raw): string {
    return strlen($raw) <= 4 ? $raw : substr($raw, -4);
}
