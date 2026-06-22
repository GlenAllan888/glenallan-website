import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { route } from '../../router.js?v=20260538';
import { api } from '../../api.js?v=20260538';
import { config, contentSubpath, sidebarTree, showFlash } from '../../state.js?v=20260538';
import { FolderOpen, Loader, RotateCcw } from '../../icons.js?v=20260538';
import { SectionLayout } from '../../components/SectionLayout.js?v=20260538';
import { FolderBrowserModal, inferFolderLabel } from '../../components/FolderBrowserModal.js?v=20260538';
import { t } from '../../i18n.js?v=20260538';

const html = htm.bind(h);

const inputClass = 'w-full h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50';

export function SettingsTab({ folder }) {
    const [data, setData] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [label, setLabel] = useState('');
    const [path, setPath] = useState('');
    const [displayPath, setDisplayPath] = useState('');
    const [browseOpen, setBrowseOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [labelSaving, setLabelSaving] = useState(false);

    const subpath = contentSubpath.value;
    const isSubfolder = subpath !== '';

    async function load() {
        setLoading(true);
        const params = { folder };
        if (subpath) params.subpath = subpath;
        const res = await api('folders.settings', { params });
        if (res && !res._error) {
            setData(res);
            setLabel(res.folder?.label || '');
            setPath(res.folder?.path || '');
            setDisplayPath(res.folder?.display_path || res.folder?.path || '');
            const own = res.preview_url?.own;
            setPreviewUrl(own !== null && own !== undefined ? own : '');
        }
        setLoading(false);
    }

    useEffect(() => { load(); }, [folder, subpath]);

    function handlePathInput(value) {
        setPath(value);
        setDisplayPath(value);
        const inferred = inferFolderLabel(value);
        if (inferred) setLabel(inferred);
    }

    function handleBrowseSelect(selection) {
        setPath(selection.path);
        setDisplayPath(selection.displayPath || selection.path);
        if (selection.label) setLabel(selection.label);
        setBrowseOpen(false);
    }

    async function handleSaveFolder(e) {
        if (e) e.preventDefault();
        const nextPath = path.trim();
        const pathChanged = !isSubfolder && nextPath !== '' && nextPath !== (data?.folder?.path || '');
        if (pathChanged && !confirm(t('folder_settings.location_reset_confirm'))) return;

        setLabelSaving(true);
        const body = { folder, label };
        if (!isSubfolder) body.path = nextPath;
        const res = await api('folders.update', {
            method: 'POST',
            body,
        });
        setLabelSaving(false);
        if (res && !res._error) {
            if (res.config) config.value = res.config;
            if (res.path_changed) {
                contentSubpath.value = '';
                sidebarTree.value = {};
                route(`/files/${folder}`);
            }
            if (res.warning) {
                showFlash('warning', res.warning);
            } else {
                showFlash('success', t('folder_settings.saved'));
            }
            load();
        }
    }

    async function handleSavePreview(e) {
        if (e) e.preventDefault();
        setSubmitting(true);
        const body = { folder, preview_url: previewUrl };
        if (subpath) body.subpath = subpath;
        const res = await api('folders.updateFields', { method: 'POST', body });
        setSubmitting(false);
        if (res && !res._error) {
            showFlash('success', t('settings_tab.preview_saved'));
            load();
        }
    }

    async function handleRevertPreview() {
        if (!confirm(t('settings_tab.preview_revert_confirm'))) return;
        setSubmitting(true);
        const res = await api('folders.updateFields', {
            method: 'POST',
            body: { folder, subpath, preview_url: '' },
        });
        setSubmitting(false);
        if (res && !res._error) {
            showFlash('success', t('settings_tab.preview_reverted'));
            load();
        }
    }

    async function handleRemove() {
        const folders = config.value?.folders || [];
        if (folders.length <= 1) return;
        if (!confirm(t('folder_settings.remove_confirm'))) return;
        const res = await api('folders.remove', { method: 'POST', body: { folder } });
        if (res && !res._error) {
            showFlash('success', t('folder_settings.removed'));
            if (res.config) config.value = res.config;
            contentSubpath.value = '';
            route('/files/0');
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

    const isLastFolder = (config.value?.folders || []).length <= 1;
    const ownPreview = data.preview_url?.own;
    const effectivePreview = data.preview_url?.effective || '';
    const previewInheritedFrom = data.preview_url?.inherited_from || '';
    const isPreviewCustom = ownPreview !== null && ownPreview !== undefined;
    const sourceBase = data.folder.display_path || data.folder.path;
    const sourceDisplay = isSubfolder
        ? (sourceBase === '/' ? `/${subpath}` : `${sourceBase}/${subpath}`)
        : sourceBase;
    const fullSourceDisplay = isSubfolder ? `${data.folder.path}/${subpath}` : data.folder.path;

    return html`
        <div>
            ${!isSubfolder && html`
                <${SectionLayout} title=${t('folder_settings.label')} description=${t('folder_settings.label_desc')}>
                    <form onSubmit=${handleSaveFolder}>
                        <input
                            type="text"
                            value=${label}
                            onInput=${e => setLabel(e.target.value)}
                            required
                            class="${inputClass}"
                        />
                        <div class="flex items-center gap-2 mt-3">
                            <button
                                type="submit"
                                disabled=${labelSaving || !label.trim() || !path.trim()}
                                class="px-3 py-1.5 bg-accent hover:bg-accent-dark text-white rounded-btn text-[12px] font-medium disabled:opacity-50 transition-colors"
                            >
                                ${labelSaving ? t('common.saving') : t('common.save')}
                            </button>
                        </div>
                    </form>
                <//>
            `}

            <${SectionLayout} title=${t('folder_settings.source')} description=${t('folder_settings.source_desc')}>
                ${isSubfolder ? html`
                    <div class="px-3 py-1.5 bg-bg border border-border rounded-btn text-[13px] font-mono text-text-secondary" title=${fullSourceDisplay}>
                        ${sourceDisplay}
                    </div>
                    ${fullSourceDisplay && fullSourceDisplay !== sourceDisplay && html`
                        <p class="text-[11px] text-text-secondary mt-1.5">
                            ${t('folder_settings.full_path')}: <span class="font-mono">${fullSourceDisplay}</span>
                        </p>
                    `}
                ` : html`
                    <form onSubmit=${handleSaveFolder}>
                        <div class="flex gap-2">
                            <input
                                type="text"
                                value=${path}
                                onInput=${e => handlePathInput(e.target.value)}
                                required
                                title=${path}
                                class="${inputClass} min-w-0 flex-1 font-mono"
                            />
                            <button
                                type="button"
                                onclick=${() => setBrowseOpen(true)}
                                class="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-border bg-surface text-sm text-text-secondary shadow-sm shadow-black/5 hover:bg-bg transition-colors whitespace-nowrap"
                            >
                                <${FolderOpen} size=${15} />
                                ${t('common.browse')}
                            </button>
                        </div>
                        ${displayPath && displayPath !== path && html`
                            <p class="text-[11px] text-text-secondary mt-1.5">
                                ${t('folder_settings.full_path')}: <span class="font-mono">${path}</span>
                            </p>
                        `}
                        <div class="flex items-center gap-2 mt-3">
                            <button
                                type="submit"
                                disabled=${labelSaving || !label.trim() || !path.trim()}
                                class="px-3 py-1.5 bg-accent hover:bg-accent-dark text-white rounded-btn text-[12px] font-medium disabled:opacity-50 transition-colors"
                            >
                                ${labelSaving ? t('common.saving') : t('common.save')}
                            </button>
                        </div>
                    </form>
                `}
            <//>

            <${SectionLayout} title=${t('folder_settings.live_preview')} description=${t('folder_settings.live_preview_desc')} last=${!isSubfolder && isLastFolder}>
                ${isSubfolder && !isPreviewCustom && html`
                    <div class="rounded-[8px] border border-border bg-bg p-3 mb-2 text-[12px] text-text-secondary">
                        ${effectivePreview
                            ? t('settings_tab.preview_inheriting', { url: effectivePreview, source: previewInheritedFrom === '' ? t('fields_tab.parent_collection') : previewInheritedFrom })
                            : t('settings_tab.preview_inheriting_empty')}
                    </div>
                `}
                <form onSubmit=${handleSavePreview}>
                    <input
                        type="url"
                        value=${previewUrl}
                        onInput=${e => setPreviewUrl(e.target.value)}
                        class="${inputClass}"
                        placeholder=${isSubfolder ? t('settings_tab.preview_subfolder_placeholder') : t('folder_settings.live_preview_placeholder')}
                    />
                    <p class="text-[11px] text-text-secondary mt-1.5">${t('folder_settings.live_preview_help')}</p>
                    <div class="flex items-center gap-2 mt-3">
                        <button
                            type="submit"
                            disabled=${submitting}
                            class="px-3 py-1.5 bg-accent hover:bg-accent-dark text-white rounded-btn text-[12px] font-medium disabled:opacity-50 transition-colors"
                        >
                            ${submitting ? t('common.saving') : t('common.save')}
                        </button>
                        ${isSubfolder && isPreviewCustom && html`
                            <button
                                type="button"
                                onClick=${handleRevertPreview}
                                disabled=${submitting}
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border hover:bg-black/5 text-text rounded-btn text-[12px] font-medium transition-colors disabled:opacity-50"
                            >
                                <${RotateCcw} size=${13} />
                                ${t('fields_tab.revert')}
                            </button>
                        `}
                    </div>
                </form>
            <//>

            ${!isSubfolder && html`
                <${SectionLayout} title=${t('folder_settings.remove')} description=${t('folder_settings.remove_desc')} last=${true}>
                    <div>
                        <button
                            type="button"
                            onclick=${handleRemove}
                            disabled=${isLastFolder}
                            class="px-3.5 py-1.5 bg-surface border border-danger text-danger rounded-btn text-[12px] font-medium hover:bg-danger/10 disabled:opacity-50 transition-colors"
                        >
                            ${isLastFolder ? t('folder_settings.cannot_remove_last') : t('folder_settings.remove')}
                        </button>
                    </div>
                <//>
            `}

            <${FolderBrowserModal}
                open=${browseOpen}
                onClose=${() => setBrowseOpen(false)}
                title=${t('setup.browse_content')}
                onSelect=${handleBrowseSelect}
            />
        </div>
    `;
}
