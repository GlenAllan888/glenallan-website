import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import htm from 'htm';
import { api } from '../../api.js?v=20260538';
import { t } from '../../i18n.js?v=20260538';
import { showFlash, resourceSubpath } from '../../state.js?v=20260538';
import { Upload, Trash2, Image, Loader, Folder, Search, Plus, MoreHorizontal, ChevronUp, ChevronDown, Grid as GridIcon, ListIcon2 } from '../../icons.js?v=20260538';
import { Modal } from '../../components/Modal.js?v=20260538';
import { humanSize, capitalize, formatDate } from '../../utils.js?v=20260538';

const html = htm.bind(h);

export function ContentTab({ folder }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [copied, setCopied] = useState(null);
    const subpath = resourceSubpath.value;
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('cms_resources_viewMode') || 'grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState('modified');
    const [sortAsc, setSortAsc] = useState(false);
    const [menuOpen, setMenuOpen] = useState(null);
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [creatingFolder, setCreatingFolder] = useState(false);
    const fileInput = useRef(null);
    const menuRef = useRef(null);
    const folderInputRef = useRef(null);

    async function load() {
        setLoading(true);
        const params = { folder };
        if (subpath) params.subpath = subpath;
        const res = await api('resources.list', { params });
        if (res && !res._error) {
            setData(res);
        }
        setLoading(false);
    }

    useEffect(() => { localStorage.setItem('cms_resources_viewMode', viewMode); }, [viewMode]);
    useEffect(() => { load(); }, [folder, subpath]);

    useEffect(() => {
        function handleClickOutside(e) {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(null);
            }
        }
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    async function uploadFiles(files) {
        if (!files || !files.length) return;
        setUploading(true);
        let ok = 0, failed = 0;
        for (const file of files) {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('folder', folder);
            if (subpath) fd.append('subpath', subpath);
            const res = await api('resources.upload', { method: 'POST', body: fd });
            if (res && !res._error) ok++; else failed++;
        }
        setUploading(false);
        load();
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

    async function handleDelete(name) {
        if (!confirm(t('resources.delete_confirm', { name }))) return;
        const body = { folder, file: name };
        if (subpath) body.subpath = subpath;
        const res = await api('resources.delete', { method: 'POST', body });
        if (res && !res._error) {
            showFlash('success', t('resources.deleted'));
            setMenuOpen(null);
            load();
        }
    }

    async function handleRename(file) {
        const baseName = file.name.replace(/\.[^.]+$/, '');
        const newName = prompt('Rename file:', baseName);
        if (!newName || newName.trim() === baseName) return;
        const body = { folder, file: file.name, newName: newName.trim() };
        if (subpath) body.subpath = subpath;
        const res = await api('resources.rename', { method: 'POST', body });
        if (res && !res._error) {
            showFlash('success', t('resources.renamed'));
            setMenuOpen(null);
            load();
        }
    }

    function openFolderModal() {
        setNewFolderName('');
        setShowFolderModal(true);
        setTimeout(() => folderInputRef.current?.focus(), 50);
    }

    async function handleCreateFolder(e) {
        e.preventDefault();
        const name = newFolderName.trim();
        if (!name) return;
        setCreatingFolder(true);
        const body = { folder, name };
        if (subpath) body.subpath = subpath;
        const res = await api('resources.createFolder', { method: 'POST', body });
        setCreatingFolder(false);
        if (res && !res._error) {
            setShowFolderModal(false);
            showFlash('success', t('common.folder_created'));
            load();
        }
    }

    async function handleCopy(url) {
        await navigator.clipboard.writeText(url);
        setCopied(url);
        setTimeout(() => setCopied(null), 2000);
    }

    function navigateInto(dirName) {
        resourceSubpath.value = subpath ? subpath + '/' + dirName : dirName;
    }

    if (loading) {
        return html`<div class="flex items-center justify-center py-20">
            <${Loader} className="text-accent-dark" />
        </div>`;
    }

    if (!data) {
        return html`<div class="text-center py-20 text-text-secondary">${t('resources.failed_load')}</div>`;
    }

    const { files, dirs = [] } = data;

    const filteredFiles = searchQuery
        ? files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : files;
    const filteredDirs = searchQuery
        ? dirs.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : dirs;

    const sorted = [...filteredFiles].sort((a, b) => {
        let cmp = 0;
        if (sortField === 'name') {
            cmp = a.name.localeCompare(b.name);
        } else if (sortField === 'size') {
            cmp = (a.size || 0) - (b.size || 0);
        } else if (sortField === 'type') {
            const extA = a.name.includes('.') ? a.name.split('.').pop() : '';
            const extB = b.name.includes('.') ? b.name.split('.').pop() : '';
            cmp = extA.localeCompare(extB);
        } else {
            cmp = (a.modified || 0) - (b.modified || 0);
        }
        return sortAsc ? cmp : -cmp;
    });

    function renderActionMenu(file) {
        return html`
            <div class="relative" ref=${menuOpen === file.name ? menuRef : null} data-menu>
                <button
                    onclick=${(e) => {
                        e.stopPropagation();
                        setMenuOpen(menuOpen === file.name ? null : file.name);
                    }}
                    class="p-1 rounded hover:bg-border text-text-muted hover:text-text transition-colors">
                    <${MoreHorizontal} size=${15} />
                </button>
                ${menuOpen === file.name && html`
                    <div class="absolute right-0 top-full mt-1 bg-surface border border-border rounded-btn shadow-lg z-10 min-w-[120px] py-1">
                        <button
                            onclick=${(e) => {
                                e.stopPropagation();
                                handleCopy(file.url);
                                setMenuOpen(null);
                            }}
                            class="w-full text-left px-3 py-1.5 text-[12px] text-text hover:bg-border-light transition-colors">
                            ${copied === file.url ? t('resources.copied') : t('resources.copy_url')}
                        </button>
                        <button
                            onclick=${(e) => {
                                e.stopPropagation();
                                setMenuOpen(null);
                                handleRename(file);
                            }}
                            class="w-full text-left px-3 py-1.5 text-[12px] text-text hover:bg-border-light transition-colors">
                            ${t('resources.rename')}
                        </button>
                        <button
                            onclick=${(e) => {
                                e.stopPropagation();
                                setMenuOpen(null);
                                handleDelete(file.name);
                            }}
                            class="w-full text-left px-3 py-1.5 text-[12px] text-red-600 hover:bg-border-light transition-colors">
                            ${t('common.delete')}
                        </button>
                    </div>
                `}
            </div>
        `;
    }

    return html`
        <div>
            <div class="flex items-center gap-2 mb-4">
                <button
                    onClick=${() => fileInput.current.click()}
                    disabled=${uploading}
                    class="inline-flex items-center gap-1.5 h-8 px-3 bg-accent text-white hover:bg-accent/90 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                    <${Plus} size=${14} />
                    ${uploading ? t('resources.uploading') : t('resources.upload')}
                </button>
                <button
                    onClick=${openFolderModal}
                    class="inline-flex items-center gap-1.5 h-8 px-3 border border-border bg-surface text-text hover:bg-black/5 rounded-lg text-sm font-medium transition-colors">
                    <${Plus} size=${14} />
                    ${t('common.new_folder')}
                </button>
                <input ref=${fileInput} type="file" multiple class="hidden" onChange=${handleFileSelect} />

                <div class="flex h-8 rounded-lg overflow-hidden border border-border ml-auto">
                    <button
                        onClick=${() => setViewMode('grid')}
                        class="w-8 h-8 flex items-center justify-center ${viewMode === 'grid' ? 'bg-accent-light text-accent' : 'bg-surface text-text-muted'}"
                    >
                        <${GridIcon} size=${14} />
                    </button>
                    <button
                        onClick=${() => setViewMode('list')}
                        class="w-8 h-8 flex items-center justify-center ${viewMode === 'list' ? 'bg-accent-light text-accent' : 'bg-surface text-text-muted'}"
                    >
                        <${ListIcon2} size=${14} />
                    </button>
                </div>
                <div class="relative">
                    <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
                        <${Search} size=${14} />
                    </span>
                    <input
                        type="text"
                        placeholder=${t('common.filter')}
                        value=${searchQuery}
                        onInput=${(e) => setSearchQuery(e.target.value)}
                        class="w-full max-w-xs h-8 px-3 pl-8 border border-border rounded-lg text-sm bg-surface text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20"
                    />
                </div>
            </div>

            <div
                class="relative"
                onDragOver=${handleDragOver}
                onDragLeave=${handleDragLeave}
                onDrop=${handleDrop}
            >
                ${dragging && html`
                    <div class="absolute inset-0 bg-accent-light/80 border-2 border-dashed border-accent rounded-[8px] flex items-center justify-center z-10 pointer-events-none">
                        <div class="text-center">
                            <${Upload} size=${32} className="mx-auto mb-2 text-accent-dark" />
                            <p class="text-[12px] font-medium text-accent-dark">${t('resources.drop_to_upload')}</p>
                        </div>
                    </div>
                `}

                ${filteredDirs.length === 0 && filteredFiles.length === 0 && !dragging ? html`
                    <button
                        onClick=${() => fileInput.current.click()}
                        class="w-full py-16 border-2 border-dashed border-border rounded-[8px] flex flex-col items-center justify-center text-text-muted hover:border-accent hover:text-accent transition-colors cursor-pointer"
                    >
                        <${Upload} size=${32} className="mb-3 opacity-70" />
                        <p class="text-[13px] font-medium mb-1">${t('resources.drop_files')}</p>
                        <p class="text-[11px] opacity-70">${t('resources.click_to_browse')}</p>
                    </button>
                ` : filteredDirs.length === 0 && sorted.length === 0 ? html`
                    <div class="text-center py-12 text-text-secondary">
                        <p>${t('resources.no_match', { query: searchQuery })}</p>
                    </div>
                ` : viewMode === 'grid' ? html`
                    <div class="grid gap-2" style="grid-template-columns: repeat(auto-fill, minmax(130px, 1fr))">
                        ${filteredDirs.map(dir => html`
                            <button key=${'dir-' + dir.name}
                                onClick=${() => navigateInto(dir.name)}
                                class="relative h-full min-h-[130px] text-left hover:brightness-95 transition-all"
                                title=${dir.name}
                            >
                                <div class="absolute top-0 left-0 h-[14px] w-[45%] bg-surface border border-border border-b-0 rounded-t-[6px]"></div>
                                <div class="absolute top-[10px] left-0 right-0 bottom-0 bg-surface border border-border rounded-[6px] rounded-tl-none flex flex-col items-center justify-center px-2 text-center">
                                    <p class="text-[12px] font-medium text-text truncate max-w-full">${capitalize(dir.name)}</p>
                                    ${dir.count != null && html`
                                        <p class="text-[10px] text-text-muted mt-0.5">${t('resources.file_count', { count: dir.count })}</p>
                                    `}
                                </div>
                            </button>
                        `)}

                        ${filteredFiles.map(file => html`
                            <div key=${file.name} class="relative group border rounded-[8px] overflow-hidden text-left transition-all border-border hover:border-border">
                                <div class="h-[88px] bg-bg flex items-center justify-center overflow-hidden"
                                     style="background: linear-gradient(135deg, #f8f8fa 0%, #f0f0f4 100%)">
                                    ${file.is_image
                                        ? html`<img src=${file.url} alt=${file.name} class="w-full h-full object-cover" />`
                                        : html`<${Image} size=${24} className="text-text-muted" />`
                                    }
                                </div>
                                <div class="p-2">
                                    <p class="text-[11px] font-medium text-text truncate" title=${file.name}>${file.name}</p>
                                    <p class="text-[10px] text-text-muted">${humanSize(file.size)}</p>
                                </div>
                                <div class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    ${renderActionMenu(file)}
                                </div>
                            </div>
                        `)}

                        <button
                            onClick=${() => fileInput.current.click()}
                            class="border-2 border-dashed border-border rounded-[8px] flex flex-col items-center justify-center min-h-[88px] text-text-muted hover:border-accent hover:text-accent transition-colors"
                        >
                            <${Upload} size=${20} className="mb-1" />
                            <span class="text-[10px]">${t('resources.drop_files')}</span>
                        </button>
                    </div>
                ` : html`
                    <table class="w-full text-[12px] border-collapse">
                        <thead>
                            <tr class="border-b border-border">
                                <th class="text-left px-3 py-2 font-normal">
                                    <button onclick=${() => { setSortField('name'); setSortAsc(sortField === 'name' ? !sortAsc : true); }}
                                        class="text-left text-[10px] uppercase font-semibold tracking-wider transition-colors cursor-pointer inline-flex items-center gap-1 ${sortField === 'name' ? 'text-text' : 'text-text-muted hover:text-text'}">
                                        ${t('common.name')}
                                        ${sortField === 'name' && html`<${sortAsc ? ChevronUp : ChevronDown} size=${12} />`}
                                    </button>
                                </th>
                                <th class="text-left px-3 py-2 font-normal w-[80px]">
                                    <button onclick=${() => { setSortField('size'); setSortAsc(sortField === 'size' ? !sortAsc : true); }}
                                        class="text-left text-[10px] uppercase font-semibold tracking-wider transition-colors cursor-pointer inline-flex items-center gap-1 ${sortField === 'size' ? 'text-text' : 'text-text-muted hover:text-text'}">
                                        ${t('common.size')}
                                        ${sortField === 'size' && html`<${sortAsc ? ChevronUp : ChevronDown} size=${12} />`}
                                    </button>
                                </th>
                                <th class="text-left px-3 py-2 font-normal w-[70px]">
                                    <button onclick=${() => { setSortField('type'); setSortAsc(sortField === 'type' ? !sortAsc : true); }}
                                        class="text-left text-[10px] uppercase font-semibold tracking-wider transition-colors cursor-pointer inline-flex items-center gap-1 ${sortField === 'type' ? 'text-text' : 'text-text-muted hover:text-text'}">
                                        ${t('common.type')}
                                        ${sortField === 'type' && html`<${sortAsc ? ChevronUp : ChevronDown} size=${12} />`}
                                    </button>
                                </th>
                                <th class="text-left px-3 py-2 font-normal w-[100px]">
                                    <button onclick=${() => { setSortField('modified'); setSortAsc(sortField === 'modified' ? !sortAsc : false); }}
                                        class="text-left text-[10px] uppercase font-semibold tracking-wider transition-colors cursor-pointer inline-flex items-center gap-1 ${sortField === 'modified' ? 'text-text' : 'text-text-muted hover:text-text'}">
                                        ${t('common.modified')}
                                        ${sortField === 'modified' && html`<${sortAsc ? ChevronUp : ChevronDown} size=${12} />`}
                                    </button>
                                </th>
                                <th class="w-[36px]"></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredDirs.map(dir => html`
                                <tr key=${'dir-' + dir.name}
                                    class="hover:bg-border-light transition-colors cursor-pointer"
                                    onclick=${() => navigateInto(dir.name)}>
                                    <td class="px-3 py-[11px]">
                                        <div class="flex items-center gap-2 font-medium text-text truncate">
                                            <${Folder} size=${15} className="text-text-muted shrink-0" />
                                            <span class="truncate">${capitalize(dir.name)}</span>
                                        </div>
                                    </td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                </tr>
                            `)}

                            ${sorted.map(file => html`
                                <tr key=${file.name}
                                    class="hover:bg-border-light transition-colors cursor-pointer"
                                    onclick=${(e) => {
                                        if (e.target.closest('[data-menu]')) return;
                                    }}>
                                    <td class="px-3 py-[11px]">
                                        <div class="flex items-center gap-2 font-medium text-text truncate">
                                            <div class="w-5 h-5 rounded-[3px] bg-bg flex items-center justify-center overflow-hidden shrink-0"
                                                 style="background: linear-gradient(135deg, #f8f8fa 0%, #f0f0f4 100%)">
                                                ${file.is_image
                                                    ? html`<img src=${file.url} alt=${file.name} class="w-full h-full object-cover" />`
                                                    : html`<${Image} size=${11} className="text-text-muted" />`
                                                }
                                            </div>
                                            <span class="truncate">${file.name}</span>
                                        </div>
                                    </td>
                                    <td class="px-3 py-[11px] text-text-secondary">
                                        ${humanSize(file.size)}
                                    </td>
                                    <td class="px-3 py-[11px] text-text-secondary">
                                        ${file.name.includes('.') ? file.name.split('.').pop().toUpperCase() : '—'}
                                    </td>
                                    <td class="px-3 py-[11px] text-text-secondary whitespace-nowrap">
                                        ${formatDate(file.modified)}
                                    </td>
                                    <td class="px-3 py-[11px] relative" data-menu ref=${menuOpen === file.name ? menuRef : null}>
                                        ${renderActionMenu(file)}
                                    </td>
                                </tr>
                            `)}
                        </tbody>
                    </table>
                `}
            </div>

            <${Modal} open=${showFolderModal} onClose=${() => setShowFolderModal(false)} title=${t('common.new_folder')} maxWidth="max-w-sm">
                <div class="p-5">
                    <form onSubmit=${handleCreateFolder}>
                        <label class="block text-sm font-medium leading-none mb-2">${t('common.folder_name')}</label>
                        <input
                            ref=${folderInputRef}
                            type="text"
                            value=${newFolderName}
                            onInput=${e => setNewFolderName(e.target.value)}
                            placeholder=${t('common.folder_name_placeholder')}
                            required
                            class="w-full h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20"
                        />
                        <div class="flex justify-end gap-2 mt-4">
                            <button
                                type="button"
                                onclick=${() => setShowFolderModal(false)}
                                class="px-3.5 py-1.5 border border-border bg-surface hover:bg-black/5 text-text rounded-btn text-[12px] font-medium"
                            >${t('common.cancel')}</button>
                            <button
                                type="submit"
                                disabled=${creatingFolder || !newFolderName.trim()}
                                class="px-3.5 py-1.5 bg-accent hover:bg-accent-dark text-white rounded-btn text-[12px] font-medium disabled:opacity-50"
                            >${creatingFolder ? t('common.creating') : t('common.create')}</button>
                        </div>
                    </form>
                </div>
            <//>
        </div>
    `;
}
