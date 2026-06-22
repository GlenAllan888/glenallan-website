import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { api } from '../../api.js?v=20260538';
import { csrf, showFlash, user } from '../../state.js?v=20260538';
import { route } from '../../router.js?v=20260538';
import { Loader, Trash2, Copy, Check, Sparkles, Plus, Key, Download } from '../../icons.js?v=20260538';
import { SectionLayout } from '../../components/SectionLayout.js?v=20260538';
import { Modal } from '../../components/Modal.js?v=20260538';
import { t } from '../../i18n.js?v=20260538';

const html = htm.bind(h);

const inputClass = 'w-full h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50';
const labelClass = 'block text-sm font-medium leading-none mb-2';

function formatTimestamp(ts) {
    if (!ts) return '';
    return new Date(ts * 1000).toLocaleString();
}

function mcpEndpointUrl() {
    const base = window.__ELEMENTS_CMS_CONFIG?.editorBasePath || '.';
    return new URL(`${base}/mcp.php`, window.location.href).href;
}

function mcpBundleUrl() {
    const base = window.__ELEMENTS_CMS_CONFIG?.editorBasePath || '.';
    return new URL(`${base}/mcp-bundle.php`, window.location.href).href;
}

function defaultBundleName() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `Claude Desktop (${yyyy}-${mm}-${dd})`;
}

// Trigger a file download by submitting a fetch and pushing the resulting
// blob through a synthetic <a download>. We can't use a plain form post
// because the JSON body + CSRF header pattern is what the endpoint expects;
// using fetch keeps the auth model uniform with the rest of the SPA.
async function downloadBundle({ name, username }) {
    const url = mcpBundleUrl();
    let res;
    try {
        res = await fetch(url, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrf.value,
            },
            body: JSON.stringify({ name, username }),
        });
    } catch (e) {
        return { _error: t('common.network_error') };
    }

    if (!res.ok) {
        try {
            const data = await res.json();
            return { _error: data.error || `HTTP ${res.status}` };
        } catch {
            return { _error: `HTTP ${res.status}` };
        }
    }

    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = /filename="?([^";]+)"?/.exec(disposition);
    const filename = match ? match[1] : 'elements-cms.mcpb';

    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);

    return { ok: true, filename };
}

export function ConnectionsTab() {
    const [tokens, setTokens] = useState([]);
    const [clients, setClients] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    const [bundleOpen, setBundleOpen] = useState(false);
    const [bundleName, setBundleName] = useState('');
    const [bundleUser, setBundleUser] = useState('');
    const [bundling, setBundling] = useState(false);

    const [tokenOpen, setTokenOpen] = useState(false);
    const [tokenName, setTokenName] = useState('');
    const [tokenUser, setTokenUser] = useState('');
    const [creatingToken, setCreatingToken] = useState(false);
    const [revealed, setRevealed] = useState(null);

    const [revokeTokenId, setRevokeTokenId] = useState(null);
    const [revokeClientId, setRevokeClientId] = useState(null);
    const [copied, setCopied] = useState(null);

    const endpoint = mcpEndpointUrl();

    async function load({ showLoader = true } = {}) {
        if (showLoader) setLoading(true);
        const [tokRes, cliRes, userRes] = await Promise.all([
            api('mcpTokens.list', { silent: true }),
            api('oauthClients.list', { silent: true }),
            api('users.list', { silent: true }),
        ]);
        if (tokRes && !tokRes._error) setTokens(tokRes.tokens || []);
        if (cliRes && !cliRes._error) setClients(cliRes.clients || []);
        if (userRes && !userRes._error) setUsers(userRes.users || []);
        if (showLoader) setLoading(false);
    }

    useEffect(() => { load(); }, []);

    function openBundle() {
        setBundleName(defaultBundleName());
        setBundleUser(user.value?.email || users[0]?.email || '');
        setBundleOpen(true);
    }

    async function handleDownloadBundle() {
        if (!bundleName.trim() || !bundleUser || bundling) return;
        setBundling(true);
        const res = await downloadBundle({ name: bundleName.trim(), username: bundleUser });
        setBundling(false);
        if (res._error) {
            showFlash('error', res._error);
            return;
        }
        showFlash('success', t('ai.bundle_downloaded'));
        setBundleOpen(false);
        // The new token now exists on the server — refresh the list so the
        // user can see (and revoke) the bundle's bearer.
        load({ showLoader: false });
    }

    function openToken() {
        setTokenName('');
        setTokenUser(user.value?.email || users[0]?.email || '');
        setTokenOpen(true);
    }

    async function handleCreateToken() {
        if (!tokenName.trim() || !tokenUser || creatingToken) return;
        setCreatingToken(true);
        const res = await api('mcpTokens.create', {
            method: 'POST',
            body: { name: tokenName.trim(), username: tokenUser },
        });
        setCreatingToken(false);
        if (res && !res._error) {
            setTokens(prev => [...prev, res.token]);
            setRevealed({
                id: res.token.id,
                plaintext: res.plaintext,
                name: res.token.name,
            });
            setTokenOpen(false);
            showFlash('success', t('ai.created'));
        }
    }

    async function handleRevokeToken() {
        const id = revokeTokenId;
        const res = await api('mcpTokens.revoke', {
            method: 'POST',
            body: { id },
        });
        if (res && !res._error) {
            showFlash('success', t('ai.revoked'));
            setRevokeTokenId(null);
            setTokens(prev => prev.filter(tok => tok.id !== id));
        }
    }

    async function handleRevokeClient() {
        const id = revokeClientId;
        const res = await api('oauthClients.revoke', {
            method: 'POST',
            body: { client_id: id },
        });
        if (res && !res._error) {
            showFlash('success', 'Client revoked.');
            setRevokeClientId(null);
            setClients(prev => prev.filter(c => c.client_id !== id));
        }
    }

    function copyText(text, key) {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    }

    if (loading) {
        return html`<div class="flex items-center justify-center py-20">
            <${Loader} className="text-accent-dark" />
        </div>`;
    }

    const headerExample = `Authorization: Bearer ${revealed?.plaintext || 'mcp_…'}`;
    const urlExample = `${endpoint}?token=${revealed?.plaintext || 'mcp_…'}`;

    return html`
        <div class="max-w-3xl">
            <p class="text-[12px] text-text-muted mb-4">
                <button onclick=${() => route('/api')} class="hover:text-text-secondary hover:underline">${t('ai.see_also_api')}</button>
            </p>

            <${SectionLayout} title=${t('ai.bundle_title')} description=${t('ai.bundle_desc')}>
                <div class="flex flex-col gap-3">
                    <button onclick=${openBundle}
                        class="inline-flex items-center justify-center gap-2 self-start px-4 py-2 bg-accent hover:bg-accent-dark text-white rounded-btn text-[13px] font-medium transition-colors">
                        <${Download} size=${14} />
                        ${t('ai.bundle_cta')}
                    </button>
                    <p class="text-[11px] text-text-muted">${t('ai.bundle_help')}</p>
                </div>
            <//>

            <${SectionLayout} title=${t('ai.manual_title')} description=${t('ai.manual_desc')}>
                <div class="flex flex-col gap-4">
                    <div>
                        <label class=${labelClass}>${t('ai.endpoint')}</label>
                        <div class="flex items-center gap-2">
                            <code class="flex-1 text-[12px] font-mono bg-bg border border-border rounded-lg px-3 py-2 truncate">${endpoint}</code>
                            <button onclick=${() => copyText(endpoint, 'endpoint')}
                                class="shrink-0 p-2 rounded-lg border border-border hover:bg-border-light text-text-muted hover:text-text transition-colors">
                                <${copied === 'endpoint' ? Check : Copy} size=${14} />
                            </button>
                        </div>
                        <p class="text-[11px] text-text-muted mt-1">${t('ai.endpoint_help')}</p>
                    </div>

                    <div>
                        <label class=${labelClass}>${t('ai.auth_header')}</label>
                        <div class="flex items-center gap-2">
                            <code class="flex-1 text-[12px] font-mono bg-bg border border-border rounded-lg px-3 py-2 break-all">${headerExample}</code>
                            <button onclick=${() => copyText(headerExample, 'header')}
                                class="shrink-0 p-2 rounded-lg border border-border hover:bg-border-light text-text-muted hover:text-text transition-colors">
                                <${copied === 'header' ? Check : Copy} size=${14} />
                            </button>
                        </div>
                        <p class="text-[11px] text-text-muted mt-1">${t('ai.auth_header_help')}</p>
                    </div>

                    <div>
                        <label class=${labelClass}>${t('ai.url_token_label')}</label>
                        <div class="flex items-center gap-2">
                            <code class="flex-1 text-[12px] font-mono bg-bg border border-border rounded-lg px-3 py-2 break-all">${urlExample}</code>
                            <button onclick=${() => copyText(urlExample, 'urltoken')}
                                class="shrink-0 p-2 rounded-lg border border-border hover:bg-border-light text-text-muted hover:text-text transition-colors">
                                <${copied === 'urltoken' ? Check : Copy} size=${14} />
                            </button>
                        </div>
                        <p class="text-[11px] text-text-muted mt-1">${t('ai.url_token_note')}</p>
                    </div>

                    <button onclick=${openToken}
                        class="inline-flex items-center gap-2 self-start text-[12px] text-accent-dark hover:underline">
                        <${Plus} size=${12} />
                        ${t('ai.add')}
                    </button>
                </div>
            <//>

            <${SectionLayout} title=${t('ai.tokens')} description=${t('ai.tokens_desc')}>
                <div class="flex flex-col gap-3">
                    ${tokens.length === 0 && html`
                        <div class="text-center py-8 text-text-muted">
                            <${Key} size=${32} className="mx-auto mb-2 opacity-40" />
                            <p class="text-sm">${t('ai.no_tokens')}</p>
                        </div>
                    `}

                    ${tokens.map(tok => html`
                        <div key=${tok.id} class="border border-border rounded-lg p-4 bg-surface">
                            <div class="flex items-start justify-between gap-3">
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 mb-1 flex-wrap">
                                        <span class="text-[13px] font-semibold text-text truncate">${tok.name}</span>
                                        <code class="text-[11px] font-mono text-text-muted">${tok.prefix}…</code>
                                        ${tok.origin === 'bundle' && html`
                                            <span class="text-[10px] uppercase tracking-wide text-accent-dark bg-accent/10 rounded px-1.5 py-0.5">${t('ai.origin_bundle')}</span>
                                        `}
                                    </div>
                                    <div class="text-[11px] text-text-muted">
                                        ${tok.username} ·
                                        ${tok.last_used_at
                                            ? t('ai.last_used') + ' ' + formatTimestamp(tok.last_used_at)
                                            : t('ai.never_used')
                                        }
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    <button onclick=${() => setRevokeTokenId(tok.id)}
                                        class="text-text-muted hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50"
                                        title=${t('ai.revoke')}>
                                        <${Trash2} size=${14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    `)}

                    <button onclick=${openToken}
                        class="flex items-center justify-center gap-2 py-2.5 border border-dashed border-border rounded-lg text-[13px] text-text-secondary hover:text-text hover:border-text-muted transition-colors">
                        <${Plus} size=${14} />
                        ${t('ai.add')}
                    </button>
                </div>
            <//>

            <${SectionLayout} title=${t('ai.oauth_clients')} description=${t('ai.oauth_clients_desc')} last=${true}>
                <div class="flex flex-col gap-3">
                    ${clients.length === 0 && html`
                        <div class="text-center py-8 text-text-muted">
                            <${Sparkles} size=${32} className="mx-auto mb-2 opacity-40" />
                            <p class="text-sm">${t('ai.no_oauth_clients')}</p>
                        </div>
                    `}

                    ${clients.map(c => html`
                        <div key=${c.client_id} class="border border-border rounded-lg p-4 bg-surface">
                            <div class="flex items-start justify-between gap-3">
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 mb-1">
                                        <span class="text-[13px] font-semibold text-text truncate">
                                            ${c.client_name || 'Unnamed client'}
                                        </span>
                                        <code class="text-[11px] font-mono text-text-muted">${c.client_id}</code>
                                    </div>
                                    <div class="text-[11px] text-text-muted">
                                        registered ${formatTimestamp(c.registered_at)} ·
                                        ${c.last_used_at
                                            ? 'last used ' + formatTimestamp(c.last_used_at)
                                            : 'never used'
                                        }
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    <button onclick=${() => setRevokeClientId(c.client_id)}
                                        class="text-text-muted hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50"
                                        title="Revoke">
                                        <${Trash2} size=${14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    `)}
                </div>
            <//>
        </div>

        <${Modal} open=${bundleOpen} onClose=${() => setBundleOpen(false)} title=${t('ai.bundle_modal_title')}>
            <div class="flex flex-col gap-4 p-5">
                <p class="text-[12px] text-text-secondary">${t('ai.bundle_modal_desc')}</p>

                <div>
                    <label class=${labelClass}>${t('ai.name')}</label>
                    <input type="text" value=${bundleName} onInput=${e => setBundleName(e.target.value)}
                        class=${inputClass} placeholder=${t('ai.name_placeholder')} />
                    <p class="text-[11px] text-text-muted mt-1">${t('ai.name_help')}</p>
                </div>

                <div>
                    <label class=${labelClass}>${t('ai.owner')}</label>
                    <select value=${bundleUser} onChange=${e => setBundleUser(e.target.value)} class=${inputClass}>
                        ${users.map(u => html`
                            <option key=${u.email} value=${u.email}>${u.email} (${u.role})</option>
                        `)}
                    </select>
                    <p class="text-[11px] text-text-muted mt-1">${t('ai.owner_help')}</p>
                </div>

                <div class="flex justify-end gap-2 pt-2 border-t border-border-light">
                    <button type="button" onclick=${() => setBundleOpen(false)}
                        class="px-3 py-1.5 text-[12px] text-text-secondary hover:text-text rounded-btn transition-colors">
                        ${t('common.cancel')}
                    </button>
                    <button type="button" onclick=${handleDownloadBundle}
                        disabled=${bundling || !bundleName.trim() || !bundleUser}
                        class="inline-flex items-center gap-2 px-3 py-1.5 bg-accent hover:bg-accent-dark text-white rounded-btn text-[12px] font-medium disabled:opacity-50 transition-colors">
                        ${bundling
                            ? html`<${Loader} size=${12} /> ${t('ai.bundle_downloading')}`
                            : html`<${Download} size=${12} /> ${t('ai.bundle_cta_short')}`
                        }
                    </button>
                </div>
            </div>
        <//>

        <${Modal} open=${tokenOpen} onClose=${() => setTokenOpen(false)} title=${t('ai.create_title')}>
            <div class="flex flex-col gap-4 p-5">
                <div>
                    <label class=${labelClass}>${t('ai.name')}</label>
                    <input type="text" value=${tokenName} onInput=${e => setTokenName(e.target.value)}
                        onKeyDown=${e => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCreateToken();
                            }
                        }}
                        class=${inputClass} placeholder=${t('ai.name_placeholder')} />
                    <p class="text-[11px] text-text-muted mt-1">${t('ai.name_help')}</p>
                </div>

                <div>
                    <label class=${labelClass}>${t('ai.owner')}</label>
                    <select value=${tokenUser} onChange=${e => setTokenUser(e.target.value)} class=${inputClass}>
                        ${users.map(u => html`
                            <option key=${u.email} value=${u.email}>${u.email} (${u.role})</option>
                        `)}
                    </select>
                    <p class="text-[11px] text-text-muted mt-1">${t('ai.owner_help')}</p>
                </div>

                <div class="flex justify-end gap-2 pt-2 border-t border-border-light">
                    <button type="button" onclick=${() => setTokenOpen(false)}
                        class="px-3 py-1.5 text-[12px] text-text-secondary hover:text-text rounded-btn transition-colors">
                        ${t('common.cancel')}
                    </button>
                    <button type="button" onclick=${handleCreateToken}
                        disabled=${creatingToken || !tokenName.trim() || !tokenUser}
                        class="px-3 py-1.5 bg-accent hover:bg-accent-dark text-white rounded-btn text-[12px] font-medium disabled:opacity-50 transition-colors">
                        ${creatingToken ? t('ai.creating') : t('ai.create')}
                    </button>
                </div>
            </div>
        <//>

        <${Modal} open=${!!revealed} onClose=${() => setRevealed(null)} title=${t('ai.revealed_title')} maxWidth="max-w-md">
            <div class="p-5 flex flex-col gap-4">
                <p class="text-[12px] text-accent-dark font-medium">${t('ai.copy_warning')}</p>

                <div>
                    <label class=${labelClass}>${t('ai.plaintext_label')}</label>
                    <div class="flex items-center gap-2">
                        <code class="text-[12px] font-mono bg-bg border border-border rounded-lg px-3 py-2 flex-1 break-all">${revealed?.plaintext}</code>
                        <button onclick=${() => copyText(revealed.plaintext, 'reveal-plain')}
                            class="shrink-0 p-2 rounded-lg border border-border hover:bg-border-light text-text-muted hover:text-text transition-colors">
                            <${copied === 'reveal-plain' ? Check : Copy} size=${14} />
                        </button>
                    </div>
                </div>

                <div class="flex justify-end pt-2 border-t border-border-light">
                    <button onclick=${() => setRevealed(null)}
                        class="px-3 py-1.5 bg-accent hover:bg-accent-dark text-white rounded-btn text-[12px] font-medium transition-colors">
                        ${t('ai.done')}
                    </button>
                </div>
            </div>
        <//>

        <${Modal} open=${!!revokeTokenId} onClose=${() => setRevokeTokenId(null)} title=${t('ai.revoke_title')}>
            <div class="p-5">
                <p class="text-sm text-text-secondary mb-4">${t('ai.revoke_confirm')}</p>
                <div class="flex justify-end gap-2">
                    <button onclick=${() => setRevokeTokenId(null)}
                        class="px-3 py-1.5 text-[12px] text-text-secondary hover:text-text rounded-btn transition-colors">
                        ${t('common.cancel')}
                    </button>
                    <button onclick=${handleRevokeToken}
                        class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-btn text-[12px] font-medium transition-colors">
                        ${t('ai.revoke')}
                    </button>
                </div>
            </div>
        <//>

        <${Modal} open=${!!revokeClientId} onClose=${() => setRevokeClientId(null)} title="Revoke client?">
            <div class="p-5">
                <p class="text-sm text-text-secondary mb-4">
                    This will immediately disconnect the application and invalidate every access and refresh token
                    it holds. The user will need to re-authorize to reconnect.
                </p>
                <div class="flex justify-end gap-2">
                    <button onclick=${() => setRevokeClientId(null)}
                        class="px-3 py-1.5 text-[12px] text-text-secondary hover:text-text rounded-btn transition-colors">
                        ${t('common.cancel')}
                    </button>
                    <button onclick=${handleRevokeClient}
                        class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-btn text-[12px] font-medium transition-colors">
                        Revoke
                    </button>
                </div>
            </div>
        <//>
    `;
}
