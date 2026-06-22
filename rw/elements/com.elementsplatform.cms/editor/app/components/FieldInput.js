import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';
import { FolderOpen, Plus, Trash2, X } from '../icons.js?v=20260538';
import { t } from '../i18n.js?v=20260538';
import { ResourceBrowserModal } from './ResourceBrowserModal.js?v=20260538';
import { formatLabel } from '../utils.js?v=20260538';

const html = htm.bind(h);

export function groupFields(fieldTypes) {
    const groups = [];
    const seen = new Set();
    for (const [key, type] of Object.entries(fieldTypes)) {
        if (seen.has(key)) continue;
        seen.add(key);
        if (Array.isArray(type) && type[0] === 'object_list') {
            groups.push({ parent: key, type: 'object_list', subTypes: type[1] });
            continue;
        }
        if (key.includes('.')) {
            const parent = key.split('.')[0];
            const children = Object.entries(fieldTypes).filter(([k]) => k.startsWith(parent + '.'));
            children.forEach(([k]) => seen.add(k));
            groups.push({ parent, children });
        } else {
            groups.push({ parent: null, key, type });
        }
    }
    return groups;
}

export function ObjectListField({ fieldKey, subTypes, fm, onChange, onAddItem, onRemoveItem }) {
    const [expandedIdx, setExpandedIdx] = useState(null);
    const count = parseInt(fm[`${fieldKey}.__count`] || '0');
    const subKeys = Object.keys(subTypes);

    function toggleItem(idx) {
        setExpandedIdx(prev => prev === idx ? null : idx);
    }

    function handleAdd() {
        onAddItem(fieldKey);
        setExpandedIdx(count);
    }

    return html`
        <div class="-mx-4 px-4 pt-4 border-t border-border space-y-2">
            <div class="flex items-center justify-between">
                <span class="text-sm font-medium">${formatLabel(fieldKey)}</span>
                <button type="button" onclick=${handleAdd}
                    class="p-1 rounded text-text-muted hover:text-accent-dark transition-colors"
                    title=${t('field_input.add_item')}>
                    <${Plus} size=${14} />
                </button>
            </div>
            ${count === 0 && html`
                <p class="text-xs text-text-muted italic">${t('field_input.no_items')}</p>
            `}
            ${Array.from({ length: count }, (_, idx) => {
        const isExpanded = expandedIdx === idx;
        const summary = fm[`${fieldKey}.${idx}.${subKeys[0]}`] || '';
        const displaySummary = summary.length > 30 ? summary.slice(0, 30) + '...' : summary;
        return html`
                    <div key=${idx} class="rounded-lg border border-border bg-surface overflow-hidden">
                        <div class="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer select-none"
                            onclick=${() => toggleItem(idx)}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"
                                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                                stroke-linecap="round" stroke-linejoin="round"
                                class="text-text-muted shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}"
                                ><path d="M6 9l6 6 6-6"/></svg>
                            <span class="text-xs font-medium text-text flex-1 truncate">
                                ${displaySummary || t('field_input.item_label', { n: idx + 1 })}
                            </span>
                            <button type="button" onclick=${e => { e.stopPropagation(); onRemoveItem(fieldKey, idx); }}
                                class="p-0.5 rounded text-text-muted hover:text-red-500 transition-colors"
                                title=${t('field_input.remove_item')}>
                                <${Trash2} size=${12} />
                            </button>
                        </div>
                        ${isExpanded && html`
                            <div class="px-2.5 py-2.5 space-y-3 border-t border-border-light">
                                ${subKeys.map(sk => html`
                                    <${FieldInput}
                                        key=${`${fieldKey}.${idx}.${sk}`}
                                        fieldKey=${`${fieldKey}.${idx}.${sk}`}
                                        type=${subTypes[sk]}
                                        value=${fm[`${fieldKey}.${idx}.${sk}`] || ''}
                                        onChange=${onChange} />
                                `)}
                            </div>
                        `}
                    </div>
                `;
    })}
        </div>
    `;
}

function ListTagInput({ fieldKey, value, onChange }) {
    const [input, setInput] = useState('');
    const tags = Array.isArray(value) ? value : (typeof value === 'string' && value ? value.split(',').map(s => s.trim()).filter(Boolean) : []);

    function addTag(text) {
        const trimmed = text.trim();
        if (!trimmed || tags.includes(trimmed)) return;
        onChange(fieldKey, [...tags, trimmed]);
        setInput('');
    }

    function removeTag(idx) {
        onChange(fieldKey, tags.filter((_, i) => i !== idx));
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag(input);
        }
    }

    const label = formatLabel(fieldKey.includes('.') ? fieldKey.split('.').pop() : fieldKey);

    return html`
        <div>
            <label class="block text-sm font-medium leading-none mb-2">${label}</label>
            <div class="flex flex-wrap items-center gap-1.5 min-h-[36px]">
                ${tags.map((tag, i) => html`
                    <span key=${i} class="inline-flex items-center gap-0.5 pl-2 pr-1 py-0.5 rounded-md bg-accent/10 text-accent-dark text-[12px] font-medium">
                        ${tag}
                        <button type="button" onClick=${() => removeTag(i)}
                            class="p-0.5 rounded hover:bg-accent/20 transition-colors">
                            <${X} size=${10} />
                        </button>
                    </span>
                `)}
                <span class="inline-flex items-center gap-0.5 pl-2 pr-1 rounded-md bg-accent/10 text-[12px]">
                    <input type="text" value=${input}
                        onInput=${e => setInput(e.target.value)}
                        onKeyDown=${handleKeyDown}
                        class="p-0 shadow-none w-[72px] h-[22px] border-0 bg-transparent text-[12px] text-accent-dark placeholder:text-accent-dark focus:outline-none focus:ring-0"
                        placeholder=${t('field_input.add_item_placeholder')} />
                    <button type="button" onClick=${() => addTag(input)}
                        class="p-0.5 rounded text-accent-dark hover:text-accent-dark hover:bg-accent/10 transition-colors">
                        <${Plus} size=${10} />
                    </button>
                </span>
            </div>
        </div>
    `;
}

export function FieldInput({ fieldKey, type, value, onChange }) {
    const label = formatLabel(fieldKey.includes('.') ? fieldKey.split('.').pop() : fieldKey);

    if (Array.isArray(type) && type[0] === 'select') {
        return html`
            <div>
                <label class="block text-sm font-medium leading-none mb-2">${label}</label>
                <select value=${value} onchange=${e => onChange(fieldKey, e.target.value)}
                    class="w-full h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20">
                    ${type[1].map(opt => html`<option key=${opt} value=${opt}>${opt}</option>`)}
                </select>
            </div>
        `;
    }

    if (type === 'resource') {
        const [browseOpen, setBrowseOpen] = useState(false);
        const [previewError, setPreviewError] = useState(false);
        const displayValue = Array.isArray(value) ? value.join(', ') : (value || '');
        const showPreview = displayValue && /^(\/|https?:\/\/)/.test(displayValue) && !previewError;
        return html`
            <div>
                <label class="block text-sm font-medium leading-none mb-2">${label}</label>
                <div class="flex gap-1.5 min-w-0">
                    <input type="text" value=${displayValue} placeholder=${t('field_input.file_path')}
                        onchange=${e => { setPreviewError(false); onChange(fieldKey, e.target.value); }}
                        oninput=${e => { setPreviewError(false); onChange(fieldKey, e.target.value); }}
                        class="flex-1 min-w-0 h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20" />
                    <button type="button" onclick=${() => setBrowseOpen(true)}
                        class="shrink-0 px-2.5 h-9 rounded-lg border border-border bg-surface text-text-secondary shadow-sm shadow-black/5 hover:text-accent-dark transition-colors"
                        title=${t('field_input.browse_resources')}>
                        <${FolderOpen} size=${14} />
                    </button>
                </div>
                ${showPreview && html`
                    <img src=${displayValue} alt="Preview"
                        onError=${() => setPreviewError(true)}
                        class="mt-2 rounded border border-border object-contain bg-bg"
                        style="max-width:100%;max-height:5rem" />
                `}
                <${ResourceBrowserModal}
                    open=${browseOpen}
                    onClose=${() => setBrowseOpen(false)}
                    onSelect=${url => { setPreviewError(false); onChange(fieldKey, url); }} />
            </div>
        `;
    }

    if (type === 'list') {
        return html`<${ListTagInput} fieldKey=${fieldKey} value=${value} onChange=${onChange} />`;
    }

    const inputType = type === 'date' ? 'date' : 'text';
    const displayValue = value || '';

    return html`
        <div>
            <label class="block text-sm font-medium leading-none mb-2">${label}</label>
            <input type=${inputType} value=${displayValue}
                onchange=${e => onChange(fieldKey, e.target.value)}
                oninput=${e => onChange(fieldKey, e.target.value)}
                class="w-full h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20" />
        </div>
    `;
}
