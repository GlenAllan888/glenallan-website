import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { api } from '../../api.js?v=20260538';
import { contentSubpath, showFlash, isLicensed, isOwner } from '../../state.js?v=20260538';
import { goToPurchase } from '../../license-actions.js?v=20260538';
import { Plus, Trash2, Loader, Shield, ExternalLink, X, GripVertical, RotateCcw } from '../../icons.js?v=20260538';
import { SectionLayout } from '../../components/SectionLayout.js?v=20260538';
import { t } from '../../i18n.js?v=20260538';

const html = htm.bind(h);

const FIELD_TYPES = ['text', 'date', 'list', 'select', 'resource', 'object_list'];
const SUB_FIELD_TYPES = ['text', 'date', 'list', 'resource'];

const inputClass = 'w-full h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50';
const labelClass = 'block text-sm font-medium leading-none mb-2';

function parseFieldType(ft) {
    if (Array.isArray(ft)) {
        if (ft[0] === 'object_list') {
            const subTypes = ft[1] || {};
            const subFields = Object.entries(subTypes).map(([name, type]) => ({ name, type }));
            return { type: ft[0], options: '', subFields };
        }
        return { type: ft[0], options: (ft[1] || []).join(', '), subFields: [] };
    }
    return { type: ft, options: '', subFields: [] };
}

function fieldsFromSchema(field_types, field_defaults) {
    return Object.entries(field_types || {}).map(([name, val]) => {
        const { type, options, subFields } = parseFieldType(val);
        const def = (field_defaults || {})[name] || '';
        return { name, type, options, default: def, subFields };
    });
}

function parseOptions(str) {
    return (str || '').split(',').map(s => s.trim()).filter(Boolean);
}

function OptionsTagInput({ value, onChange }) {
    const [input, setInput] = useState('');
    const options = parseOptions(value);

    function addOption(text) {
        const trimmed = text.trim();
        if (!trimmed || options.includes(trimmed)) return;
        onChange([...options, trimmed].join(', '));
        setInput('');
    }

    function removeOption(idx) {
        onChange(options.filter((_, i) => i !== idx).join(', '));
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addOption(input);
        }
    }

    return html`
        <div class="flex-1 min-w-0">
            <label class="${labelClass}">${t('folder_settings.field_options')}</label>
            <div class="flex flex-wrap items-center gap-1.5 min-h-[32px]">
                ${options.map((opt, i) => html`
                    <span key=${i} class="inline-flex items-center gap-0.5 pl-2 pr-1 py-0.5 rounded-md bg-accent/10 text-accent-dark text-[12px] font-medium">
                        ${opt}
                        <button
                            type="button"
                            onClick=${() => removeOption(i)}
                            class="p-0.5 rounded hover:bg-accent/20 transition-colors"
                        >
                            <${X} size=${10} />
                        </button>
                    </span>
                `)}
                <span class="inline-flex items-center gap-0.5 pl-2 pr-1 py-0.5 rounded-md border border-dashed border-text-muted/30 text-[12px] transition-colors focus-within:border-accent/40">
                    <input
                        type="text"
                        value=${input}
                        onInput=${e => setInput(e.target.value)}
                        onKeyDown=${handleKeyDown}
                        class="w-[80px] border-0 p-0 bg-transparent text-[12px] text-text-muted placeholder:text-text-muted/40 outline-none focus:outline-none focus:ring-0 focus:shadow-none"
                        placeholder=${t('folder_settings.field_options_placeholder')}
                    />
                    <button
                        type="button"
                        onClick=${() => addOption(input)}
                        class="p-0.5 rounded text-text-muted/40 hover:text-accent-dark hover:bg-accent/10 transition-colors"
                    >
                        <${Plus} size=${10} />
                    </button>
                </span>
            </div>
        </div>
    `;
}

export function FieldsTab({ folder }) {
    const [data, setData] = useState(null);
    const [fields, setFields] = useState([]);
    const [overrideMode, setOverrideMode] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [dragIdx, setDragIdx] = useState(null);
    const [dragOverIdx, setDragOverIdx] = useState(null);

    const subpath = contentSubpath.value;
    const isSubfolder = subpath !== '';

    async function load() {
        setLoading(true);
        const params = { folder };
        if (subpath) params.subpath = subpath;
        const res = await api('folders.settings', { params });
        if (res && !res._error) {
            setData(res);
            const own = res.fields?.own;
            const effective = res.fields?.effective || { field_types: {}, field_defaults: {} };
            const isOwn = own !== null && own !== undefined;
            setOverrideMode(!isSubfolder || isOwn);
            const seed = isOwn ? own : effective;
            setFields(fieldsFromSchema(seed.field_types, seed.field_defaults));
        }
        setLoading(false);
    }

    useEffect(() => { load(); }, [folder, subpath]);

    function handlePurchase() {
        goToPurchase();
    }

    function updateField(idx, key, value) {
        setFields(prev => prev.map((f, i) => {
            if (i !== idx) return f;
            const updated = { ...f, [key]: value };
            if (key === 'type' && value === 'object_list' && (!f.subFields || f.subFields.length === 0)) {
                updated.subFields = [{ name: '', type: 'text' }];
            }
            return updated;
        }));
    }

    function addField() {
        setFields(prev => [...prev, { name: '', type: 'text', options: '', default: '', subFields: [] }]);
    }

    function removeField(idx) {
        setFields(prev => prev.filter((_, i) => i !== idx));
    }

    function moveField(fromIdx, toIdx) {
        setFields(prev => {
            const next = [...prev];
            const [moved] = next.splice(fromIdx, 1);
            next.splice(toIdx, 0, moved);
            return next;
        });
    }

    function handleDragStart(e, idx) {
        setDragIdx(idx);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', idx);
    }

    function handleDragOver(e, idx) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverIdx !== idx) setDragOverIdx(idx);
    }

    function handleDrop(e, idx) {
        e.preventDefault();
        if (dragIdx !== null && dragIdx !== idx) {
            moveField(dragIdx, idx);
        }
        setDragIdx(null);
        setDragOverIdx(null);
    }

    function handleDragEnd() {
        setDragIdx(null);
        setDragOverIdx(null);
    }

    function updateSubField(fieldIdx, subIdx, key, value) {
        setFields(prev => prev.map((f, i) => {
            if (i !== fieldIdx) return f;
            const subFields = f.subFields.map((sf, si) => si === subIdx ? { ...sf, [key]: value } : sf);
            return { ...f, subFields };
        }));
    }

    function addSubField(fieldIdx) {
        setFields(prev => prev.map((f, i) => {
            if (i !== fieldIdx) return f;
            return { ...f, subFields: [...(f.subFields || []), { name: '', type: 'text' }] };
        }));
    }

    function removeSubField(fieldIdx, subIdx) {
        setFields(prev => prev.map((f, i) => {
            if (i !== fieldIdx) return f;
            return { ...f, subFields: f.subFields.filter((_, si) => si !== subIdx) };
        }));
    }

    function startCustomize() {
        setOverrideMode(true);
    }

    async function handleRevertToParent() {
        if (!confirm(t('fields_tab.revert_confirm'))) return;
        setSubmitting(true);
        const res = await api('folders.updateFields', {
            method: 'POST',
            body: { folder, subpath, fields: [] },
        });
        setSubmitting(false);
        if (res && !res._error) {
            showFlash('success', t('fields_tab.reverted'));
            load();
        }
    }

    async function handleSave(e) {
        if (e) e.preventDefault();
        setSubmitting(true);
        const body = {
            folder,
            fields: fields.filter(f => f.name.trim()).map(f => ({
                ...f,
                subFields: f.type === 'object_list' ? (f.subFields || []).filter(sf => sf.name.trim()) : undefined,
            })),
        };
        if (subpath) body.subpath = subpath;
        const res = await api('folders.updateFields', { method: 'POST', body });
        setSubmitting(false);
        if (res && !res._error) {
            showFlash('success', t('folder_settings.saved'));
            load();
        }
    }

    async function handleRedetect() {
        if (!confirm(t('folder_settings.redetect_confirm'))) return;
        setSubmitting(true);
        const body = { folder };
        if (subpath) body.subpath = subpath;
        const res = await api('folders.redetect', { method: 'POST', body });
        setSubmitting(false);
        if (res && !res._error) {
            showFlash('success', t('folder_settings.redetected'));
            load();
        }
    }

    if (loading) {
        return html`<div class="flex items-center justify-center py-20">
            <${Loader} className="text-accent-dark" />
        </div>`;
    }

    if (!data) {
        return html`<div class="text-center py-20 text-text-secondary">${t('folder_settings.failed_load')}</div>`;
    }

    const own = data.fields?.own;
    const inheritedFrom = data.fields?.inherited_from || '';
    const isCustom = own !== null && own !== undefined;
    const showInheritingBanner = isSubfolder && !isCustom;
    const showCustomBanner = isSubfolder && isCustom;
    const inheritedLabel = inheritedFrom === '' ? t('fields_tab.parent_collection') : inheritedFrom;
    const editorEnabled = isLicensed.value && (!isSubfolder || overrideMode);

    return html`
        <div>
            ${!isLicensed.value && html`
                <div class="rounded-[10px] border border-accent-light bg-accent-light p-5 text-center mb-5">
                    <div class="flex justify-center mb-2.5">
                        <div class="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                            <${Shield} size=${20} className="text-accent-dark" />
                        </div>
                    </div>
                    <h2 class="text-[14px] font-semibold text-accent-dark mb-1">${t('common.license_required')}</h2>
                    <p class="text-[12px] text-accent-dark mb-3">${t('folder_settings.fields_license_desc')}</p>
                    ${isOwner.value && html`
                        <button
                            onclick=${handlePurchase}
                            class="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-accent-dark hover:bg-accent-dark text-white text-[12px] font-medium rounded-btn transition-colors"
                        >
                            <${ExternalLink} size=${13} />
                            ${t('common.purchase_license')}
                        </button>
                    `}
                </div>
            `}

            ${showInheritingBanner && html`
                <div class="rounded-[10px] border border-border bg-bg p-4 mb-5 flex items-center justify-between gap-3">
                    <div>
                        <h3 class="text-[13px] font-semibold text-text mb-0.5">${t('fields_tab.inheriting_title')}</h3>
                        <p class="text-[12px] text-text-secondary">${t('fields_tab.inheriting_desc', { source: inheritedLabel })}</p>
                    </div>
                    ${isLicensed.value && html`
                        <button
                            type="button"
                            onClick=${startCustomize}
                            class="shrink-0 px-3 py-1.5 bg-accent hover:bg-accent-dark text-white rounded-btn text-[12px] font-medium transition-colors"
                        >
                            ${t('fields_tab.customize')}
                        </button>
                    `}
                </div>
            `}

            ${showCustomBanner && html`
                <div class="rounded-[10px] border border-accent-light bg-accent-light p-4 mb-5 flex items-center justify-between gap-3">
                    <div>
                        <h3 class="text-[13px] font-semibold text-accent-dark mb-0.5">${t('fields_tab.custom_title')}</h3>
                        <p class="text-[12px] text-accent-dark">${t('fields_tab.custom_desc')}</p>
                    </div>
                    <button
                        type="button"
                        onClick=${handleRevertToParent}
                        disabled=${submitting}
                        class="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border hover:bg-black/5 text-text rounded-btn text-[12px] font-medium transition-colors disabled:opacity-50"
                    >
                        <${RotateCcw} size=${13} />
                        ${t('fields_tab.revert')}
                    </button>
                </div>
            `}

            <${SectionLayout} title=${t('folder_settings.fields')} description=${t('folder_settings.fields_desc')} last=${true}>
                <div class="${!editorEnabled ? 'opacity-50 pointer-events-none' : ''}">
                    <div class="space-y-3">
                        ${fields.map((f, idx) => html`
                            <div key=${idx}
                                draggable=${editorEnabled}
                                onDragStart=${e => handleDragStart(e, idx)}
                                onDragOver=${e => handleDragOver(e, idx)}
                                onDrop=${e => handleDrop(e, idx)}
                                onDragEnd=${handleDragEnd}
                                class=${`relative p-3 border rounded-[8px] transition-colors ${
                                    dragIdx === idx
                                        ? 'opacity-40 border-accent bg-accent/5'
                                        : dragOverIdx === idx
                                            ? 'border-accent border-dashed bg-accent/5'
                                            : 'border-border bg-bg'
                                }`}>
                                <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-start sm:gap-2">
                                    <div class="hidden sm:flex items-center pt-5 cursor-grab active:cursor-grabbing select-none">
                                        <${GripVertical} size=${16} className="text-text-muted/50 hover:text-text-secondary" />
                                    </div>
                                    <div class="col-span-1 sm:flex-1 sm:min-w-0">
                                        <label class="${labelClass}">${t('folder_settings.field_name')}</label>
                                        <input
                                            type="text"
                                            value=${f.name}
                                            onInput=${e => updateField(idx, 'name', e.target.value)}
                                            class="${inputClass}"
                                            placeholder=${t('folder_settings.field_name_placeholder')}
                                        />
                                    </div>
                                    <div class="col-span-1 sm:w-28">
                                        <label class="${labelClass}">${t('folder_settings.field_type')}</label>
                                        <select
                                            value=${f.type}
                                            onChange=${e => updateField(idx, 'type', e.target.value)}
                                            class="${inputClass}"
                                        >
                                            ${FIELD_TYPES.map(ft => html`<option value=${ft}>${ft}</option>`)}
                                        </select>
                                    </div>
                                    ${f.type === 'select' && html`
                                        <div class="col-span-2 sm:contents">
                                            <${OptionsTagInput}
                                                value=${f.options}
                                                onChange=${v => updateField(idx, 'options', v)}
                                            />
                                        </div>
                                    `}
                                    ${f.type !== 'object_list' && html`
                                        <div class="col-span-2 sm:w-32">
                                            <label class="${labelClass}">${t('folder_settings.field_default')}</label>
                                            <input
                                                type="text"
                                                value=${f.default}
                                                onInput=${e => updateField(idx, 'default', e.target.value)}
                                                class="${inputClass}"
                                            />
                                        </div>
                                    `}
                                    <div class="absolute right-3 top-3 sm:static sm:pt-5">
                                        <button
                                            type="button"
                                            onClick=${() => removeField(idx)}
                                            class="p-1.5 text-text-secondary hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                                            title="Remove field"
                                        >
                                            <${Trash2} size=${15} />
                                        </button>
                                    </div>
                                </div>
                                ${f.type === 'object_list' && html`
                                    <div class="mt-2 pt-2 border-t border-border">
                                        <label class="${labelClass}">${t('folder_settings.field_properties')}</label>
                                        <div class="space-y-1.5">
                                            ${(f.subFields || []).map((sf, si) => html`
                                                <div key=${si} class="flex items-center gap-2">
                                                    <div class="flex-1 min-w-0">
                                                        <input
                                                            type="text"
                                                            value=${sf.name}
                                                            onInput=${e => updateSubField(idx, si, 'name', e.target.value)}
                                                            class="${inputClass}"
                                                            placeholder=${t('folder_settings.field_property_placeholder')}
                                                        />
                                                    </div>
                                                    <div class="w-28 shrink-0">
                                                        <select
                                                            value=${sf.type}
                                                            onChange=${e => updateSubField(idx, si, 'type', e.target.value)}
                                                            class="${inputClass}"
                                                        >
                                                            ${SUB_FIELD_TYPES.map(ft => html`<option value=${ft}>${ft}</option>`)}
                                                        </select>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick=${() => removeSubField(idx, si)}
                                                        class="p-1 text-text-secondary hover:text-red-600 rounded-md hover:bg-red-50 transition-colors shrink-0"
                                                        title="Remove property"
                                                    >
                                                        <${Trash2} size=${13} />
                                                    </button>
                                                </div>
                                            `)}
                                        </div>
                                        <button
                                            type="button"
                                            onClick=${() => addSubField(idx)}
                                            class="mt-1.5 inline-flex items-center gap-1 text-[12px] text-accent-dark hover:text-accent-dark font-medium"
                                        >
                                            <${Plus} size=${13} /> ${t('folder_settings.add_property')}
                                        </button>
                                    </div>
                                `}
                            </div>
                        `)}
                    </div>
                    <button
                        type="button"
                        onClick=${addField}
                        class="mt-3 inline-flex items-center gap-1 text-[13px] text-accent-dark hover:text-accent-dark font-medium"
                    >
                        <${Plus} size=${15} /> ${t('folder_settings.add_field')}
                    </button>
                </div>

                ${editorEnabled && html`
                    <div class="pt-4 mt-4 border-t border-border flex items-center gap-2">
                        <button
                            type="button"
                            onClick=${handleSave}
                            disabled=${submitting}
                            class="px-3 py-1.5 bg-accent hover:bg-accent-dark text-white rounded-btn text-[12px] font-medium disabled:opacity-50 transition-colors"
                        >
                            ${submitting ? t('common.saving') : t('common.save')}
                        </button>
                        <button
                            type="button"
                            onClick=${handleRedetect}
                            disabled=${submitting}
                            class="px-3.5 py-1.5 bg-bg hover:bg-border/30 disabled:opacity-50 text-text text-[12px] font-medium rounded-btn transition-colors border border-border"
                        >
                            ${t('folder_settings.redetect')}
                        </button>
                    </div>
                `}
            <//>
        </div>
    `;
}
