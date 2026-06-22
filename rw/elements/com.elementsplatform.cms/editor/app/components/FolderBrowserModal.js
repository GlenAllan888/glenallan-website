import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { api } from '../api.js?v=20260538';
import { t } from '../i18n.js?v=20260538';
import { Modal } from './Modal.js?v=20260538';
import { capitalize } from '../utils.js?v=20260538';
import { Folder, ChevronLeft, Loader } from '../icons.js?v=20260538';

const html = htm.bind(h);

export function inferFolderLabel(path) {
    const segment = path.split('/').filter(Boolean).pop() || '';
    return segment
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

export function FolderBrowserModal({ open, onClose, title, browseAction = 'browse', onSelect }) {
    const [currentPath, setCurrentPath] = useState('');
    const [currentDisplayPath, setCurrentDisplayPath] = useState('');
    const [parentPath, setParentPath] = useState(null);
    const [dirs, setDirs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [label, setLabel] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function browse(path) {
        setLoading(true);
        setError(null);
        const res = await api(browseAction, { params: { path }, silent: true });
        setLoading(false);

        if (!res || res._error) {
            setError(res?._error || t('folder_browser.error'));
            return;
        }

        setCurrentPath(res.current);
        setCurrentDisplayPath(res.display_path || res.current || '');
        setParentPath(res.parent);
        setDirs(res.dirs || []);
        setError(res.error || null);
        setLabel(inferFolderLabel(res.current));
    }

    useEffect(() => {
        if (open) {
            setCurrentPath('');
            setCurrentDisplayPath('');
            setParentPath(null);
            setDirs([]);
            setLabel('');
            setError(null);
            setSubmitting(false);
            browse('');
        }
    }, [open]);

    function handleSelect() {
        if (onSelect && currentPath) {
            setSubmitting(true);
            Promise.resolve(onSelect({ path: currentPath, displayPath: currentDisplayPath, label })).finally(() => {
                setSubmitting(false);
            });
        }
    }

    return html`
        <${Modal} open=${open} onClose=${onClose} title=${title || t('folder_browser.title')}>
            <div class="px-5 py-4">
                ${currentDisplayPath && html`
                    <div class="mb-3 px-3 py-1.5 bg-bg border border-border rounded-btn text-[13px] font-mono text-text-secondary truncate" title=${currentPath}>
                        ${currentDisplayPath}
                    </div>
                `}
                <div class="border border-border rounded-lg overflow-hidden mb-4" style="max-height:280px;overflow-y:auto">
                    ${loading && html`
                        <div class="flex items-center justify-center py-8 text-text-secondary">
                            <${Loader} size=${20} />
                        </div>
                    `}

                    ${!loading && error && html`
                        <div class="px-4 py-3 text-sm text-red-600">${error}</div>
                    `}

                    ${!loading && !error && html`
                        <div class="divide-y divide-border/50">
                            ${parentPath !== null && html`
                                <button type="button" onclick=${() => browse(parentPath)}
                                    class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg transition-colors">
                                    <${ChevronLeft} size=${16} className="text-text-secondary" />
                                    <span>${t('folder_browser.parent')}</span>
                                </button>
                            `}
                            ${dirs.length === 0 && html`
                                <div class="px-4 py-3 text-sm text-text-secondary italic">${t('folder_browser.no_subdirs')}</div>
                            `}
                            ${dirs.map(dir => html`
                                <button type="button" onclick=${() => browse(currentPath === '/' ? '/' + dir : currentPath + '/' + dir)}
                                    class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text hover:bg-bg transition-colors">
                                    <${Folder} size=${16} className="text-amber-500" />
                                    <span>${capitalize(dir)}</span>
                                </button>
                            `)}
                        </div>
                    `}
                </div>

                <div class="mb-4">
                    <label class="block text-sm font-medium leading-none mb-2">${t('folder_browser.label')}</label>
                    <input
                        type="text"
                        value=${label}
                        onInput=${e => setLabel(e.target.value)}
                        placeholder=${t('folder_browser.label_placeholder')}
                        class="w-full h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20"
                    />
                </div>

                <div class="flex items-center justify-end gap-3">
                    <button type="button" onclick=${onClose}
                        class="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text transition-colors">
                        ${t('common.cancel')}
                    </button>
                    <button type="button" onclick=${handleSelect}
                        disabled=${submitting || !currentPath || currentPath === '/' || !label.trim()}
                        class="px-4 py-2 bg-accent-dark hover:bg-accent-dark disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                        ${submitting ? t('folder_browser.adding') : t('folder_browser.select')}
                    </button>
                </div>
            </div>
        <//>
    `;
}
