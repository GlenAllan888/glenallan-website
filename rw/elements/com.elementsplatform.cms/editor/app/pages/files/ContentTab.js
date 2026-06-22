import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import htm from 'htm';
import { route } from '../../router.js?v=20260538';
import { api } from '../../api.js?v=20260538';
import { t } from '../../i18n.js?v=20260538';
import { isLicensed, contentSubpath, showFlash } from '../../state.js?v=20260538';
import { formatDate, capitalize } from '../../utils.js?v=20260538';
import { FileText, Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, Folder, Plus, Loader } from '../../icons.js?v=20260538';
import { StatusDot } from '../../components/StatusDot.js?v=20260538';
import { Modal } from '../../components/Modal.js?v=20260538';

const html = htm.bind(h);

export function ContentTab({ folder }) {
    const [files, setFiles] = useState([]);
    const [dirs, setDirs] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState('modified');
    const [sortAsc, setSortAsc] = useState(false);
    const [menuOpen, setMenuOpen] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [creatingFolder, setCreatingFolder] = useState(false);
    const menuRef = useRef(null);
    const folderInputRef = useRef(null);

    useEffect(() => {
        loadFiles();
    }, [folder, contentSubpath.value]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, sortField, sortAsc]);

    useEffect(() => {
        function handleClickOutside(e) {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(null);
            }
        }
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    async function loadFiles() {
        setLoaded(false);
        setCurrentPage(1);
        const params = { folder };
        if (contentSubpath.value) params.subpath = contentSubpath.value;
        const data = await api('files.list', { params });
        if (data && !data._error) {
            setFiles(data.files || []);
            setDirs(data.dirs || []);
        }
        setLoaded(true);
    }

    async function deleteFile(name) {
        if (!confirm(t('files.delete_confirm', { name }))) return;
        const body = { folder, file: name };
        if (contentSubpath.value) body.subpath = contentSubpath.value;
        const data = await api('files.delete', { method: 'POST', body });
        if (data && !data._error) {
            setFiles(files.filter(f => f.name !== name));
            showFlash('success', t('files.deleted'));
        }
    }

    async function duplicateFile(file) {
        const body = { folder, file: file.name };
        if (contentSubpath.value) body.subpath = contentSubpath.value;
        const data = await api('files.duplicate', { method: 'POST', body });
        if (data && !data._error) {
            showFlash('success', t('files.duplicated'));
            loadFiles();
        }
    }

    async function renameFile(file) {
        const baseName = file.name.replace(/\.md$/, '');
        const newName = prompt(t('files.rename_prompt'), baseName);
        if (newName === null) return;
        const trimmed = newName.trim();
        if (trimmed === '' || trimmed === baseName) return;
        const body = { folder, file: file.name, newName: trimmed };
        if (contentSubpath.value) body.subpath = contentSubpath.value;
        const data = await api('files.rename', { method: 'POST', body });
        if (data && !data._error) {
            showFlash('success', t('files.renamed'));
            loadFiles();
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
        if (contentSubpath.value) body.subpath = contentSubpath.value;
        const data = await api('files.createFolder', { method: 'POST', body });
        setCreatingFolder(false);
        if (data && !data._error) {
            setShowFolderModal(false);
            showFlash('success', t('common.folder_created'));
            loadFiles();
        }
    }

    function navigateInto(dirName) {
        contentSubpath.value = contentSubpath.value ? contentSubpath.value + '/' + dirName : dirName;
    }

    const subpath = contentSubpath.value;

    const filteredFiles = files.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const filteredDirs = dirs.filter(d =>
        d.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const sorted = [...filteredFiles].sort((a, b) => {
        let cmp = 0;
        if (sortField === 'name') {
            cmp = a.name.localeCompare(b.name);
        } else if (sortField === 'status') {
            cmp = getStatus(a).localeCompare(getStatus(b));
        } else if (sortField === 'date') {
            if (!a.date && !b.date) cmp = 0;
            else if (!a.date) return 1;
            else if (!b.date) return -1;
            else cmp = a.date.localeCompare(b.date);
        } else {
            cmp = (a.modified || 0) - (b.modified || 0);
        }
        return sortAsc ? cmp : -cmp;
    });

    const perPage = 20;
    const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
    const safePage = Math.min(currentPage, totalPages);
    const paginatedFiles = sorted.slice((safePage - 1) * perPage, safePage * perPage);

    function getStatus(file) {
        if (file.status === 'published') return 'published';
        if (file.status === 'draft') return 'draft';
        return 'published';
    }

    if (!loaded) {
        return html`<div class="flex items-center justify-center py-20">
            <${Loader} className="text-accent-dark" />
        </div>`;
    }

    return html`
        <div>
            <div class="flex items-center gap-2 mb-4">
                <a href=${`#/files/${folder}/new`}
                    class="inline-flex items-center gap-1.5 h-8 px-3 bg-accent text-white hover:bg-accent/90 rounded-lg text-sm font-medium transition-colors">
                    <${Plus} size=${14} />
                    ${t('files.new_file')}
                </a>
                ${isLicensed.value && html`
                    <button
                        onClick=${openFolderModal}
                        class="inline-flex items-center gap-1.5 h-8 px-3 border border-border bg-surface text-text hover:bg-black/5 rounded-lg text-sm font-medium transition-colors">
                        <${Plus} size=${14} />
                        ${t('common.new_folder')}
                    </button>
                `}
                <div class="relative ml-auto">
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

            ${sorted.length === 0 && files.length === 0 && filteredDirs.length === 0 ? html`
                <div class="text-center py-12 text-text-secondary">
                    <${FileText} size=${40} className="mx-auto mb-3 opacity-50" />
                    <p>${subpath ? t('files.empty_folder') : t('files.empty')}</p>
                </div>
            ` : sorted.length === 0 && filteredDirs.length === 0 ? html`
                <div class="text-center py-12 text-text-secondary">
                    <p>${t('files.no_match', { query: searchQuery })}</p>
                </div>
            ` : (sorted.length > 0 || filteredDirs.length > 0) ? html`
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
                            <th class="text-left px-3 py-2 font-normal w-[100px]">
                                <button onclick=${() => { setSortField('status'); setSortAsc(sortField === 'status' ? !sortAsc : true); }}
                                    class="text-left text-[10px] uppercase font-semibold tracking-wider transition-colors cursor-pointer inline-flex items-center gap-1 ${sortField === 'status' ? 'text-text' : 'text-text-muted hover:text-text'}">
                                    ${t('common.status')}
                                    ${sortField === 'status' && html`<${sortAsc ? ChevronUp : ChevronDown} size=${12} />`}
                                </button>
                            </th>
                            <th class="text-left px-3 py-2 font-normal w-[100px]">
                                <button onclick=${() => { setSortField('date'); setSortAsc(sortField === 'date' ? !sortAsc : false); }}
                                    class="text-left text-[10px] uppercase font-semibold tracking-wider transition-colors cursor-pointer inline-flex items-center gap-1 ${sortField === 'date' ? 'text-text' : 'text-text-muted hover:text-text'}">
                                    ${t('common.date')}
                                    ${sortField === 'date' && html`<${sortAsc ? ChevronUp : ChevronDown} size=${12} />`}
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

                        ${paginatedFiles.map(file => html`
                            <tr key=${file.name}
                                class="hover:bg-border-light transition-colors cursor-pointer"
                                onclick=${(e) => {
                                    if (e.target.closest('[data-menu]')) return;
                                    route(`/files/${folder}/edit/${file.name}`);
                                }}>
                                <td class="px-3 py-[11px]">
                                    <div class="flex items-center gap-2 font-medium text-text truncate">
                                        <${FileText} size=${15} className="text-text-muted shrink-0" />
                                        <span class="truncate">${file.name}</span>
                                    </div>
                                </td>
                                <td class="px-3 py-[11px]">
                                    <${StatusDot} status=${getStatus(file)} />
                                </td>
                                <td class="px-3 py-[11px] text-text-secondary whitespace-nowrap">
                                    ${file.date ? formatDate(file.date) : '—'}
                                </td>
                                <td class="px-3 py-[11px] text-text-secondary whitespace-nowrap">
                                    ${formatDate(file.modified)}
                                </td>
                                <td class="px-3 py-[11px] relative" data-menu ref=${menuOpen === file.name ? menuRef : null}>
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
                                                    setMenuOpen(null);
                                                    route(`/files/${folder}/edit/${file.name}`);
                                                }}
                                                class="w-full text-left px-3 py-1.5 text-[12px] text-text hover:bg-border-light transition-colors">
                                                ${t('common.edit')}
                                            </button>
                                            <button
                                                onclick=${(e) => {
                                                    e.stopPropagation();
                                                    setMenuOpen(null);
                                                    renameFile(file);
                                                }}
                                                class="w-full text-left px-3 py-1.5 text-[12px] text-text hover:bg-border-light transition-colors">
                                                ${t('files.rename')}
                                            </button>
                                            <button
                                                onclick=${(e) => {
                                                    e.stopPropagation();
                                                    setMenuOpen(null);
                                                    duplicateFile(file);
                                                }}
                                                class="w-full text-left px-3 py-1.5 text-[12px] text-text hover:bg-border-light transition-colors">
                                                ${t('files.duplicate')}
                                            </button>
                                            <button
                                                onclick=${(e) => {
                                                    e.stopPropagation();
                                                    setMenuOpen(null);
                                                    deleteFile(file.name);
                                                }}
                                                class="w-full text-left px-3 py-1.5 text-[12px] text-red-600 hover:bg-border-light transition-colors">
                                                ${t('common.delete')}
                                            </button>
                                        </div>
                                    `}
                                </td>
                            </tr>
                        `)}
                    </tbody>
                </table>
                ${totalPages > 1 && html`
                    <div class="flex items-center justify-between mt-4 text-sm text-text-secondary">
                        <button
                            onclick=${() => setCurrentPage(Math.max(1, safePage - 1))}
                            disabled=${safePage <= 1}
                            class="inline-flex items-center gap-1 px-3 py-1.5 border border-border bg-surface rounded-lg text-[12px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-black/5">
                            <${ChevronLeft} size=${14} />
                            ${t('common.previous')}
                        </button>
                        <span class="text-[12px]">${t('common.page_of', { page: safePage, total: totalPages })}</span>
                        <button
                            onclick=${() => setCurrentPage(Math.min(totalPages, safePage + 1))}
                            disabled=${safePage >= totalPages}
                            class="inline-flex items-center gap-1 px-3 py-1.5 border border-border bg-surface rounded-lg text-[12px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-black/5">
                            ${t('common.next')}
                            <${ChevronRight} size=${14} />
                        </button>
                    </div>
                `}
            ` : null}

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
