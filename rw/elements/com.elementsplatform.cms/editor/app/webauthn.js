import { api } from './api.js?v=20260538';

export function supportsPasskeys() {
    return typeof window !== 'undefined'
        && typeof window.PublicKeyCredential === 'function'
        && !!navigator.credentials
        && typeof navigator.credentials.create === 'function'
        && typeof navigator.credentials.get === 'function';
}

export function b64urlToBuf(s) {
    const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
    const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
}

export function bufToB64url(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeCreationOptions(opts) {
    const pk = { ...opts.publicKey };
    pk.challenge = b64urlToBuf(pk.challenge);
    pk.user = { ...pk.user, id: b64urlToBuf(pk.user.id) };
    if (Array.isArray(pk.excludeCredentials)) {
        pk.excludeCredentials = pk.excludeCredentials.map(c => ({ ...c, id: b64urlToBuf(c.id) }));
    }
    return { publicKey: pk };
}

function decodeRequestOptions(opts) {
    const pk = { ...opts.publicKey };
    pk.challenge = b64urlToBuf(pk.challenge);
    if (Array.isArray(pk.allowCredentials)) {
        pk.allowCredentials = pk.allowCredentials.map(c => ({ ...c, id: b64urlToBuf(c.id) }));
    }
    return { publicKey: pk };
}

function encodeAttestationCredential(cred) {
    return {
        id: cred.id,
        rawId: bufToB64url(cred.rawId),
        type: cred.type,
        response: {
            clientDataJSON: bufToB64url(cred.response.clientDataJSON),
            attestationObject: bufToB64url(cred.response.attestationObject),
            transports: typeof cred.response.getTransports === 'function'
                ? cred.response.getTransports()
                : [],
        },
    };
}

function encodeAssertionCredential(cred) {
    return {
        id: cred.id,
        rawId: bufToB64url(cred.rawId),
        type: cred.type,
        response: {
            clientDataJSON: bufToB64url(cred.response.clientDataJSON),
            authenticatorData: bufToB64url(cred.response.authenticatorData),
            signature: bufToB64url(cred.response.signature),
            userHandle: cred.response.userHandle ? bufToB64url(cred.response.userHandle) : null,
        },
    };
}

export async function registerPasskey(name) {
    const options = await api('passkey.registerOptions', { method: 'POST', silent: true });
    if (!options || options._error) {
        throw new Error(options?._error || 'register_options_failed');
    }
    const creationOptions = decodeCreationOptions(options);
    const cred = await navigator.credentials.create(creationOptions);
    if (!cred) throw new Error('no_credential');
    const payload = encodeAttestationCredential(cred);
    const result = await api('passkey.registerVerify', {
        method: 'POST',
        body: { credential: payload, name },
        silent: true,
    });
    if (!result || result._error) {
        throw new Error(result?._error || 'register_verify_failed');
    }
    return result;
}

export async function loginWithPasskey(remember = false) {
    const options = await api('passkey.loginOptions', { method: 'POST', silent: true });
    if (!options || options._error) {
        throw new Error(options?._error || 'login_options_failed');
    }
    const requestOptions = decodeRequestOptions(options);
    const cred = await navigator.credentials.get(requestOptions);
    if (!cred) throw new Error('no_credential');
    const payload = encodeAssertionCredential(cred);
    const result = await api('passkey.loginVerify', {
        method: 'POST',
        body: { credential: payload, remember },
        silent: true,
    });
    if (!result || result._error) {
        throw new Error(result?._error || 'login_verify_failed');
    }
    return result;
}
