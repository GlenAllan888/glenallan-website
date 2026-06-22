<?php

function license_offer_from_plan(string $plan): string {
    $normalized = strtolower(trim($plan));

    return match ($normalized) {
        'studio' => 'studio_perpetual',
        default  => 'solo_perpetual',
    };
}

function handle_license_status(array $cfg, array $license): never {
    require_owner();
    json_response([
        'license' => $license,
        'config'  => client_config($cfg, $license),
    ]);
}

function handle_license_verify(array $cfg, array $license): never {
    require_owner();
    require_post();
    verify_csrf();

    $fresh = get_license_state(true);
    json_response([
        'license' => $fresh,
        'config'  => client_config($cfg, $fresh),
    ]);
}

function handle_license_purchase(array $cfg, array $license): never {
    require_owner();
    require_post();
    verify_csrf();

    $input = get_json_body();

    $offer = license_offer_from_plan((string) ($input['plan'] ?? 'solo'));

    $email = trim((string) ($input['email'] ?? ''));
    if ($email === '') {
        $email = (string) ($cfg['users'][current_user()]['email'] ?? '');
    }
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_error('A valid email address is required to start checkout.', 422);
    }

    $base = admin_base_url($cfg);
    // The SPA picks up ?session=<id>&purchased=1 on return and starts polling.
    $return_url = $base . '#/license?purchased=1';

    $result = license_call_checkout_start([
        'offer'      => $offer,
        'email'      => $email,
        'return_url' => $return_url,
    ]);

    if ($result === null) {
        json_error('Could not reach the payment provider. Please try again.', 502);
    }

    [$code, $body] = $result;

    if ($code !== 200 || !is_array($body) || empty($body['checkout_url'])) {
        $message = is_array($body) && !empty($body['error'])
            ? (string) $body['error']
            : 'Failed to create checkout session.';
        json_error($message, $code >= 400 ? $code : 502);
    }

    json_response([
        'checkout_url' => $body['checkout_url'],
        'session_id'   => $body['session_id'] ?? null,
    ]);
}

function handle_license_checkout_session(array $cfg, array $license): never {
    require_owner();
    require_post();
    verify_csrf();

    $input      = get_json_body();
    $session_id = trim((string) ($input['session_id'] ?? ''));

    if ($session_id === '' || !preg_match('/^[A-Za-z0-9_-]{1,128}$/', $session_id)) {
        json_error('Invalid session id.', 422);
    }

    $result = license_call_checkout_session($session_id);

    if ($result === null) {
        json_error('Could not reach the payment provider. Please try again.', 502);
    }

    [$code, $body] = $result;

    // 200 -> { status: ready, license_key, tier }
    // 202 -> { status: pending }
    if (!is_array($body)) {
        json_error('Unexpected response from the payment provider.', 502);
    }

    json_response($body);
}

function handle_license_activate(array $cfg, array $license): never {
    require_owner();
    require_post();
    verify_csrf();

    $input = get_json_body();
    $key   = strtoupper(trim((string) ($input['license_key'] ?? '')));

    if (!license_key_is_well_formed($key)) {
        json_error('License key must look like XXXXX-XXXXX-XXXXX-XXXXX-XXXXX.', 422);
    }

    write_license_key($key);

    $state = get_license_state(true);

    json_response([
        'license' => $state,
        'config'  => client_config($cfg, $state),
    ]);
}

function handle_license_billing(array $cfg, array $license): never {
    require_owner();
    require_post();
    verify_csrf();

    $key = read_license_key();
    if ($key === '') {
        json_error('No license key on this install.', 422);
    }

    $email = current_user();
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_error('Your account email is required to open the customer portal.', 422);
    }

    $result = license_call_portal($key, $email);

    if ($result === null) {
        json_error('Could not reach the payment provider. Please try again.', 502);
    }

    [$code, $body] = $result;

    if ($code === 200 && is_array($body) && !empty($body['portal_url'])) {
        json_response(['portal_url' => (string) $body['portal_url']]);
    }

    $err = is_array($body) && !empty($body['error']) ? (string) $body['error'] : '';

    switch ($code) {
        case 404:
            json_error('Email does not match the customer on this license.', 404);
        case 409:
            json_error('Customer portal is not available for this license. Please contact support.', 409);
        case 410:
            json_error('This license has been revoked.', 410);
        case 422:
            json_error($err !== '' ? $err : 'Invalid request.', 422);
        case 429:
            json_error('Too many portal requests. Please try again in a minute.', 429);
        default:
            json_error('Could not reach the payment provider. Please try again.', 502);
    }
}

function handle_license_deactivate(array $cfg, array $license): never {
    require_owner();
    require_post();
    verify_csrf();

    $key = read_license_key();
    if ($key === '') {
        json_error('No license to deactivate.', 422);
    }

    $domain = detect_domain();
    if ($domain === '') {
        json_error('Could not determine this installation\'s domain.', 422);
    }

    $result = license_call_deactivate($key, $domain);

    if ($result === null) {
        json_error('Could not reach the payment provider. Please try again.', 502);
    }

    [$code, $body] = $result;

    // 200 (any body) and 404 unknown_key both mean: this domain is no longer
    // tied to a usable license, so wipe local state and drop to unlicensed.
    if ($code === 200 || $code === 404) {
        clear_license_key();
        $state = get_license_state(true);
        json_response([
            'license' => $state,
            'config'  => client_config($cfg, $state),
        ]);
    }

    if ($code === 429) {
        json_error('Too many deactivation attempts. Please try again in a minute.', 429);
    }

    if ($code === 422) {
        $err = is_array($body) && !empty($body['error']) ? (string) $body['error'] : 'Invalid request.';
        json_error($err, 422);
    }

    json_error('Could not reach the payment provider. Please try again.', 502);
}
