import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { route } from '../../router.js?v=20260538';
import { api } from '../../api.js?v=20260538';
import { config, showFlash, isLicensed, resourceSubpath, resourceSidebarTree } from '../../state.js?v=20260538';
import { FolderOpen, Loader } from '../../icons.js?v=20260538';
import { SectionLayout } from '../../components/SectionLayout.js?v=20260538';
import { Toggle } from '../../components/Toggle.js?v=20260538';
import { FolderBrowserModal, inferFolderLabel } from '../../components/FolderBrowserModal.js?v=20260538';
import { t } from '../../i18n.js?v=20260538';

const html = htm.bind(h);

const inputClass = 'w-full h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50';
const labelClass = 'block text-sm font-medium leading-none mb-2';

const DEFAULT_IMAGE_RESIZE = { enabled: false, max_width: 1920, max_height: 1920, quality: 85 };

export function SettingsTab({ folder }) {
    const [label, setLabel] = useState('');
    const [path, setPath] = useState('');
    const [displayPath, setDisplayPath] = useState('');
    const [fullPath, setFullPath] = useState('');
    const [imageResize, setImageResize] = useState(DEFAULT_IMAGE_RESIZE);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [browseOpen, setBrowseOpen] = useState(false);

    async function load() {
        setLoading(true);
        const res = await api('resourceFolders.settings', { params: { folder } });
        if (res && !res._error) {
            setLabel(res.folder.label || '');
            setPath(res.folder.path || '');
            setDisplayPath(res.folder.display_path || res.folder.path || '');
            setFullPath(res.folder.path || '');
            const ir = res.folder.image_resize || {};
            setImageResize({
                enabled: !!ir.enabled,
                max_width: ir.max_width || 1920,
                max_height: ir.max_height || 1920,
                quality: ir.quality || 85,
            });
        }
        setLoading(false);
    }

    useEffect(() => { load(); }, [folder]);

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

    async function handleSave(e) {
        if (e) e.preventDefault();
        const nextPath = path.trim();
        const pathChanged = nextPath !== '' && nextPath !== fullPath;
        if (pathChanged && !confirm(t('resource_folder_settings.location_reset_confirm'))) return;

        setSubmitting(true);
        const res = await api('resourceFolders.update', {
            method: 'POST',
            body: { folder, label, path: nextPath, image_resize: imageResize },
        });
        setSubmitting(false);
        if (res && !res._error) {
            if (res.path_changed) {
                resourceSubpath.value = '';
                resourceSidebarTree.value = {};
                route(`/resources/${folder}`);
            }
            if (res.warning) {
                showFlash('warning', res.warning);
            } else {
                showFlash('success', t('resource_folder_settings.saved'));
            }
            if (res.config) config.value = res.config;
            load();
        }
    }

    async function handleRemove() {
        const resourceFolders = config.value?.resource_folders || [];
        if (resourceFolders.length <= 1) return;
        if (!confirm(t('resource_folder_settings.remove_confirm'))) return;
        const res = await api('resourceFolders.remove', { method: 'POST', body: { folder } });
        if (res && !res._error) {
            showFlash('success', t('resource_folder_settings.removed'));
            if (res.config) config.value = res.config;
            route('/files/0');
        }
    }

    if (loading) {
        return html`<div class="flex items-center justify-center py-20">
            <${Loader} className="text-accent-dark" />
        </div>`;
    }

    const isLastFolder = (config.value?.resource_folders || []).length <= 1;

    return html`
        <div>
            <div class="flex justify-end mb-4">
                <button
                    type="button"
                    onClick=${handleSave}
                    disabled=${submitting || !label.trim() || !path.trim()}
                    class="px-3 py-1.5 bg-accent hover:bg-accent-dark text-white rounded-btn text-[12px] font-medium disabled:opacity-50 transition-colors"
                >
                    ${submitting ? t('common.saving') : t('resource_folder_settings.save')}
                </button>
            </div>

            <${SectionLayout} title=${t('resource_folder_settings.label')} description=${t('resource_folder_settings.label_desc')}>
                <div>
                    <label class="${labelClass}">${t('resource_folder_settings.label')}</label>
                    <input
                        type="text"
                        value=${label}
                        onInput=${e => setLabel(e.target.value)}
                        required
                        class="${inputClass}"
                    />
                </div>
            <//>

            <${SectionLayout} title=${t('resource_folder_settings.path')} description=${t('resource_folder_settings.path_desc')}>
                <div>
                    <label class="${labelClass}">${t('resource_folder_settings.path')}</label>
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
                            ${t('resource_folder_settings.full_path')}: <span class="font-mono">${path}</span>
                        </p>
                    `}
                </div>
            <//>

            ${isLicensed.value && html`
                <${SectionLayout} title=${t('resource_folder_settings.image_handling')} description=${t('resource_folder_settings.image_handling_desc')}>
                    <div class="flex items-center gap-3">
                        <${Toggle}
                            checked=${imageResize.enabled}
                            onChange=${(val) => setImageResize({ ...imageResize, enabled: val })}
                        />
                        <span class="text-[13px] text-text">${t('resource_folder_settings.resize_on_upload')}</span>
                    </div>
                    ${imageResize.enabled && html`
                        <div class="grid grid-cols-3 gap-4">
                            <div>
                                <label class="${labelClass}">${t('resource_folder_settings.max_width')}</label>
                                <input
                                    type="number"
                                    min="1" max="6000"
                                    value=${imageResize.max_width}
                                    onInput=${e => setImageResize({ ...imageResize, max_width: parseInt(e.target.value) || 1920 })}
                                    class="${inputClass}"
                                />
                            </div>
                            <div>
                                <label class="${labelClass}">${t('resource_folder_settings.max_height')}</label>
                                <input
                                    type="number"
                                    min="1" max="6000"
                                    value=${imageResize.max_height}
                                    onInput=${e => setImageResize({ ...imageResize, max_height: parseInt(e.target.value) || 1920 })}
                                    class="${inputClass}"
                                />
                            </div>
                            <div>
                                <label class="${labelClass}">${t('resource_folder_settings.quality')}</label>
                                <input
                                    type="number"
                                    min="10" max="100"
                                    value=${imageResize.quality}
                                    onInput=${e => setImageResize({ ...imageResize, quality: parseInt(e.target.value) || 85 })}
                                    class="${inputClass}"
                                />
                            </div>
                        </div>
                    `}
                <//>
            `}

            <${SectionLayout} title=${t('resource_folder_settings.remove')} description=${t('resource_folder_settings.remove_desc')} last=${true}>
                <div>
                    <button
                        type="button"
                        onclick=${handleRemove}
                        disabled=${isLastFolder}
                        class="px-3.5 py-1.5 bg-surface border border-danger text-danger rounded-btn text-[12px] font-medium hover:bg-danger/10 disabled:opacity-50 transition-colors"
                    >
                        ${isLastFolder ? t('resource_folder_settings.cannot_remove_last') : t('resource_folder_settings.remove')}
                    </button>
                </div>
            <//>

            <${FolderBrowserModal}
                open=${browseOpen}
                onClose=${() => setBrowseOpen(false)}
                title=${t('setup.browse_resources')}
                onSelect=${handleBrowseSelect}
            />
        </div>
    `;
}
