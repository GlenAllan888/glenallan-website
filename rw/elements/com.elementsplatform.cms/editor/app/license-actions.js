// Shared license purchase / activation helpers.
//
// The portal.elementsplatform.com flow requires the buyer's email up front,
// so the purchase API call lives on the License page where we can collect it.
// The various "Buy Pro" CTAs scattered across the SPA (modals, upgrade
// prompts, paid-feature banners) just route the user there.

import { api } from './api.js?v=20260538';
import { route } from './router.js?v=20260538';

const SESSION_STORAGE_KEY = 'elements_checkout_session';
const SUPPORT_URL = 'https://www.realmacsoftware.com/support/';

export function rememberCheckoutSession(sessionId) {
    if (!sessionId) return;
    try { localStorage.setItem(SESSION_STORAGE_KEY, sessionId); } catch (_) {}
}

export function readCheckoutSession() {
    try { return localStorage.getItem(SESSION_STORAGE_KEY) || ''; }
    catch (_) { return ''; }
}

export function clearCheckoutSession() {
    try { localStorage.removeItem(SESSION_STORAGE_KEY); } catch (_) {}
}

/**
 * Send the user into the License page so they can review pricing, supply an
 * email address, and start checkout. Used by every "Buy Pro" surface outside
 * the License page itself.
 */
export function goToPurchase() {
    route('/license');
}

/**
 * Open Realmac support for plan upgrades. Studio upgrades are currently handled
 * by support rather than an automatic in-app checkout flow.
 */
export function contactSupport() {
    window.open(SUPPORT_URL, '_blank', 'noopener,noreferrer');
}

/**
 * Kick off a Creem checkout session and redirect the browser to the hosted
 * payment page. Returns null on failure (an error flash is already shown by
 * the api() helper).
 */
export async function startCheckout({ plan, email }) {
    const res = await api('license.purchase', {
        method: 'POST',
        body: { plan, email },
    });

    if (!res || res._error || !res.checkout_url) {
        return null;
    }

    rememberCheckoutSession(res.session_id);
    window.location.href = res.checkout_url;
    return res;
}

/**
 * Poll /api/checkout/session/:id once. Returns the decoded body, or null
 * on transport / server failure.
 */
export async function pollCheckoutSession(sessionId) {
    return api('license.checkoutSession', {
        method: 'POST',
        body: { session_id: sessionId },
        silent: true,
    });
}

/**
 * Persist a freshly-issued license key on the editor and run the first
 * /api/check against the current domain. Returns the decoded body, which on
 * success looks like `{ license: <state> }`.
 */
export async function activateLicense(licenseKey) {
    return api('license.activate', {
        method: 'POST',
        body: { license_key: licenseKey },
    });
}

/**
 * Force a fresh /api/check against the portal backend, bypassing the local
 * 24h cache. Used on License page mount so billing or domain-limit changes
 * made on portal.elementsplatform.com show up immediately.
 */
export async function refreshLicense() {
    return api('license.verify', {
        method: 'POST',
        body: {},
    });
}

/**
 * Free this domain's slot on the upstream license and wipe the local key.
 * Returns `{ license: <unlicensed-state> }` on success.
 */
export async function deactivateLicense() {
    return api('license.deactivate', {
        method: 'POST',
        body: {},
    });
}

/**
 * Mint a one-shot Creem customer portal URL for the current owner. The owner's
 * account email must match the customer record on file. Returns `{ portal_url }`.
 */
export async function openCustomerPortal() {
    return api('license.billing', {
        method: 'POST',
        body: {},
    });
}
