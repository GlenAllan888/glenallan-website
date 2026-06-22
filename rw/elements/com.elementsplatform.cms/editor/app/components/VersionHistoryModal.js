import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { api } from '../api.js?v=20260538';
import { t } from '../i18n.js?v=20260538';
import { contentSubpath, showFlash } from '../state.js?v=20260538';
import { Modal } from './Modal.js?v=20260538';
import { History, RotateCcw } from '../icons.js?v=20260538';
import { diffLines } from '../diff.js?v=20260538';

const html = htm.bind(h);

function formatDate(ts) {
    return new Date(ts * 1000).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function relativeTime(ts) {
    const diff = Math.floor(Date.now() / 1000) - ts;
    if (diff < 60) return t('version_history.just_now');
    if (diff < 3600) return t('version_history.minutes_ago', { n: Math.floor(diff / 60) });
    if (diff < 86400) return t('version_history.hours_ago', { n: Math.floor(diff / 3600) });
    if (diff < 604800) return t('version_history.days_ago', { n: Math.floor(diff / 86400) });
    return '';
}

function humanSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

export function VersionHistoryModal({ open, onClose, folder, file, onRestore }) {
    const [versions, setVersions] = useState([]);
    const [current, setCurrent] = useState(null);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState('timeline'); // 'timeline' | 'compare'
    const [compareFrom, setCompareFrom] = useState('');
    const [compareTo, setCompareTo] = useState('');
    const [diffResult, setDiffResult] = useState(null);
    const [diffLoading, setDiffLoading] = useState(false);
    const [restoring, setRestoring] = useState(null); // timestamp being restored
    const [confirmRestore, setConfirmRestore] = useState(null); // timestamp awaiting confirmation

    useEffect(() => {
        if (open) {
            loadVersions();
            setMode('timeline');
            setDiffResult(null);
            setConfirmRestore(null);
        }
    }, [open]);

    async function loadVersions() {
        setLoading(true);
        const params = { folder, file };
        if (contentSubpath.value) params.subpath = contentSubpath.value;
        const data = await api('versions.list', { params });
        setLoading(false);
        if (data && !data._error) {
            setVersions(data.versions || []);
            setCurrent(data.current || null);
            if (data.versions?.length > 0) {
                setCompareFrom(String(data.versions[0].timestamp));
                setCompareTo('current');
            }
        }
    }

    async function fetchRaw(timestamp) {
        if (timestamp === 'current') {
            const params = { folder, file };
            if (contentSubpath.value) params.subpath = contentSubpath.value;
            const data = await api('files.read', { params });
            if (!data || data._error) return null;
            // Reconstruct raw from meta+body (approximate, good enough for diff)
            return data._raw || rebuildRaw(data);
        }
        const params = { folder, file, timestamp };
        if (contentSubpath.value) params.subpath = contentSubpath.value;
        const data = await api('versions.read', { params });
        if (!data || data._error) return null;
        return data.raw || '';
    }

    function rebuildRaw(data) {
        // Build a rough representation from parsed data for diffing
        let raw = '---\n';
        for (const [k, v] of Object.entries(data.meta || {})) {
            if (Array.isArray(v)) {
                raw += `${k}: [${v.join(', ')}]\n`;
            } else if (typeof v === 'object' && v !== null) {
                raw += `${k}:\n`;
                for (const [sk, sv] of Object.entries(v)) {
                    raw += `    ${sk}: ${sv}\n`;
                }
            } else {
                raw += `${k}: ${v}\n`;
            }
        }
        raw += '---\n\n' + (data.body || '');
        return raw;
    }

    async function handleCompare() {
        if (!compareFrom || !compareTo || compareFrom === compareTo) return;
        setDiffLoading(true);
        const [fromRaw, toRaw] = await Promise.all([
            fetchRaw(compareFrom),
            fetchRaw(compareTo),
        ]);
        setDiffLoading(false);
        if (fromRaw !== null && toRaw !== null) {
            setDiffResult(diffLines(fromRaw, toRaw));
        }
    }

    async function handleRestore(timestamp) {
        setRestoring(timestamp);
        const body = { folder, file, timestamp };
        if (contentSubpath.value) body.subpath = contentSubpath.value;
        const data = await api('versions.restore', { method: 'POST', body });
        setRestoring(null);
        setConfirmRestore(null);
        if (data && !data._error) {
            showFlash('success', t('version_history.restored'));
            onRestore();
            onClose();
        }
    }

    if (!open) return null;

    const versionOptions = [
        { value: 'current', label: t('version_history.current') },
        ...versions.map(v => ({ value: String(v.timestamp), label: formatDate(v.timestamp) })),
    ];

    return html`
        <${Modal} open=${open} onClose=${onClose} title=${t('version_history.title')} maxWidth="max-w-2xl">
            <div class="flex flex-col" style="max-height: 65vh">
                <!-- Mode tabs -->
                <div class="flex items-center gap-1 px-5 py-3 border-b border-border bg-bg/50">
                    <button
                        onclick=${() => { setMode('timeline'); setDiffResult(null); }}
                        class="px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors ${mode === 'timeline' ? 'bg-accent/10 text-accent-dark' : 'text-text-secondary hover:text-text hover:bg-bg'}"
                    >${t('version_history.timeline')}</button>
                    <button
                        onclick=${() => setMode('compare')}
                        class="px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors ${mode === 'compare' ? 'bg-accent/10 text-accent-dark' : 'text-text-secondary hover:text-text hover:bg-bg'}"
                    >${t('version_history.compare')}</button>
                </div>

                ${loading && html`
                    <div class="flex items-center justify-center py-12 text-text-secondary text-sm">
                        ${t('version_history.loading')}
                    </div>
                `}

                ${!loading && versions.length === 0 && html`
                    <div class="flex flex-col items-center justify-center py-12 px-5 text-center">
                        <div class="w-10 h-10 rounded-full bg-bg flex items-center justify-center mb-3">
                            <${History} size=${20} className="text-text-muted" />
                        </div>
                        <p class="text-sm text-text-secondary mb-1">${t('version_history.empty')}</p>
                        <p class="text-xs text-text-muted">${t('version_history.empty_desc')}</p>
                    </div>
                `}

                ${!loading && versions.length > 0 && mode === 'timeline' && html`
                    <div class="flex-1 overflow-y-auto">
                        <!-- Current version -->
                        ${current && html`
                            <div class="flex items-center gap-3 px-5 py-3 border-b border-border bg-bg/30">
                                <div class="w-2 h-2 rounded-full bg-green-500 shrink-0"></div>
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2">
                                        <span class="text-[13px] font-medium text-text">${t('version_history.current')}</span>
                                        <span class="text-[11px] text-text-muted">${humanSize(current.size)}</span>
                                    </div>
                                    <span class="text-[11px] text-text-muted">${formatDate(current.modified)}</span>
                                </div>
                            </div>
                        `}

                        <!-- Past versions -->
                        ${versions.map(v => html`
                            <div key=${v.timestamp} class="flex items-center gap-3 px-5 py-3 border-b border-border-light hover:bg-bg/50 transition-colors">
                                <div class="w-2 h-2 rounded-full bg-border shrink-0"></div>
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2">
                                        <span class="text-[13px] text-text">${formatDate(v.timestamp)}</span>
                                        <span class="text-[11px] text-text-muted">${humanSize(v.size)}</span>
                                        ${relativeTime(v.timestamp) && html`
                                            <span class="text-[11px] text-text-muted">${relativeTime(v.timestamp)}</span>
                                        `}
                                    </div>
                                </div>
                                <div class="flex items-center gap-1.5 shrink-0">
                                    ${confirmRestore === v.timestamp ? html`
                                        <span class="text-[11px] text-text-secondary mr-1">${t('version_history.restore_confirm')}</span>
                                        <button
                                            onclick=${() => handleRestore(v.timestamp)}
                                            disabled=${restoring === v.timestamp}
                                            class="px-2 py-1 text-[11px] font-medium bg-accent hover:bg-accent-dark text-white rounded-md transition-colors disabled:opacity-50"
                                        >${restoring === v.timestamp ? t('version_history.restoring') : t('version_history.confirm')}</button>
                                        <button
                                            onclick=${() => setConfirmRestore(null)}
                                            class="px-2 py-1 text-[11px] font-medium text-text-secondary hover:text-text rounded-md transition-colors"
                                        >${t('common.cancel')}</button>
                                    ` : html`
                                        <button
                                            onclick=${() => setConfirmRestore(v.timestamp)}
                                            class="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-text-secondary hover:text-text hover:bg-bg rounded-md transition-colors"
                                        >
                                            <${RotateCcw} size=${12} />
                                            ${t('version_history.restore')}
                                        </button>
                                    `}
                                </div>
                            </div>
                        `)}
                    </div>
                `}

                ${!loading && versions.length > 0 && mode === 'compare' && html`
                    <div class="flex-1 overflow-y-auto flex flex-col">
                        <!-- Version selectors -->
                        <div class="flex items-center gap-3 px-5 py-3 border-b border-border">
                            <div class="flex items-center gap-2 flex-1">
                                <label class="text-[11px] font-medium text-text-muted uppercase tracking-wider shrink-0">${t('version_history.from')}</label>
                                <select
                                    value=${compareFrom}
                                    onchange=${e => setCompareFrom(e.target.value)}
                                    class="flex-1 h-8 rounded-lg border border-border bg-surface px-2 text-[12px] text-text"
                                >
                                    ${versionOptions.map(o => html`
                                        <option key=${o.value} value=${o.value}>${o.label}</option>
                                    `)}
                                </select>
                            </div>
                            <div class="flex items-center gap-2 flex-1">
                                <label class="text-[11px] font-medium text-text-muted uppercase tracking-wider shrink-0">${t('version_history.to')}</label>
                                <select
                                    value=${compareTo}
                                    onchange=${e => setCompareTo(e.target.value)}
                                    class="flex-1 h-8 rounded-lg border border-border bg-surface px-2 text-[12px] text-text"
                                >
                                    ${versionOptions.map(o => html`
                                        <option key=${o.value} value=${o.value}>${o.label}</option>
                                    `)}
                                </select>
                            </div>
                            <button
                                onclick=${handleCompare}
                                disabled=${diffLoading || !compareFrom || !compareTo || compareFrom === compareTo}
                                class="px-3 py-1.5 text-[12px] font-medium bg-accent hover:bg-accent-dark text-white rounded-md transition-colors disabled:opacity-50 shrink-0"
                            >${diffLoading ? t('common.loading') : t('version_history.compare')}</button>
                        </div>

                        <!-- Diff output -->
                        ${diffResult && html`
                            <div class="flex-1 overflow-y-auto">
                                <pre class="text-[12px] leading-[1.6] font-mono p-0 m-0">${diffResult.map((entry, i) => {
                                    const bg = entry.type === 'add'
                                        ? 'bg-green-500/10'
                                        : entry.type === 'remove'
                                        ? 'bg-red-500/10'
                                        : '';
                                    const textColor = entry.type === 'add'
                                        ? 'text-green-700 dark:text-green-400'
                                        : entry.type === 'remove'
                                        ? 'text-red-700 dark:text-red-400'
                                        : 'text-text-secondary';
                                    const prefix = entry.type === 'add' ? '+' : entry.type === 'remove' ? '-' : ' ';
                                    return html`<div key=${i} class="px-5 ${bg} ${textColor}"><span class="select-none inline-block w-4 text-right mr-3 opacity-50">${prefix}</span>${entry.line}</div>`;
                                })}</pre>
                            </div>
                        `}

                        ${!diffResult && !diffLoading && html`
                            <div class="flex items-center justify-center py-12 text-text-muted text-[12px]">
                                ${t('version_history.compare_hint')}
                            </div>
                        `}
                    </div>
                `}
            </div>
        <//>
    `;
}
