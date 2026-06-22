import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { api } from '../../api.js?v=20260538';
import { showFlash, aiSettings } from '../../state.js?v=20260538';
import { Loader, Key, Trash2, Check, AlertTriangle } from '../../icons.js?v=20260538';
import { SectionLayout } from '../../components/SectionLayout.js?v=20260538';
import { t } from '../../i18n.js?v=20260538';

const html = htm.bind(h);

const inputClass = 'w-full h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50';
const labelClass = 'block text-sm font-medium leading-none mb-2';

export function ProvidersTab() {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [keyInputs, setKeyInputs] = useState({});
    const [savingProvider, setSavingProvider] = useState(null);

    async function load() {
        setLoading(true);
        const res = await api('ai.settings.get');
        if (res && !res._error) {
            setSettings(res);
            aiSettings.value = res;
        }
        setLoading(false);
    }

    useEffect(() => { load(); }, []);

    async function saveKey(providerId) {
        const key = (keyInputs[providerId] || '').trim();
        if (!key) return;
        setSavingProvider(providerId);
        const res = await api('ai.providers.setKey', {
            method: 'POST',
            body: { provider: providerId, key },
        });
        setSavingProvider(null);
        if (res && !res._error) {
            setSettings(res);
            setKeyInputs(prev => ({ ...prev, [providerId]: '' }));
            showFlash('success', t('ai.providers.key_saved'));
        }
    }

    async function clearKey(providerId) {
        const res = await api('ai.providers.clearKey', {
            method: 'POST',
            body: { provider: providerId },
        });
        if (res && !res._error) {
            setSettings(res);
            aiSettings.value = res;
            showFlash('success', t('ai.providers.key_cleared'));
        }
    }

    async function updateDefault(patch) {
        const defaults = { text: { ...settings.defaults.text, ...patch } };
        const res = await api('ai.settings.save', {
            method: 'POST',
            body: { defaults },
        });
        if (res && !res._error) {
            setSettings(res);
            aiSettings.value = res;
            showFlash('success', t('ai.providers.default_saved'));
        }
    }

    if (loading || !settings) {
        return html`<div class="flex items-center justify-center py-20">
            <${Loader} className="text-accent-dark" />
        </div>`;
    }

    const providers = settings.providers || [];
    const textProvider = settings.defaults?.text?.provider;
    const textModel = settings.defaults?.text?.model;
    const providerModels = providers.find(p => p.id === textProvider)?.models || [];

    return html`
        <div class="max-w-3xl">
            ${!settings.libsodium_available && html`
                <div class="mb-5 flex items-start gap-3 p-3 border border-amber-300/70 bg-amber-50 text-amber-900 rounded-lg">
                    <${AlertTriangle} size=${16} className="shrink-0 mt-0.5" />
                    <div class="text-[12px] leading-relaxed">
                        <div class="font-semibold mb-1">${t('ai.providers.no_sodium_title')}</div>
                        <div>${t('ai.providers.no_sodium_desc')}</div>
                    </div>
                </div>
            `}

            <${SectionLayout} title="${t('ai.providers.section_keys')}" description="${t('ai.providers.section_keys_desc')}">
                <div class="flex flex-col gap-4">
                    ${providers.map(p => html`
                        <div key=${p.id} class="border border-border rounded-lg p-4 bg-surface">
                            <div class="flex items-center justify-between mb-3">
                                <div class="flex items-center gap-2">
                                    <${Key} size=${14} className="text-text-muted" />
                                    <span class="text-[13px] font-semibold text-text">${p.label}</span>
                                </div>
                                ${p.has_key && html`
                                    <div class="flex items-center gap-2">
                                        <code class="text-[11px] font-mono text-text-muted">•••• ${p.key_last4}</code>
                                        <button onclick=${() => clearKey(p.id)}
                                            class="text-text-muted hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50"
                                            title="${t('ai.providers.clear_key')}">
                                            <${Trash2} size=${14} />
                                        </button>
                                    </div>
                                `}
                            </div>

                            ${!p.has_key && html`
                                <div class="flex items-center gap-2">
                                    <input type="password"
                                        value=${keyInputs[p.id] || ''}
                                        onInput=${e => setKeyInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                                        placeholder="${p.key_prefix_hint}…"
                                        class="${inputClass}" />
                                    <button onclick=${() => saveKey(p.id)}
                                        disabled=${savingProvider === p.id || !(keyInputs[p.id] || '').trim()}
                                        class="shrink-0 px-3 h-9 bg-accent hover:bg-accent-dark disabled:opacity-50 text-white rounded-lg text-[12px] font-medium transition-colors inline-flex items-center gap-1.5">
                                        ${savingProvider === p.id ? html`<${Loader} size=${12} />` : html`<${Check} size=${12} />`}
                                        ${savingProvider === p.id ? t('ai.providers.saving') : t('ai.providers.save_key')}
                                    </button>
                                </div>
                            `}

                            ${p.has_key && html`
                                <p class="text-[11px] text-text-muted mt-2">${t('ai.providers.key_stored_note')}</p>
                            `}
                        </div>
                    `)}
                </div>
            <//>

            <${SectionLayout} title="${t('ai.providers.section_default')}" description="${t('ai.providers.section_default_desc')}" last=${true}>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="${labelClass}">${t('ai.providers.default_provider')}</label>
                        <select value=${textProvider}
                            onChange=${e => {
                                const next = providers.find(p => p.id === e.target.value);
                                updateDefault({ provider: e.target.value, model: next?.default_model });
                            }}
                            class="${inputClass}">
                            ${providers.map(p => html`
                                <option key=${p.id} value=${p.id}>${p.label}</option>
                            `)}
                        </select>
                    </div>
                    <div>
                        <label class="${labelClass}">${t('ai.providers.default_model')}</label>
                        <select value=${textModel}
                            onChange=${e => updateDefault({ model: e.target.value })}
                            class="${inputClass}">
                            ${providerModels.map(m => html`
                                <option key=${m.id} value=${m.id}>${m.label}</option>
                            `)}
                        </select>
                    </div>
                </div>
                <p class="text-[11px] text-text-muted mt-2">${t('ai.providers.default_help')}</p>
            <//>
        </div>
    `;
}
