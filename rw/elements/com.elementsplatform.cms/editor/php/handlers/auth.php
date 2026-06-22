<?php

function apply_remember_me(bool $remember): void {
    $p = session_get_cookie_params();
    $common = [
        'path'     => $p['path'],
        'domain'   => $p['domain'],
        'secure'   => $p['secure'],
        'httponly' => true,
        'samesite' => 'Lax',
    ];

    if ($remember) {
        $expires = time() + REMEMBER_ME_LIFETIME;
        setcookie(REMEMBER_ME_COOKIE, '1', ['expires' => $expires] + $common);
        // Re-issue the session cookie with the long expiry — start_session()
        // already ran with lifetime=0 before we knew the remember flag.
        setcookie(session_name(), session_id(), ['expires' => $expires] + $common);
    } elseif (!empty($_COOKIE[REMEMBER_ME_COOKIE])) {
        setcookie(REMEMBER_ME_COOKIE, '', ['expires' => time() - 42000] + $common);
    }
}

function handle_login(): never {
    require_post();

    $cfg = load_config();
    start_session($cfg);

    $input = get_json_body();
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    $password = $input['password'] ?? '';
    $remember = !empty($input['remember']);

    if (
        !isset($cfg['users'][$email]) ||
        !password_verify($password, $cfg['users'][$email]['password_hash'])
    ) {
        json_error('Invalid email or password.', 401);
    }

    require_once __DIR__ . '/../license-check.php';
    $license = get_license_state();

    if (empty($license['valid']) && $email !== surviving_user($cfg)) {
        json_error(
            'Additional users are disabled on the free plan. '
            . 'Reactivate your license or contact the site owner.',
            403
        );
    }

    $_SESSION['logged_in'] = true;
    $_SESSION['username'] = $email;
    $_SESSION['role'] = $cfg['users'][$email]['role'];
    $_SESSION['session_version'] = (int) ($cfg['users'][$email]['session_version'] ?? 0);
    $_SESSION['csrf'] = bin2hex(random_bytes(16));

    apply_remember_me($remember);

    json_response([
        'user' => [
            'email'    => $email,
            'role'     => $cfg['users'][$email]['role'],
            'language' => $cfg['users'][$email]['language'] ?? $cfg['language'] ?? 'en',
        ],
        'csrf'   => $_SESSION['csrf'],
        'config' => client_config($cfg, $license),
        'license' => $license,
    ]);
}

function handle_session(array $cfg, ?array $license = null): never {
    if (!is_logged_in()) {
        json_response([
            'authenticated' => false,
            'default_language' => $cfg['language'] ?? 'en',
        ]);
    }

    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
    }

    // Re-read role from config
    $email = current_user();
    if (isset($cfg['users'][$email])) {
        $_SESSION['role'] = $cfg['users'][$email]['role'];
    }

    if (empty(($license ?? [])['valid']) && $email !== surviving_user($cfg)) {
        $_SESSION = [];
        session_destroy();
        json_response([
            'authenticated'    => false,
            'reason'           => 'free_tier_user_clamp',
            'default_language' => $cfg['language'] ?? 'en',
        ]);
    }

    json_response([
        'authenticated' => true,
        'user' => [
            'email'    => $email,
            'role'     => $_SESSION['role'],
            'language' => $cfg['users'][$email]['language'] ?? $cfg['language'] ?? 'en',
        ],
        'csrf'   => $_SESSION['csrf'],
        'config' => client_config($cfg, $license ?? []),
        'license' => $license,
    ]);
}

function handle_set_admin_url(array $cfg, array $license): never {
    require_owner();
    require_post();
    verify_csrf();

    $input = get_json_body();
    $raw   = trim((string)($input['url'] ?? ''));
    if ($raw === '') {
        json_error('URL is required.');
    }

    $parts    = parse_url($raw);
    $req_host = $_SERVER['HTTP_HOST'] ?? '';
    $url_host = ($parts['host'] ?? '') . (isset($parts['port']) ? ':' . $parts['port'] : '');
    if (
        !is_array($parts)
        || !isset($parts['scheme'], $parts['host'])
        || !in_array($parts['scheme'], ['http', 'https'], true)
        || strcasecmp($url_host, $req_host) !== 0
    ) {
        json_error('Invalid URL.');
    }

    $path       = rtrim($parts['path'] ?? '/', '/') . '/';
    $normalized = $parts['scheme'] . '://' . $req_host . $path;

    if (($cfg['admin_url'] ?? null) !== $normalized) {
        $cfg['admin_url'] = $normalized;
        save_config($cfg);
    }

    json_ok();
}

function handle_logout(): never {
    require_post();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
        setcookie(REMEMBER_ME_COOKIE, '', time() - 42000, $p['path'], $p['domain'], $p['secure'], true);
    }
    session_destroy();
    json_ok('Logged out.');
}
