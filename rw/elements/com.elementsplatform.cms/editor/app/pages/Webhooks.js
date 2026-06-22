import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { api } from '../api.js?v=20260538';
import { showFlash, featureEnabled } from '../state.js?v=20260538';
import { Loader, Plus, Trash2, Copy, Check, Webhook, AlertTriangle } from '../icons.js?v=20260538';
import { SectionLayout } from '../components/SectionLayout.js?v=20260538';
import { PageHeader } from '../components/PageHeader.js?v=20260538';
import { Toggle } from '../components/Toggle.js?v=20260538';
import { Modal } from '../components/Modal.js?v=20260538';
import { FeatureAccessPrompt } from '../components/FeatureAccessPrompt.js?v=20260538';
import { t } from '../i18n.js?v=20260538';

const html = htm.bind(h);

const inputClass = 'w-full h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50';
const labelClass = 'block text-sm font-medium leading-none mb-2';

function getAllEvents() {
    return [
        { key: 'file.created', label: t('webhooks.event_file_created'), description: t('webhooks.event_file_created_desc') },
        { key: 'file.updated', label: t('webhooks.event_file_updated'), description: t('webhooks.event_file_updated_desc') },
        { key: 'file.deleted', label: t('webhooks.event_file_deleted'), description: t('webhooks.event_file_deleted_desc') },
        { key: 'user.created', label: t('webhooks.event_user_created'), description: t('webhooks.event_user_created_desc') },
        { key: 'user.updated', label: t('webhooks.event_user_updated'), description: t('webhooks.event_user_updated_desc') },
        { key: 'user.deleted', label: t('webhooks.event_user_deleted'), description: t('webhooks.event_user_deleted_desc') },
    ];
}

export function Webhooks() {
    const webhooksAllowed = featureEnabled('webhooks');
    const [webhooks, setWebhooks] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [url, setUrl] = useState('');
    const [events, setEvents] = useState([]);
    const [enabled, setEnabled] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Secret reveal
    const [revealedSecret, setRevealedSecret] = useState(null);
    const [copiedId, setCopiedId] = useState(null);

    // Delete confirm
    const [deleteId, setDeleteId] = useState(null);

    // Delivery log
    const [logs, setLogs] = useState([]);
    const [clearingLog, setClearingLog] = useState(false);

    async function load() {
        if (!webhooksAllowed) {
            setLoading(false);
            return;
        }
        setLoading(true);
        const [listRes, logRes] = await Promise.all([
            api('webhooks.list'),
            api('webhooks.log', { silent: true }),
        ]);
        if (listRes && !listRes._error) {
            setWebhooks(listRes.webhooks || []);
        }
        if (logRes && !logRes._error) {
            setLogs(logRes.entries || []);
        }
        setLoading(false);
    }

    async function handleClearLog() {
        if (!webhooksAllowed) return;
        setClearingLog(true);
        const res = await api('webhooks.clear_log', { method: 'POST', body: {} });
        setClearingLog(false);
        if (res && !res._error) {
            setLogs([]);
            showFlash('success', t('webhooks.log_cleared'));
        }
    }

    useEffect(() => { load(); }, [webhooksAllowed]);

    function openCreate() {
        if (!webhooksAllowed) return;
        setEditingId(null);
        setUrl('');
        setEvents([]);
        setEnabled(true);
        setModalOpen(true);
    }

    function openEdit(wh) {
        if (!webhooksAllowed) return;
        setEditingId(wh.id);
        setUrl(wh.url);
        setEvents([...wh.events]);
        setEnabled(wh.enabled);
        setModalOpen(true);
    }

    function toggleEvent(key) {
        setEvents(prev =>
            prev.includes(key)
                ? prev.filter(e => e !== key)
                : [...prev, key]
        );
    }

    async function handleSave() {
        if (!webhooksAllowed) return;
        setSubmitting(true);

        if (editingId) {
            const res = await api('webhooks.update', {
                method: 'POST',
                body: { id: editingId, url, events, enabled },
            });
            setSubmitting(false);
            if (res && !res._error) {
                showFlash('success', t('webhooks.updated'));
                setModalOpen(false);
                load();
            }
        } else {
            const res = await api('webhooks.create', {
                method: 'POST',
                body: { url, events, enabled },
            });
            setSubmitting(false);
            if (res && !res._error) {
                showFlash('success', t('webhooks.created'));
                setRevealedSecret({ id: res.webhook.id, secret: res.webhook.secret });
                setModalOpen(false);
                load();
            }
        }
    }

    async function handleDelete() {
        if (!webhooksAllowed) return;
        const res = await api('webhooks.delete', {
            method: 'POST',
            body: { id: deleteId },
        });
        if (res && !res._error) {
            showFlash('success', t('webhooks.deleted'));
            setDeleteId(null);
            load();
        }
    }

    async function handleToggleEnabled(wh) {
        if (!webhooksAllowed) return;
        const res = await api('webhooks.update', {
            method: 'POST',
            body: { id: wh.id, enabled: !wh.enabled },
        });
        if (res && !res._error) {
            load();
        }
    }

    function copySecret(secret) {
        navigator.clipboard.writeText(secret);
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
    }

    if (loading) {
        return html`<div class="flex items-center justify-center py-20">
            <${Loader} className="text-accent-dark" />
        </div>`;
    }

    return html`
        <${PageHeader} title="${t('webhooks.title')}" subtitle="${t('webhooks.subtitle')}" />

        ${!webhooksAllowed && html`
            <${FeatureAccessPrompt} description=${t('webhooks.license_required_desc')} />
        `}

        <div class="max-w-3xl ${!webhooksAllowed ? 'opacity-50 pointer-events-none' : ''}">

            <!-- Webhook List -->
            <${SectionLayout} title="${t('webhooks.endpoints')}" description="${t('webhooks.endpoints_desc')}">
                <div class="flex flex-col gap-3">
                    ${webhooks.length === 0 && html`
                        <div class="text-center py-8 text-text-muted">
                            <${Webhook} size=${32} className="mx-auto mb-2 opacity-40" />
                            <p class="text-sm">${t('webhooks.no_webhooks')}</p>
                        </div>
                    `}

                    ${webhooks.map(wh => html`
                        <div key=${wh.id} class="border border-border rounded-lg p-4 bg-surface">
                            <div class="flex items-start justify-between gap-3">
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 mb-1">
                                        <span class="inline-flex items-center gap-1.5">
                                            <span class="w-2 h-2 rounded-full ${wh.enabled ? 'bg-green-500' : 'bg-border'}"></span>
                                            <code class="text-[13px] font-mono text-text truncate block max-w-[400px]">${wh.url}</code>
                                        </span>
                                    </div>
                                    <div class="flex flex-wrap gap-1.5 mt-2">
                                        ${wh.events.map(ev => html`
                                            <span key=${ev} class="px-2 py-0.5 text-[11px] font-medium rounded-full bg-bg text-text-secondary border border-border-light">${ev}</span>
                                        `)}
                                    </div>
                                    ${revealedSecret?.id === wh.id && html`
                                        <div class="mt-3 p-3 bg-bg rounded-lg border border-border-light">
                                            <p class="text-[11px] text-text-muted mb-1.5 font-medium">${t('webhooks.signing_secret')}</p>
                                            <div class="flex items-center gap-2">
                                                <code class="text-[12px] font-mono text-text flex-1 break-all">${revealedSecret.secret}</code>
                                                <button onclick=${() => copySecret(revealedSecret.secret)}
                                                    class="shrink-0 p-1.5 rounded hover:bg-border transition-colors text-text-muted hover:text-text">
                                                    <${copiedId ? Check : Copy} size=${14} />
                                                </button>
                                            </div>
                                        </div>
                                    `}
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    <${Toggle} checked=${wh.enabled} onChange=${() => handleToggleEnabled(wh)} />
                                    <button onclick=${() => openEdit(wh)}
                                        class="text-[12px] text-text-secondary hover:text-text transition-colors px-2 py-1 rounded hover:bg-border-light">
                                        ${t('common.edit')}
                                    </button>
                                    <button onclick=${() => setDeleteId(wh.id)}
                                        class="text-text-muted hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50">
                                        <${Trash2} size=${14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    `)}

                    <button onclick=${openCreate}
                        class="flex items-center justify-center gap-2 py-2.5 border border-dashed border-border rounded-lg text-[13px] text-text-secondary hover:text-text hover:border-text-muted transition-colors">
                        <${Plus} size=${14} />
                        ${t('webhooks.add')}
                    </button>
                </div>
            <//>

            <!-- Delivery Log -->
            <${SectionLayout} title="${t('webhooks.delivery_log')}" description="${t('webhooks.delivery_log_desc')}" last=${true}>
                <div class="flex flex-col gap-2">
                    ${logs.length === 0 && html`
                        <div class="text-center py-6 text-text-muted">
                            <${Check} size=${24} className="mx-auto mb-2 opacity-40" />
                            <p class="text-sm">${t('webhooks.no_deliveries')}</p>
                        </div>
                    `}

                    ${logs.length > 0 && html`
                        <div class="flex justify-end mb-1">
                            <button onclick=${handleClearLog}
                                disabled=${clearingLog}
                                class="text-[12px] text-text-muted hover:text-text transition-colors px-2 py-1 rounded hover:bg-border-light disabled:opacity-50">
                                ${clearingLog ? t('webhooks.clearing') : t('webhooks.clear_log')}
                            </button>
                        </div>

                        <div class="border border-border rounded-lg overflow-hidden divide-y divide-border">
                            ${logs.map((entry, i) => html`
                                <div key=${i} class="px-4 py-3 bg-surface flex items-start gap-3 text-[12px]">
                                    ${entry.status === 'success'
                                        ? html`<${Check} size=${14} className="shrink-0 mt-0.5 text-green-600" />`
                                        : html`<${AlertTriangle} size=${14} className="shrink-0 mt-0.5 text-red-500" />`
                                    }
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center gap-2 flex-wrap">
                                            <span class="text-text-muted">${entry.timestamp}</span>
                                            <span class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-bg border border-border-light text-text-secondary">${entry.event}</span>
                                            ${entry.http && html`
                                                <span class="px-1.5 py-0.5 text-[10px] font-medium rounded ${
                                                    parseInt(entry.http) >= 500 ? 'bg-red-50 text-red-700 border border-red-200' :
                                                    parseInt(entry.http) >= 400 ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                                                    parseInt(entry.http) >= 200 && parseInt(entry.http) < 300 ? 'bg-green-50 text-green-700 border border-green-200' :
                                                    'bg-bg text-text-secondary border border-border-light'
                                                }">HTTP ${entry.http}</span>
                                            `}
                                        </div>
                                        <code class="text-[11px] font-mono text-text-secondary truncate block mt-1 max-w-[400px]">${entry.url}</code>
                                        ${entry.error && html`
                                            <p class="text-[11px] text-red-600 mt-1">${entry.error}</p>
                                        `}
                                    </div>
                                </div>
                            `)}
                        </div>
                    `}
                </div>
            <//>
        </div>

        <!-- Create/Edit Modal -->
        <${Modal} open=${modalOpen} onClose=${() => setModalOpen(false)} title=${editingId ? t('webhooks.edit') : t('webhooks.add')}>
            <div class="flex flex-col gap-4 p-5">
                <div>
                    <label class="${labelClass}">${t('webhooks.endpoint_url')}</label>
                    <input
                        type="url"
                        value=${url}
                        onInput=${e => setUrl(e.target.value)}
                        class="${inputClass}"
                        placeholder="${t('webhooks.url_placeholder')}"
                    />
                    <p class="text-[11px] text-text-muted mt-1">${t('webhooks.url_help')}</p>
                </div>

                <div>
                    <label class="${labelClass}">${t('webhooks.events')}</label>
                    <div class="grid grid-cols-1 gap-2">
                        ${getAllEvents().map(ev => html`
                            <label key=${ev.key}
                                class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                    events.includes(ev.key)
                                        ? 'border-accent bg-accent-light'
                                        : 'border-border hover:border-border-light bg-surface'
                                }">
                                <input
                                    type="checkbox"
                                    checked=${events.includes(ev.key)}
                                    onChange=${() => toggleEvent(ev.key)}
                                    class="mt-0.5 rounded border-border text-accent focus:ring-accent/20"
                                />
                                <div>
                                    <div class="text-[13px] font-medium text-text">${ev.label}</div>
                                    <div class="text-[11px] text-text-muted">${ev.description}</div>
                                </div>
                            </label>
                        `)}
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <${Toggle} checked=${enabled} onChange=${setEnabled} />
                    <span class="text-[13px] text-text">${t('common.enabled')}</span>
                </div>

                <div class="flex justify-end gap-2 pt-2 border-t border-border-light">
                    <button onclick=${() => setModalOpen(false)}
                        class="px-3 py-1.5 text-[12px] text-text-secondary hover:text-text rounded-btn transition-colors">
                        ${t('common.cancel')}
                    </button>
                    <button onclick=${handleSave}
                        disabled=${submitting}
                        class="px-3 py-1.5 bg-accent hover:bg-accent-dark text-white rounded-btn text-[12px] font-medium disabled:opacity-50 transition-colors">
                        ${submitting ? t('common.saving') : editingId ? t('common.save') : t('webhooks.create')}
                    </button>
                </div>
            </div>
        <//>

        <!-- Delete Confirm Modal -->
        <${Modal} open=${!!deleteId} onClose=${() => setDeleteId(null)} title="${t('webhooks.delete_title')}">
            <div class="p-5">
            <p class="text-sm text-text-secondary mb-4">${t('webhooks.delete_confirm')}</p>
            <div class="flex justify-end gap-2">
                <button onclick=${() => setDeleteId(null)}
                    class="px-3 py-1.5 text-[12px] text-text-secondary hover:text-text rounded-btn transition-colors">
                    ${t('common.cancel')}
                </button>
                <button onclick=${handleDelete}
                    class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-btn text-[12px] font-medium transition-colors">
                    ${t('common.delete')}
                </button>
            </div>
            </div>
        <//>
    `;
}
