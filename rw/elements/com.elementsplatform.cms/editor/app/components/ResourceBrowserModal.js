import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import htm from 'htm';
import { api } from '../api.js?v=20260538';
import { t } from '../i18n.js?v=20260538';
import { config, showFlash } from '../state.js?v=20260538';
import { Modal } from './Modal.js?v=20260538';
import { Image, FileText, Loader, Folder, ChevronLeft, Upload, Plus } from '../icons.js?v=20260538';

const html = htm.bind(h);

export function ResourceBrowserModal({ open, onClose, onSelect }) {
    const [folderIndex, setFolderIndex] = useState(0);
    const [subpath, setSubpath] = useState('');
    const [files, setFiles] = useState([]);
    const [dirs, setDirs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [dragging, setDragging] = useState(false);
    const fileInput = useRef(null);

    const resourceFolders = config.value?.resource_folders || [];

    useEffect(() => {
        if (!open) return;
        setSelected(null);
        setFiles([]);
        setDirs([]);
        setFolderIndex(0);
        setSubpath('');
        setUploading(false);
        setDragging(false);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        loadFiles(folderIndex, subpath);
    }, [open, folderIndex, subpath]);

    async function loadFiles(idx, sp) {
        setLoading(true);
        setSelected(null);
        const params = { folder: idx };
        if (sp) params.subpath = sp;
        const res = await api('resources.list', { params });
        if (res && !res._error) {
            setFiles(res.files || []);
            setDirs(res.dirs || []);
        } else {
            setFiles([]);
            setDirs([]);
        }
        setLoading(false);
    }

    function handleFolderChange(idx) {
        setFolderIndex(idx);
        setSubpath('');
    }

    function navigateInto(dirName) {
        setSubpath(subpath ? subpath + '/' + dirName : dirName);
    }

    function navigateUp() {
        const parts = subpath.split('/');
        parts.pop();
        setSubpath(parts.join('/'));
    }

    function handleConfirm() {
        if (selected) {
            onSelect(selected.url);
            onClose();
        }
    }

    async function uploadFiles(files) {
        if (!files || !files.length) return;
        setUploading(true);
        let ok = 0, failed = 0;
        for (const file of files) {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('folder', folderIndex);
            if (subpath) fd.append('subpath', subpath);
            const res = await api('resources.upload', { method: 'POST', body: fd });
            if (res && !res._error) ok++; else failed++;
        }
        setUploading(false);
        loadFiles(folderIndex, subpath);
        if (ok > 0 && failed === 0) {
            showFlash('success', ok === 1 ? t('resources.uploaded') : t('resources.uploaded_count', { count: ok }));
        } else if (ok > 0 && failed > 0) {
            showFlash('error', t('resources.upload_partial', { ok, failed }));
        }
    }

    function handleFileSelect(e) {
        if (e.target.files.length) uploadFiles(e.target.files);
        e.target.value = '';
    }

    function handleDragOver(e) {
        e.preventDefault();
        setDragging(true);
    }

    function handleDragLeave(e) {
        e.preventDefault();
        setDragging(false);
    }

    function handleDrop(e) {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
    }

    return html`
        <${Modal} open=${open} onClose=${onClose} title=${t('resource_browser.title')} maxWidth="max-w-3xl">
            <div class="px-5 py-4">
                ${resourceFolders.length > 1 && html`
                    <div class="flex gap-1 mb-4 overflow-x-auto">
                        ${resourceFolders.map(uf => html`
                            <button type="button" key=${uf.index}
                                onclick=${() => handleFolderChange(uf.index)}
                                class="px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                                    folderIndex === uf.index
                                        ? 'bg-accent-light text-accent-dark'
                                        : 'text-text-secondary hover:bg-bg'
                                }">
                                ${uf.label}
                            </button>
                        `)}
                    </div>
                `}

                <div class="flex items-center gap-2 mb-3">
                    ${subpath ? html`
                        <button type="button" onclick=${navigateUp}
                            class="flex items-center gap-1 text-sm text-text-secondary hover:text-text transition-colors">
                            <${ChevronLeft} size=${16} />
                            <span>${subpath}</span>
                        </button>
                    ` : html`<div></div>`}
                    <button type="button"
                        onclick=${() => fileInput.current?.click()}
                        disabled=${uploading}
                        class="ml-auto inline-flex items-center gap-1.5 h-8 px-3 bg-accent text-white hover:bg-accent/90 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                        <${Plus} size=${14} />
                        ${uploading ? t('resources.uploading') : t('resources.upload')}
                    </button>
                    <input ref=${fileInput} type="file" multiple class="hidden" onChange=${handleFileSelect} />
                </div>

                <div class="relative rounded-lg overflow-hidden"
                    style="min-height:200px;max-height:60vh;overflow-y:auto"
                    onDragOver=${handleDragOver}
                    onDragLeave=${handleDragLeave}
                    onDrop=${handleDrop}>
                    ${dragging && html`
                        <div class="absolute inset-0 bg-accent-light/80 border-2 border-dashed border-accent rounded-lg flex items-center justify-center z-10 pointer-events-none">
                            <div class="text-center">
                                <${Upload} size=${32} className="mx-auto mb-2 text-accent-dark" />
                                <p class="text-sm font-medium text-accent-dark">${t('resources.drop_to_upload')}</p>
                            </div>
                        </div>
                    `}
                    ${loading && html`
                        <div class="flex items-center justify-center py-16 text-text-secondary">
                            <${Loader} size=${20} />
                        </div>
                    `}

                    ${!loading && dirs.length === 0 && files.length === 0 && html`
                        <div class="flex flex-col items-center justify-center py-16 text-text-secondary">
                            <${Image} size=${32} className="mb-2 text-text-secondary" />
                            <p class="text-sm">${subpath ? t('resource_browser.empty') : t('resource_browser.no_files')}</p>
                        </div>
                    `}

                    ${!loading && (dirs.length > 0 || files.length > 0) && html`
                        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 p-1">
                            ${dirs.map(dir => html`
                                <button type="button" key=${'dir-' + dir.name}
                                    onclick=${() => navigateInto(dir.name)}
                                    class="flex flex-col items-center text-center transition-colors rounded-lg p-2 hover:bg-accent-light">
                                    <div class="w-full aspect-square rounded-lg overflow-hidden border border-border bg-bg flex items-center justify-center mb-2">
                                        <${Folder} size=${28} className="text-text-secondary" />
                                    </div>
                                    <p class="text-xs font-medium text-text truncate w-full">${dir.name}</p>
                                </button>
                            `)}
                            ${files.map(file => html`
                                <button type="button" key=${file.name}
                                    onclick=${() => setSelected(file)}
                                    class="flex flex-col items-center text-center transition-colors rounded-lg p-2 hover:bg-accent-light ${
                                        selected?.name === file.name ? 'ring-2 ring-accent bg-accent-light' : ''
                                    }">
                                    <div class="w-full aspect-square rounded-lg overflow-hidden border border-border bg-bg flex items-center justify-center mb-2">
                                        ${file.is_image
                                            ? html`<img src=${file.url} alt=${file.name} class="w-full h-full object-cover" loading="lazy" />`
                                            : html`<${FileText} size=${28} className="text-text-secondary" />`
                                        }
                                    </div>
                                    <p class="text-xs font-medium text-text truncate w-full">${file.name}</p>
                                </button>
                            `)}
                        </div>
                    `}
                </div>

                <div class="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-border">
                    <button type="button" onclick=${onClose}
                        class="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text transition-colors">
                        ${t('common.cancel')}
                    </button>
                    <button type="button" onclick=${handleConfirm}
                        disabled=${!selected}
                        class="px-4 py-2 bg-accent-dark hover:bg-accent-dark disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                        ${t('resource_browser.select')}
                    </button>
                </div>
            </div>
        <//>
    `;
}
