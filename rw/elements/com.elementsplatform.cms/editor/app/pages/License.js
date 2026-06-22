import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import htm from 'htm';
import { currentQuery, setQuery } from '../router.js?v=20260538';
import { license as licenseSignal, showFlash, user as userSignal, config as configSignal } from '../state.js?v=20260538';
import {
    rememberCheckoutSession,
    readCheckoutSession,
    clearCheckoutSession,
    startCheckout,
    pollCheckoutSession,
    activateLicense,
    deactivateLicense,
    openCustomerPortal,
    refreshLicense,
} from '../license-actions.js?v=20260538';
import { ExternalLink, Check, X, Loader, AlertTriangle } from '../icons.js?v=20260538';
import { SectionLayout } from '../components/SectionLayout.js?v=20260538';
import { PageHeader } from '../components/PageHeader.js?v=20260538';
import { t } from '../i18n.js?v=20260538';

const html = htm.bind(h);

const inputClass = 'w-full h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50';

// Marketing feature matrix for the pre-purchase cards. Values: true (included),
// false (not included), 'one' or 'unlimited' (a quantity). Mirrors the public
// Solo / Studio comparison. The authoritative post-purchase limits come from
// the signed /api/check response (`lic.limits`), not this table.
const FEATURES = [
    { key: 'feature_editor',            solo: true,        studio: true },
    { key: 'feature_resource_upload',   solo: true,        studio: true },
    { key: 'feature_content_folders',   solo: 'unlimited', studio: 'unlimited' },
    { key: 'feature_resource_folders',  solo: 'unlimited', studio: 'unlimited' },
    { key: 'feature_users',             solo: 'one',       studio: 'unlimited' },
    { key: 'feature_subfolders',        solo: true,        studio: true },
    { key: 'feature_versions',          solo: true,        studio: true },
    { key: 'feature_frontmatter',       solo: true,        studio: true },
    { key: 'feature_resource_resizing', solo: true,        studio: true },
    { key: 'feature_form_fields',       solo: true,        studio: true },
    { key: 'feature_theming',           solo: false,       studio: true },
    { key: 'feature_mcp',               solo: false,       studio: true },
    { key: 'feature_ai',                solo: false,       studio: true },
    { key: 'feature_webhooks',          solo: false,       studio: true },
    { key: 'feature_api',               solo: false,       studio: true },
];

const PLANS = [
    { id: 'solo',   nameKey: 'license.plan_solo',   price: 99,  col: 'solo',   domainKey: 'license.domains_solo' },
    { id: 'studio', nameKey: 'license.plan_studio', price: 199, col: 'studio', domainKey: 'license.domains_studio' },
];

const PLAN_NAME_KEYS = {
    solo: 'license.plan_solo',
    studio: 'license.plan_studio',
    paid: 'license.plan_paid',
    pro: 'license.plan_paid',
};

// Rows for the post-purchase "Your plan" view, driven by the signed limits
// object. Numeric keys render as a number or "Unlimited" (null); booleans as
// a check / cross.
const LIMIT_ROWS = [
    { key: 'max_users',            labelKey: 'license.feature_users',            type: 'num' },
    { key: 'max_content_folders',  labelKey: 'license.feature_content_folders',  type: 'num' },
    { key: 'max_resource_folders', labelKey: 'license.feature_resource_folders', type: 'num' },
    { key: 'version_history_days', labelKey: 'license.feature_versions',         type: 'days' },
    { key: 'theme_customization',  labelKey: 'license.feature_theming',          type: 'bool' },
    { key: 'mcp_tokens',           labelKey: 'license.feature_mcp',              type: 'bool' },
    { key: 'ai',                   labelKey: 'license.feature_ai',               type: 'bool' },
    { key: 'webhooks',             labelKey: 'license.feature_webhooks',         type: 'bool' },
    { key: 'api_tokens',           labelKey: 'license.feature_api',              type: 'bool' },
];

// Reasons surfaced from /api/check failure responses → user-visible copy.
function reasonMessage(reason, fallback) {
    switch (reason) {
        case 'no_key':                return t('license.no_key');
        case 'unknown_key':           return t('license.unknown_key');
        case 'license_revoked':       return t('license.license_revoked');
        case 'subscription_canceled': return t('license.subscription_canceled');
        case 'no_subscription':       return t('license.no_subscription');
        case 'invalid_domain':        return t('license.invalid_domain');
        case 'domain_limit_reached':  return t('license.domain_limit_title');
        case 'solo_domain_mismatch':  return t('license.solo_domain_mismatch');
        case 'outage':                return t('license.outage');
        case 'untrusted_response':    return t('license.untrusted_response');
        case 'invalid_request':       return t('license.invalid_request');
        default:                      return fallback || t('license.verify_failed');
    }
}

function maskKey(key) {
    if (!key) return '';
    const parts = key.split('-');
    if (parts.length !== 5) return key;
    const tail = parts[parts.length - 1];
    return `•••••-•••••-•••••-•••••-${tail}`;
}

function planDisplayName(lic) {
    const productName = String(lic?.license_product_name || '').trim();
    if (productName) return productName;

    const productSlug = String(lic?.license_product_slug || '').trim().toLowerCase();
    const productLabelKey = PLAN_NAME_KEYS[productSlug];
    if (productLabelKey) return t(productLabelKey);

    const normalized = String(lic?.tier || '').trim().toLowerCase();
    const labelKey = PLAN_NAME_KEYS[normalized];
    if (labelKey) return t(labelKey);

    const fallback = productSlug || normalized;
    if (!fallback) return t('license.plan_paid');

    return fallback
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
}

function planKey(lic) {
    const productSlug = String(lic?.license_product_slug || '').trim().toLowerCase();
    if (productSlug === 'solo' || productSlug === 'studio') return productSlug;

    const tier = String(lic?.tier || '').trim().toLowerCase();
    if (tier === 'solo' || tier === 'studio') return tier;

    return '';
}

function planDomainLabel(lic) {
    const key = planKey(lic);
    if (key === 'solo') return t('license.domains_solo');
    if (key === 'studio') return t('license.domains_studio');
    if (lic?.max_domains === null) return t('license.unlimited');
    if (Number(lic?.max_domains || 1) === 1) return t('license.domains_single');
    return String(lic.max_domains);
}

const FeatureCheck = () => html`<${Check} size=${15} className="text-green-600 flex-shrink-0" />`;
const FeatureCross = () => html`<${X} size=${15} className="text-text-muted/50 flex-shrink-0" />`;

// Render a single feature-matrix value for a plan card.
function featureValue(value) {
    if (value === true)  return html`<${FeatureCheck} />`;
    if (value === false) return html`<${FeatureCross} />`;
    if (value === 'one')       return html`<span class="text-[12px] font-medium text-text-secondary">${t('license.one')}</span>`;
    if (value === 'unlimited') return html`<span class="text-[12px] font-semibold text-text">${t('license.unlimited')}</span>`;
    return null;
}

// Render a post-purchase limit value from the signed limits object.
function limitValue(row, limits) {
    const raw = limits ? limits[row.key] : undefined;
    if (row.type === 'bool') {
        return raw ? html`<${FeatureCheck} />` : html`<${FeatureCross} />`;
    }
    if (raw === null || raw === undefined) {
        return html`<span class="text-[12px] font-semibold text-text">${t('license.unlimited')}</span>`;
    }
    if (row.type === 'days') {
        return html`<span class="text-[12px] font-medium text-text">${t('license.days', { days: raw })}</span>`;
    }
    return html`<span class="text-[12px] font-medium text-text">${raw}</span>`;
}

export function License() {
    const [lic, setLic] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(null); // plan id currently checking out
    const [activating, setActivating] = useState(false);
    const [email, setEmail] = useState(() => userSignal.value?.email || '');
    const [keyInput, setKeyInput] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [activationError, setActivationError] = useState(null);
    const [polling, setPolling] = useState(false);
    const [pollStatus, setPollStatus] = useState('');
    const [openingPortal, setOpeningPortal] = useState(false);
    const [deactivating, setDeactivating] = useState(false);
    const pollAbort = useRef(false);

    function updateLicense(newLic, newConfig) {
        setLic(newLic);
        licenseSignal.value = newLic;
        if (newConfig) {
            configSignal.value = newConfig;
        }
    }

    async function load() {
        setLoading(true);
        // Force a fresh check against portal.elementsplatform.com so license
        // changes (domain moves, plan limits) reflect here.
        const res = await refreshLicense();
        if (res && !res._error) updateLicense(res.license, res.config);
        setLoading(false);
    }

    /**
     * Drive the post-checkout flow:
     *   1. Poll /api/checkout/session/{id} every 2s for up to ~2min.
     *   2. On `ready`, write the license key locally and run /api/check.
     *   3. Surface success / timeout / outage to the user.
     */
    async function runActivationFlow(sessionId) {
        setPolling(true);
        setPollStatus(t('license.purchase_pending'));
        pollAbort.current = false;

        const deadline = Date.now() + 2 * 60 * 1000;
        let licenseKey = null;

        while (!pollAbort.current && Date.now() < deadline) {
            const res = await pollCheckoutSession(sessionId);
            if (res && res.status === 'ready' && res.license_key) {
                licenseKey = res.license_key;
                break;
            }
            await new Promise(r => setTimeout(r, 2000));
        }

        if (!licenseKey) {
            setPolling(false);
            setPollStatus('');
            clearCheckoutSession();
            showFlash('warning', t('license.purchase_timeout'));
            await load();
            return;
        }

        setPollStatus(t('license.activating'));
        const res = await activateLicense(licenseKey);
        clearCheckoutSession();
        setPolling(false);
        setPollStatus('');

        if (res && !res._error && res.license) {
            updateLicense(res.license, res.config);
            setLoading(false);
            if (res.license.valid) {
                showFlash('success', t('license.purchase_success'));
            } else {
                showFlash('warning', reasonMessage(res.license.reason, res.license.message));
            }
        } else {
            await load();
        }
    }

    useEffect(() => {
        const q = currentQuery.value;

        if (q.purchased === '1') {
            setQuery({ purchased: null });
            const sessionId = readCheckoutSession();
            if (sessionId) {
                runActivationFlow(sessionId);
            } else {
                // No session id stashed — fall back to a normal status reload.
                showFlash('warning', t('license.purchase_session_missing'));
                load();
            }
        } else if (q.cancelled === '1') {
            setQuery({ cancelled: null });
            clearCheckoutSession();
            showFlash('warning', t('license.purchase_cancelled'));
            load();
        } else {
            load();
        }

        return () => { pollAbort.current = true; };
    }, []);

    async function handlePurchase(plan) {
        if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
            showFlash('warning', t('license.email_required'));
            return;
        }
        setSubmitting(plan);
        const res = await startCheckout({ plan, email: email.trim() });
        setSubmitting(null);
        // startCheckout redirects on success; if it returns null an error flash already showed.
        if (!res) return;
    }

    async function handleActivate(e) {
        if (e) e.preventDefault();
        const trimmed = keyInput.trim().toUpperCase();
        if (!/^[A-Z0-9]{5}(?:-[A-Z0-9]{5}){4}$/.test(trimmed)) {
            setActivationError(t('license.activate_format_error'));
            return;
        }
        setActivationError(null);
        setActivating(true);
        const res = await activateLicense(trimmed);
        setActivating(false);

        if (!res || res._error) return;

        if (res.license) updateLicense(res.license, res.config);

        if (res.license?.valid) {
            showFlash('success', t('license.verified'));
            setKeyInput('');
        } else {
            const reason = res.license?.reason;
            setActivationError(reasonMessage(reason, res.license?.message));
        }
    }

    async function handleManageBilling() {
        setOpeningPortal(true);
        const res = await openCustomerPortal();
        setOpeningPortal(false);
        if (!res || res._error || !res.portal_url) return;
        window.location.href = res.portal_url;
    }

    async function handleDeactivate() {
        if (!confirm(t('license.deactivate_confirm'))) return;
        setDeactivating(true);
        const res = await deactivateLicense();
        setDeactivating(false);
        if (!res || res._error) return;
        if (res.license) updateLicense(res.license, res.config);
        showFlash('success', t('license.deactivated'));
    }

    if (loading) {
        return html`<div class="flex items-center justify-center py-20">
            <${Loader} className="text-accent-dark" />
        </div>`;
    }

    if (!lic) {
        return html`<div class="text-center py-20 text-text-secondary">${t('license.failed_load')}</div>`;
    }

    const isPastDue = lic.valid && lic.underlying_status === 'past_due';
    const isGrace   = lic.valid && lic.status === 'grace';
    const isDomainLimit = !lic.valid && lic.reason === 'domain_limit_reached';
    const currentPlanName = lic.valid ? planDisplayName(lic) : '';
    const activationDomain = lic.licensed_domain || lic.domain || '';
    const hasSeparateActivationDomain = Boolean(lic.domain && activationDomain && lic.domain !== activationDomain);

    return html`
        <div class="max-w-3xl">
            <${PageHeader} title=${t('license.title')} subtitle=${t('license.subtitle')} />

            ${polling && html`
                <div class="rounded-[12px] border border-border bg-surface p-5 mb-6 flex items-center gap-3">
                    <${Loader} className="text-accent-dark" />
                    <div>
                        <div class="text-[14px] font-semibold text-text">${t('license.purchase_pending')}</div>
                        ${pollStatus && html`<div class="text-[12px] text-text-secondary mt-0.5">${pollStatus}</div>`}
                    </div>
                </div>
            `}

            ${lic.valid ? html`
                ${isPastDue && html`
                    <div class="rounded-[12px] border border-amber-200 bg-amber-50 p-4 mb-6 flex items-start gap-3">
                        <${AlertTriangle} size=${18} className="text-amber-700 flex-shrink-0 mt-0.5" />
                        <div>
                            <div class="text-[13px] font-semibold text-amber-800">${t('license.past_due_title')}</div>
                            <div class="text-[12px] text-amber-700 mt-0.5">${t('license.past_due_banner')}</div>
                        </div>
                    </div>
                `}

                ${isGrace && html`
                    <div class="rounded-[12px] border border-amber-200 bg-amber-50 p-4 mb-6">
                        <span class="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full bg-amber-100 text-amber-700">${t('license.grace_period')}</span>
                        ${lic.grace_until && html`
                            <span class="text-[12px] text-amber-700 ml-2">${t('license.expires', { date: new Date(lic.grace_until * 1000).toLocaleString() })}</span>
                        `}
                        ${lic.message && html`<p class="text-[12px] text-amber-700 mt-2">${lic.message}</p>`}
                    </div>
                `}

                <${SectionLayout} title=${t('license.subscription')} description=${t('license.subscription_desc')}>
                    <div class="border border-border rounded-[8px] bg-bg">
                        <div class="px-4 pt-4 pb-3">
                            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div class="min-w-0">
                                    <div class="text-[12px] font-medium text-text-secondary">${t('license.current_plan')}</div>
                                    <div class="mt-1 truncate text-[22px] font-bold leading-tight text-text" title=${currentPlanName}>${currentPlanName}</div>
                                </div>
                                <span class="inline-flex w-fit items-center px-2 py-0.5 text-[11px] font-medium rounded-full ${isPastDue ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}">
                                    ${isPastDue ? t('license.past_due') : t('license.active')}
                                </span>
                            </div>
                            ${isPastDue && html`<p class="mt-1 text-[12px] text-red-700">${t('license.past_due_title')}</p>`}
                        </div>

                        <dl class="border-t border-border-light divide-y divide-border-light">
                            ${activationDomain && html`
                                <div class="px-4 py-3">
                                    <dt class="text-[12px] text-text-secondary">${t('license.activation_domain')}</dt>
                                    <dd class="mt-1 flex items-center justify-between gap-3">
                                        <span class="min-w-0 truncate font-mono text-[13px] text-text" title=${activationDomain}>${activationDomain}</span>
                                        <button
                                            onClick=${handleDeactivate}
                                            disabled=${deactivating}
                                            class="flex-shrink-0 inline-flex items-center px-2 py-1 border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50 text-[12px] font-medium rounded-btn transition-colors"
                                        >
                                            ${deactivating ? t('license.deactivating') : t('license.deactivate')}
                                        </button>
                                    </dd>
                                    ${hasSeparateActivationDomain && html`
                                        <p class="mt-1 text-[11px] text-text-muted">${t('license.activation_domain_help')}</p>
                                    `}
                                </div>
                            `}

                            ${hasSeparateActivationDomain && html`
                                <div class="px-4 py-3">
                                    <dt class="text-[12px] text-text-secondary">${t('license.installation_domain')}</dt>
                                    <dd class="mt-1">
                                        <span class="font-mono text-[13px] text-text" title=${lic.domain}>${lic.domain}</span>
                                    </dd>
                                </div>
                            `}

                            ${lic.license_key && html`
                                <div class="px-4 py-3">
                                    <dt class="text-[12px] text-text-secondary">${t('license.license_key_section')}</dt>
                                    <dd class="mt-1 flex items-center justify-between gap-3">
                                        <code class="min-w-0 truncate font-mono text-[13px] text-text">
                                            ${showKey ? lic.license_key : maskKey(lic.license_key)}
                                        </code>
                                        <button
                                            onClick=${() => setShowKey(s => !s)}
                                            aria-pressed=${showKey}
                                            class="flex-shrink-0 px-2 py-1 bg-surface hover:bg-border/30 text-text text-[12px] font-medium rounded-btn transition-colors border border-border"
                                        >
                                            ${showKey ? t('license.hide') : t('license.show')}
                                        </button>
                                    </dd>
                                </div>
                            `}
                        </dl>

                        <div class="px-4 py-3 border-t border-border-light">
                            <button
                                onClick=${handleManageBilling}
                                disabled=${openingPortal}
                                class="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-surface hover:bg-border/30 disabled:opacity-50 text-text text-[12px] font-medium rounded-btn transition-colors border border-border"
                            >
                                <${ExternalLink} size=${13} />
                                ${openingPortal ? t('common.loading') : t('license.manage_subscription')}
                            </button>
                        </div>
                    </div>
                <//>

                ${lic.limits && html`
                    <${SectionLayout}
                        title=${t('license.plan_limits')}
                        description=${t('license.plan_limits_desc', { plan: currentPlanName })}
                        last=${true}
                    >
                        <div class="border border-border rounded-[8px] bg-bg divide-y divide-border-light">
                            <div class="flex items-center justify-between gap-3 px-4 py-2.5">
                                <span class="text-[13px] text-text">${t('license.feature_domains')}</span>
                                <span class="text-[12px] font-medium text-text">${planDomainLabel(lic)}</span>
                            </div>
                            ${LIMIT_ROWS.map(row => html`
                                <div class="flex items-center justify-between gap-3 px-4 py-2.5">
                                    <span class="text-[13px] text-text">${t(row.labelKey)}</span>
                                    ${limitValue(row, lic.limits)}
                                </div>
                            `)}
                        </div>
                    <//>
                `}
            ` : html`
                ${isDomainLimit && html`
                    <div class="rounded-[12px] border border-amber-200 bg-amber-50 p-4 mb-6">
                        <div class="flex items-start gap-3">
                            <${AlertTriangle} size=${18} className="text-amber-700 flex-shrink-0 mt-0.5" />
                            <div class="flex-1">
                                <div class="text-[13px] font-semibold text-amber-800">${t('license.domain_limit_title')}</div>
                                <div class="text-[12px] text-amber-700 mt-0.5">${t('license.domain_limit_desc')}</div>
                                <a
                                    href="https://portal.elementsplatform.com/account"
                                    target="_blank"
                                    rel="noopener"
                                    class="inline-flex items-center gap-1.5 mt-3 text-[12px] text-amber-800 hover:text-amber-900 font-medium underline"
                                >
                                    ${t('license.open_account')}
                                    <${ExternalLink} size=${12} />
                                </a>
                            </div>
                        </div>
                    </div>
                `}

                <!-- Plan selection -->
                <div class="text-center mb-6">
                    <h2 class="text-[20px] font-bold text-text">${t('license.choose_plan')}</h2>
                    <p class="text-[13px] text-text-secondary mt-0.5">${t('license.choose_plan_subtitle')}</p>
                </div>

                <!-- Email -->
                <div class="max-w-md mx-auto mb-6 space-y-2">
                    <label class="block text-[12px] font-medium text-text">${t('license.email_label')}</label>
                    <input
                        type="email"
                        value=${email}
                        onInput=${e => setEmail(e.target.value)}
                        placeholder=${t('license.email_placeholder')}
                        class=${inputClass}
                        autocomplete="email"
                    />
                </div>

                <!-- Plan cards -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                    ${PLANS.map(plan => html`
                        <div class="rounded-[12px] border ${plan.id === 'studio' ? 'border-accent' : 'border-border'} bg-bg overflow-hidden flex flex-col">
                            <div class="px-5 pt-5 pb-4 text-center border-b border-border">
                                <h3 class="text-[18px] font-bold text-text">${t(plan.nameKey)}</h3>
                                <div class="mt-2 flex items-baseline justify-center gap-1">
                                    <span class="text-[30px] font-bold text-text">$${plan.price}</span>
                                </div>
                                <p class="text-[12px] text-text-muted mt-0.5">${t('license.one_time_payment')}</p>
                                <p class="text-[11px] text-text-secondary mt-1">${t(plan.domainKey)}</p>
                            </div>

                            <ul class="px-5 py-4 space-y-2.5 flex-1">
                                ${FEATURES.map(f => html`
                                    <li class="flex items-center justify-between gap-2.5 text-[13px] text-text">
                                        <span>${t('license.' + f.key)}</span>
                                        ${featureValue(f[plan.col])}
                                    </li>
                                `)}
                            </ul>

                            <div class="px-5 pb-5">
                                <button
                                    onClick=${() => handlePurchase(plan.id)}
                                    disabled=${submitting !== null || polling}
                                    class="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 ${plan.id === 'studio' ? 'bg-accent hover:bg-accent-dark' : 'bg-text hover:bg-text/90'} text-white text-[13px] font-semibold rounded-btn disabled:opacity-50 transition-colors"
                                >
                                    <${ExternalLink} size=${14} />
                                    ${submitting === plan.id
                                        ? t('common.loading')
                                        : t('license.buy_plan', { plan: t(plan.nameKey) })}
                                </button>
                            </div>
                        </div>
                    `)}
                </div>

                <!-- Activate Existing License -->
                <div class="rounded-[12px] border border-border bg-bg p-5 mb-8">
                    <h3 class="text-[14px] font-semibold text-text">${t('license.activate_title')}</h3>
                    <p class="text-[12px] text-text-secondary mt-1 mb-3">${t('license.activate_desc')}</p>

                    <form onSubmit=${handleActivate} class="flex gap-2">
                        <input
                            type="text"
                            value=${keyInput}
                            onInput=${e => { setKeyInput(e.target.value); setActivationError(null); }}
                            placeholder=${t('license.activate_placeholder')}
                            class="${inputClass} font-mono uppercase"
                            autocapitalize="characters"
                            spellcheck="false"
                        />
                        <button
                            type="submit"
                            disabled=${activating || !keyInput.trim()}
                            class="px-4 py-1.5 bg-accent text-white text-[12px] font-medium rounded-btn hover:bg-accent-dark disabled:opacity-50 transition-colors flex-shrink-0"
                        >
                            ${activating ? t('license.activating') : t('license.activate')}
                        </button>
                    </form>

                    ${activationError && html`
                        <div class="mt-3 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-[8px] p-3">
                            ${activationError}
                        </div>
                    `}

                    ${lic.domain && html`
                        <p class="text-[11px] text-text-muted mt-3">
                            ${(() => {
                                const [before, after = ''] = t('license.activate_domain_hint').split('{domain}');
                                return html`${before}<span class="font-mono">${lic.domain}</span>${after}`;
                            })()}
                        </p>
                    `}
                </div>
            `}
        </div>
    `;
}
