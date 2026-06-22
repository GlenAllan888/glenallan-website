import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { api } from '../api.js?v=20260538';
import { showFlash, user, featureEnabled } from '../state.js?v=20260538';
import { route } from '../router.js?v=20260538';
import { Loader, Plus, Trash2, Copy, Check, Key } from '../icons.js?v=20260538';
import { PageHeader } from '../components/PageHeader.js?v=20260538';
import { SectionLayout } from '../components/SectionLayout.js?v=20260538';
import { Modal } from '../components/Modal.js?v=20260538';
import { FeatureAccessPrompt } from '../components/FeatureAccessPrompt.js?v=20260538';
import { t } from '../i18n.js?v=20260538';

const html = htm.bind(h);

const inputClass = 'w-full h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50';
const labelClass = 'block text-sm font-medium leading-none mb-2';

function formatTimestamp(ts) {
    if (!ts) return '';
    return new Date(ts * 1000).toLocaleString();
}

function apiBaseUrl() {
    const base = window.__ELEMENTS_CMS_CONFIG?.editorBasePath || '.';
    const restPath = base.replace(/\/editor$/, '/api');
    return new URL(restPath, window.location.href).href.replace(/\/$/, '');
}

export function Api() {
    const apiAllowed = featureEnabled('api_tokens');

    const [tokens, setTokens] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    const [modalOpen, setModalOpen] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [revealed, setRevealed] = useState(null);
    const [copied, setCopied] = useState(null);
    const [revokeId, setRevokeId] = useState(null);

    const endpoint = apiBaseUrl();
    const authHeaderExample = 'Authorization: Bearer <your-key>';

    async function load({ showLoader = true } = {}) {
        if (!apiAllowed) {
            setLoading(false);
            return;
        }
        if (showLoader) setLoading(true);
        const [tokRes, userRes] = await Promise.all([
            api('apiTokens.list'),
            api('users.list', { silent: true }),
        ]);
        if (tokRes && !tokRes._error) setTokens(tokRes.tokens || []);
        if (userRes && !userRes._error) setUsers(userRes.users || []);
        if (showLoader) setLoading(false);
    }

    useEffect(() => {
        load();
    }, [apiAllowed]);

    if (!apiAllowed) {
        return html`
            <${PageHeader} title="${t('api.title')}" subtitle="${t('api.subtitle')}" />
            <${FeatureAccessPrompt} description=${t('api.license_required_desc')} />
        `;
    }

    function openCreate() {
        setName('');
        setEmail(users[0]?.email || user.value?.email || '');
        setModalOpen(true);
    }

    async function handleCreate() {
        if (!name.trim() || submitting) return;
        setSubmitting(true);
        const res = await api('apiTokens.create', {
            method: 'POST',
            body: { name, email },
        });
        setSubmitting(false);
        if (res && !res._error) {
            setTokens(prev => [...prev, res.token]);
            setRevealed({ id: res.token.id, plaintext: res.plaintext, name: res.token.name });
            setModalOpen(false);
            showFlash('success', t('api.created'));
        }
    }

    async function handleRevoke() {
        const id = revokeId;
        const res = await api('apiTokens.revoke', {
            method: 'POST',
            body: { id },
        });
        if (res && !res._error) {
            showFlash('success', t('api.revoked'));
            setRevokeId(null);
            setTokens(prev => prev.filter(k => k.id !== id));
        }
    }

    function copyText(text, key) {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    }

    if (loading) {
        return html`
            <${PageHeader} title="${t('api.title')}" subtitle="${t('api.subtitle')}" />
            <div class="flex items-center justify-center py-20">
                <${Loader} className="text-accent-dark" />
            </div>
        `;
    }

    const curlExample = `curl -H "${authHeaderExample.replace('<your-key>', revealed?.plaintext || 'api_…')}" ${endpoint}/cms/`;

    return html`
        <${PageHeader} title="${t('api.title')}" subtitle="${t('api.subtitle')}" />

        <div class="max-w-3xl">
            <p class="text-[13px] text-text-secondary mb-5">
                ${t('api.intro')}
                ${' '}
                <button onclick=${() => route('/ai')} class="text-accent-dark hover:underline">${t('api.see_also_mcp')}</button>
            </p>

            <${SectionLayout} title="${t('api.keys')}" description="${t('api.keys_desc')}">
                <div class="flex flex-col gap-3">
                    ${tokens.length === 0 && html`
                        <div class="text-center py-8 text-text-muted">
                            <${Key} size=${32} className="mx-auto mb-2 opacity-40" />
                            <p class="text-sm">${t('api.no_keys')}</p>
                        </div>
                    `}

                    ${tokens.map(tok => html`
                        <div key=${tok.id} class="border border-border rounded-lg p-4 bg-surface">
                            <div class="flex items-start justify-between gap-3">
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 mb-1">
                                        <span class="text-[13px] font-semibold text-text truncate">${tok.name}</span>
                                        <code class="text-[11px] font-mono text-text-muted">${tok.prefix}…</code>
                                    </div>
                                    <div class="text-[11px] text-text-muted">
                                        ${tok.email} ·
                                        ${tok.last_used_at
                                            ? t('api.last_used') + ' ' + formatTimestamp(tok.last_used_at)
                                            : t('api.never_used')
                                        }
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    <button onclick=${() => setRevokeId(tok.id)}
                                        class="text-text-muted hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50"
                                        title="${t('api.revoke')}">
                                        <${Trash2} size=${14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    `)}

                    <button onclick=${openCreate}
                        class="flex items-center justify-center gap-2 py-2.5 border border-dashed border-border rounded-lg text-[13px] text-text-secondary hover:text-text hover:border-text-muted transition-colors">
                        <${Plus} size=${14} />
                        ${t('api.add')}
                    </button>
                </div>
            <//>

            <${SectionLayout} title="${t('api.endpoint')}" description="${t('api.endpoint_desc')}" last=${true}>
                <div class="flex flex-col gap-3">
                    <div>
                        <label class="${labelClass}">${t('api.endpoint')}</label>
                        <div class="flex items-center gap-2">
                            <code class="flex-1 text-[12px] font-mono bg-bg border border-border rounded-lg px-3 py-2 truncate">${endpoint}</code>
                            <button onclick=${() => copyText(endpoint, 'endpoint')}
                                class="shrink-0 p-2 rounded-lg border border-border hover:bg-border-light text-text-muted hover:text-text transition-colors">
                                <${copied === 'endpoint' ? Check : Copy} size=${14} />
                            </button>
                        </div>
                        <p class="text-[11px] text-text-muted mt-1">${t('api.endpoint_help')}</p>
                    </div>

                    <div>
                        <label class="${labelClass}">${t('api.auth_header')}</label>
                        <code class="block text-[12px] font-mono bg-bg border border-border rounded-lg px-3 py-2 break-all">${authHeaderExample}</code>
                        <p class="text-[11px] text-text-muted mt-1">${t('api.auth_header_help')}</p>
                    </div>
                </div>
            <//>
        </div>

        <${Modal} open=${modalOpen} onClose=${() => setModalOpen(false)} title=${t('api.create_title')}>
            <div class="flex flex-col gap-4 p-5">
                <div>
                    <label class="${labelClass}">${t('api.name')}</label>
                    <input type="text" value=${name} onInput=${e => setName(e.target.value)}
                        onKeyDown=${e => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCreate();
                            }
                        }}
                        class="${inputClass}" placeholder="${t('api.name_placeholder')}" />
                    <p class="text-[11px] text-text-muted mt-1">${t('api.name_help')}</p>
                </div>

                <div>
                    <label class="${labelClass}">${t('api.owner')}</label>
                    <select value=${email} onChange=${e => setEmail(e.target.value)} class="${inputClass}">
                        ${users.map(u => html`
                            <option key=${u.email} value=${u.email}>${u.email} (${u.role})</option>
                        `)}
                    </select>
                    <p class="text-[11px] text-text-muted mt-1">${t('api.owner_help')}</p>
                </div>

                <div class="flex justify-end gap-2 pt-2 border-t border-border-light">
                    <button type="button" onclick=${() => setModalOpen(false)}
                        class="px-3 py-1.5 text-[12px] text-text-secondary hover:text-text rounded-btn transition-colors">
                        ${t('common.cancel')}
                    </button>
                    <button type="button" onclick=${handleCreate}
                        disabled=${submitting || !name.trim()}
                        class="px-3 py-1.5 bg-accent hover:bg-accent-dark text-white rounded-btn text-[12px] font-medium disabled:opacity-50 transition-colors">
                        ${submitting ? t('api.creating') : t('api.create')}
                    </button>
                </div>
            </div>
        <//>

        <${Modal} open=${!!revealed} onClose=${() => setRevealed(null)} title=${t('api.revealed_title')} maxWidth="max-w-md">
            <div class="p-5 flex flex-col gap-4">
                <p class="text-[12px] text-accent-dark font-medium">${t('api.copy_warning')}</p>

                <div>
                    <label class="${labelClass}">${t('api.plaintext_label')}</label>
                    <div class="flex items-center gap-2">
                        <code class="text-[12px] font-mono bg-bg border border-border rounded-lg px-3 py-2 flex-1 break-all">${revealed?.plaintext}</code>
                        <button onclick=${() => copyText(revealed.plaintext, 'reveal-plain')}
                            class="shrink-0 p-2 rounded-lg border border-border hover:bg-border-light text-text-muted hover:text-text transition-colors">
                            <${copied === 'reveal-plain' ? Check : Copy} size=${14} />
                        </button>
                    </div>
                </div>

                <div>
                    <label class="${labelClass}">${t('api.curl_example_label')}</label>
                    <div class="flex items-center gap-2">
                        <code class="text-[12px] font-mono bg-bg border border-border rounded-lg px-3 py-2 flex-1 break-all">${curlExample}</code>
                        <button onclick=${() => copyText(curlExample, 'reveal-curl')}
                            class="shrink-0 p-2 rounded-lg border border-border hover:bg-border-light text-text-muted hover:text-text transition-colors">
                            <${copied === 'reveal-curl' ? Check : Copy} size=${14} />
                        </button>
                    </div>
                </div>

                <div class="flex justify-end pt-2 border-t border-border-light">
                    <button onclick=${() => setRevealed(null)}
                        class="px-3 py-1.5 bg-accent hover:bg-accent-dark text-white rounded-btn text-[12px] font-medium transition-colors">
                        ${t('api.done')}
                    </button>
                </div>
            </div>
        <//>

        <${Modal} open=${!!revokeId} onClose=${() => setRevokeId(null)} title=${t('api.revoke_title')}>
            <div class="p-5">
                <p class="text-sm text-text-secondary mb-4">${t('api.revoke_confirm')}</p>
                <div class="flex justify-end gap-2">
                    <button onclick=${() => setRevokeId(null)}
                        class="px-3 py-1.5 text-[12px] text-text-secondary hover:text-text rounded-btn transition-colors">
                        ${t('common.cancel')}
                    </button>
                    <button onclick=${handleRevoke}
                        class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-btn text-[12px] font-medium transition-colors">
                        ${t('api.revoke')}
                    </button>
                </div>
            </div>
        <//>
    `;
}
