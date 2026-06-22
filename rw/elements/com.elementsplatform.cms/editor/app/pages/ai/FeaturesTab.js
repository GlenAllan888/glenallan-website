import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { api } from '../../api.js?v=20260538';
import { showFlash, aiSettings } from '../../state.js?v=20260538';
import { Loader, Sparkles, AlertTriangle } from '../../icons.js?v=20260538';
import { SectionLayout } from '../../components/SectionLayout.js?v=20260538';
import { t } from '../../i18n.js?v=20260538';

const html = htm.bind(h);

function Toggle({ checked, onChange, disabled }) {
    return html`
        <button type="button"
            role="switch"
            aria-checked=${checked}
            disabled=${disabled}
            onclick=${() => onChange(!checked)}
            class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${checked ? 'bg-accent-dark' : 'bg-border'}">
            <span class="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}" />
        </button>
    `;
}

const SITE_INSTRUCTIONS_MAX = 2000;

export function FeaturesTab() {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [instructions, setInstructions] = useState('');

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

    useEffect(() => {
        if (settings) setInstructions(settings.site_instructions ?? '');
    }, [settings]);

    function saveInstructions() {
        const next = instructions.slice(0, SITE_INSTRUCTIONS_MAX);
        if (next === (settings?.site_instructions ?? '')) return;
        patchSettings({ site_instructions: next });
    }

    async function patchSettings(patch) {
        setSaving(true);
        const res = await api('ai.settings.save', { method: 'POST', body: patch });
        setSaving(false);
        if (res && !res._error) {
            setSettings(res);
            aiSettings.value = res;
            showFlash('success', t('ai.features.saved'));
        }
    }

    if (loading || !settings) {
        return html`<div class="flex items-center justify-center py-20">
            <${Loader} className="text-accent-dark" />
        </div>`;
    }

    const masterEnabled = !!settings.master_enabled;
    const writingEnabled = !!settings.features?.writing_assistant?.enabled;
    const anyProviderHasKey = (settings.providers || []).some(p => p.has_key);

    return html`
        <div class="max-w-3xl">
            ${!anyProviderHasKey && html`
                <div class="mb-5 flex items-start gap-3 p-3 border border-amber-300/70 bg-amber-50 text-amber-900 rounded-lg">
                    <${AlertTriangle} size=${16} className="shrink-0 mt-0.5" />
                    <div class="text-[12px] leading-relaxed">${t('ai.features.no_key_warning')}</div>
                </div>
            `}

            <${SectionLayout} title="${t('ai.features.master_title')}" description="${t('ai.features.master_desc')}">
                <div class="flex items-center justify-between border border-border rounded-lg p-4 bg-surface">
                    <div class="flex-1 min-w-0 pr-4">
                        <div class="text-[13px] font-semibold text-text">${t('ai.features.master_label')}</div>
                        <div class="text-[12px] text-text-muted mt-0.5">${t('ai.features.master_help')}</div>
                    </div>
                    <${Toggle} checked=${masterEnabled} disabled=${saving}
                        onChange=${v => patchSettings({ master_enabled: v })} />
                </div>
            <//>

            <${SectionLayout} title="${t('ai.features.writing_title')}" description="${t('ai.features.writing_desc')}">
                <div class="flex items-center justify-between border border-border rounded-lg p-4 bg-surface ${!masterEnabled ? 'opacity-50' : ''}">
                    <div class="flex items-center gap-3 flex-1 min-w-0 pr-4">
                        <div class="shrink-0 w-8 h-8 rounded-lg bg-accent/10 text-accent-dark flex items-center justify-center">
                            <${Sparkles} size=${16} />
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-[13px] font-semibold text-text">${t('ai.features.writing_label')}</div>
                            <div class="text-[12px] text-text-muted mt-0.5">${t('ai.features.writing_help')}</div>
                        </div>
                    </div>
                    <${Toggle}
                        checked=${writingEnabled}
                        disabled=${saving || !masterEnabled}
                        onChange=${v => patchSettings({ features: { writing_assistant: { enabled: v } } })} />
                </div>
            <//>

            <${SectionLayout} title="${t('ai.features.instructions_title')}" description="${t('ai.features.instructions_desc')}" last=${true}>
                <div class="border border-border rounded-lg bg-surface ${!masterEnabled ? 'opacity-50' : ''}">
                    <textarea
                        value=${instructions}
                        onInput=${e => setInstructions(e.target.value.slice(0, SITE_INSTRUCTIONS_MAX))}
                        onBlur=${saveInstructions}
                        disabled=${saving || !masterEnabled}
                        placeholder="${t('ai.features.instructions_placeholder')}"
                        rows=${6}
                        maxlength=${SITE_INSTRUCTIONS_MAX}
                        class="w-full text-[13px] leading-relaxed bg-transparent border-0 px-3 py-2.5 text-text placeholder:text-text-muted focus:outline-none resize-y rounded-lg" />
                    <div class="flex items-center justify-end px-3 py-1.5 border-t border-border-light text-[11px] text-text-muted tabular-nums">
                        ${t('ai.features.instructions_counter', { count: instructions.length, max: SITE_INSTRUCTIONS_MAX })}
                    </div>
                </div>
            <//>
        </div>
    `;
}
