import { h } from 'preact';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import htm from 'htm';
import { route, setNavGuard, clearNavGuard } from '../router.js?v=20260538';
import { api } from '../api.js?v=20260538';
import { config, contentSubpath, showFlash, isLicensed } from '../state.js?v=20260538';
import { groupFields, FieldInput, ObjectListField } from '../components/FieldInput.js?v=20260538';
import { TiptapEditor } from '../components/TiptapEditor.js?v=20260538';
import { EditorTopBar } from '../components/EditorTopBar.js?v=20260538';
import { EditorToolbar } from '../components/EditorToolbar.js?v=20260538';
import { ResourceBrowserModal } from '../components/ResourceBrowserModal.js?v=20260538';
import { PreviewModal } from '../components/PreviewModal.js?v=20260538';
import { VersionHistoryModal } from '../components/VersionHistoryModal.js?v=20260538';
import { LicenseRequiredModal } from '../components/LicenseRequiredModal.js?v=20260538';
import { formatLabel } from '../utils.js?v=20260538';
import { t } from '../i18n.js?v=20260538';

const html = htm.bind(h);

export function FileEdit({ folder, file }) {
    const [fm, setFm] = useState({});
    const [body, setBody] = useState('');
    const [slug, setSlug] = useState('');
    const [originalFilename, setOriginalFilename] = useState('');
    const [fieldTypes, setFieldTypes] = useState({});
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [editor, setEditor] = useState(null);
    const [showPreview, setShowPreview] = useState(false);
    const [previewKey, setPreviewKey] = useState(0);
    const [draftSlug, setDraftSlug] = useState(null);
    const [showResourceModal, setShowResourceModal] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showLicenseModal, setShowLicenseModal] = useState(false);
    const [rawMode, setRawMode] = useState(false);
    const rawTextareaRef = useRef(null);
    const draftSlugRef = useRef(null);
    const baselineRef = useRef(null);
    const dirtyRef = useRef(false);

    useEffect(() => {
        loadFile();
        return () => cleanupDraft();
    }, [folder, file]);

    // Snapshot of the last saved state, used to detect unsaved edits.
    function snapshot(b, s, f) {
        return JSON.stringify({ body: b, slug: s, fm: f });
    }

    function resetBaseline(b, s, f) {
        baselineRef.current = snapshot(b, s, f);
        // Synchronously not-dirty: a save-triggered route() runs before the
        // next render, so the guard must not see a stale dirty ref.
        dirtyRef.current = false;
    }

    // Recompute on every render so the navigation guard closure (registered
    // once on mount) always sees the current dirty state.
    dirtyRef.current =
        baselineRef.current !== null &&
        baselineRef.current !== snapshot(body, slug, fm);

    // Register a navigation guard (in-app routing) and a beforeunload
    // handler (tab close / refresh / external nav) while editing.
    useEffect(() => {
        const guard = () =>
            !dirtyRef.current || confirm(t('editor.unsaved_warning'));
        setNavGuard(guard);

        const onBeforeUnload = (e) => {
            if (dirtyRef.current) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', onBeforeUnload);

        return () => {
            clearNavGuard(guard);
            window.removeEventListener('beforeunload', onBeforeUnload);
        };
    }, []);

    async function loadFile() {
        const params = { folder, file };
        if (contentSubpath.value) params.subpath = contentSubpath.value;
        const data = await api('files.read', { params });
        if (data && !data._error) {
            setOriginalFilename(data.filename);
            setSlug(data.slug || '');
            setBody(data.body || '');
            setFieldTypes(data.field_types || {});

            const meta = data.meta || {};
            const fmValues = {};
            for (const [key, type] of Object.entries(data.field_types || {})) {
                if (Array.isArray(type) && type[0] === 'object_list') {
                    const items = meta[key] || [];
                    fmValues[`${key}.__count`] = items.length;
                    items.forEach((item, idx) => {
                        for (const [subKey, subVal] of Object.entries(item)) {
                            fmValues[`${key}.${idx}.${subKey}`] = subVal != null ? String(subVal) : '';
                        }
                    });
                    continue;
                }
                const val = resolveNestedValue(meta, key);
                if (type === 'list' && Array.isArray(val)) {
                    fmValues[key] = val.join(', ');
                } else {
                    fmValues[key] = val != null ? val : '';
                }
            }
            setFm(fmValues);
            resetBaseline(data.body || '', data.slug || '', fmValues);
        }
        setLoaded(true);
    }

    function resolveNestedValue(obj, key) {
        return key.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
    }

    function updateField(key, value) {
        setFm(prev => ({ ...prev, [key]: value }));
    }

    const handleBodyChange = useCallback((md) => {
        setBody(md);
    }, []);

    function addItem(parentKey) {
        const type = fieldTypes[parentKey];
        if (!Array.isArray(type) || type[0] !== 'object_list') return;
        const subKeys = Object.keys(type[1]);
        setFm(prev => {
            const count = parseInt(prev[`${parentKey}.__count`] || '0');
            const next = { ...prev, [`${parentKey}.__count`]: count + 1 };
            for (const sk of subKeys) {
                next[`${parentKey}.${count}.${sk}`] = '';
            }
            return next;
        });
    }

    function removeItem(parentKey, idx) {
        const type = fieldTypes[parentKey];
        if (!Array.isArray(type) || type[0] !== 'object_list') return;
        const subKeys = Object.keys(type[1]);
        setFm(prev => {
            const count = parseInt(prev[`${parentKey}.__count`] || '0');
            const next = { ...prev };
            // Shift items above idx down
            for (let i = idx; i < count - 1; i++) {
                for (const sk of subKeys) {
                    next[`${parentKey}.${i}.${sk}`] = prev[`${parentKey}.${i + 1}.${sk}`] || '';
                }
            }
            // Remove last item's keys
            for (const sk of subKeys) {
                delete next[`${parentKey}.${count - 1}.${sk}`];
            }
            next[`${parentKey}.__count`] = count - 1;
            return next;
        });
    }

    function prepareFm() {
        const submittedFm = {};
        for (const [key, type] of Object.entries(fieldTypes)) {
            if (Array.isArray(type) && type[0] === 'object_list') {
                const count = parseInt(fm[`${key}.__count`] || '0');
                const subKeys = Object.keys(type[1]);
                const items = [];
                for (let i = 0; i < count; i++) {
                    const item = {};
                    for (const sk of subKeys) {
                        item[sk] = fm[`${key}.${i}.${sk}`] || '';
                    }
                    items.push(item);
                }
                submittedFm[key] = items;
                continue;
            }
            let val = fm[key];
            if (type === 'list' && typeof val === 'string') {
                val = val.split(',').map(s => s.trim()).filter(Boolean);
            }
            submittedFm[key] = val;
        }
        return submittedFm;
    }

    async function postDraft() {
        const submittedFm = prepareFm();
        const draftBody = { folder, file, fm: submittedFm, body };
        if (contentSubpath.value) draftBody.subpath = contentSubpath.value;
        const res = await api('files.draft', {
            method: 'POST',
            body: draftBody
        });
        if (res && !res._error) {
            setDraftSlug(res.slug);
            draftSlugRef.current = res.slug;
        }
        return res;
    }

    function cleanupDraft() {
        const slug = draftSlugRef.current;
        if (slug) {
            const cleanupBody = { folder, slug };
            if (contentSubpath.value) cleanupBody.subpath = contentSubpath.value;
            api('files.draftCleanup', { method: 'POST', body: cleanupBody });
            setDraftSlug(null);
            draftSlugRef.current = null;
        }
    }

    async function handleTogglePreview() {
        if (!showPreview) {
            const res = await postDraft();
            if (res && !res._error) {
                setPreviewKey(Date.now());
                setShowPreview(true);
            }
        } else {
            cleanupDraft();
            setShowPreview(false);
        }
    }

    async function handleSave() {
        setSaving(true);

        const submittedFm = prepareFm();
        const updateBody = { folder, file, fm: submittedFm, body, slug };
        if (contentSubpath.value) updateBody.subpath = contentSubpath.value;
        const data = await api('files.update', {
            method: 'POST',
            body: updateBody
        });
        setSaving(false);

        if (data && !data._error) {
            cleanupDraft();
            // Saved state is now the baseline — navigating away (including the
            // filename-change redirect below) must not warn about unsaved work.
            resetBaseline(body, slug, fm);
            showFlash('success', t('editor.saved'));
            if (data.filename && data.filename !== file) {
                route(`/files/${folder}/edit/${data.filename}`, true);
            }
        }
    }

    function handleUploadSelect(url) {
        const isImage = /\.(jpe?g|png|gif|webp|svg|avif)$/i.test(url);
        const name = url.split('/').pop();
        const md = isImage ? `![${name}](${url})` : `[${name}](${url})`;
        if (rawMode) {
            const ta = rawTextareaRef.current;
            if (!ta) return;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const val = ta.value;
            const newVal = val.slice(0, start) + md + val.slice(end);
            setBody(newVal);
            requestAnimationFrame(() => {
                ta.focus();
                ta.selectionStart = ta.selectionEnd = start + md.length;
            });
        } else {
            if (!editor) return;
            editor.chain().focus().insertContentAt(editor.state.selection, md).run();
        }
    }

    function handleHistory() {
        if (!isLicensed.value) {
            setShowLicenseModal(true);
            return;
        }
        setShowHistory(true);
    }

    if (!loaded) {
        return html`<div class="flex items-center justify-center h-full text-text-secondary">${t('common.loading')}</div>`;
    }

    // Separate title field from other fields
    const titleKey = Object.keys(fieldTypes).find(k => k.toLowerCase() === 'title');
    const filteredFieldTypes = { ...fieldTypes };
    if (titleKey) delete filteredFieldTypes[titleKey];
    const groups = groupFields(filteredFieldTypes);

    // Get folder label from config
    const folders = config.value?.folders || [];
    const folderInfo = folders.find(f => String(f.index) === String(folder));
    const folderLabel = folderInfo?.label || 'Files';
    const resourcesPath = config.value?.resources_path || '/resources';
    const previewBase = folderInfo?.preview_url;
    const previewUrl = previewBase && slug.trim()
        ? `${previewBase}${previewBase.includes('?') ? '&' : '?'}slug=${encodeURIComponent(slug)}&_t=${previewKey}`
        : null;

    return html`
        <div class="flex flex-col h-full">
            <${EditorTopBar}
                folder=${folder}
                folderLabel=${folderLabel}
                filename=${originalFilename}
                saving=${saving}
                onSave=${handleSave}
                showPreview=${showPreview}
                onTogglePreview=${handleTogglePreview}
                previewUrl=${previewUrl}
                onHistory=${handleHistory} />

            <div class="flex flex-1 overflow-hidden flex-col lg:flex-row">
                <!-- Editor pane -->
                <div class="flex-1 overflow-y-auto min-h-0">
                    <${EditorToolbar}
                        editor=${editor}
                        rawMode=${rawMode}
                        onToggleRaw=${() => setRawMode(r => !r)}
                        onAddResource=${() => setShowResourceModal(true)} />

                    <div class="max-w-3xl mx-auto w-full" style="padding: 24px 40px">
                        ${titleKey && html`
                            <input type="text" value=${fm[titleKey] || ''}
                                oninput=${e => updateField(titleKey, e.target.value)}
                                placeholder="${t('editor.title_placeholder')}"
                                class="w-full text-[28px] font-extrabold text-text placeholder-text-muted border-0 bg-transparent outline-none p-0 mb-6" />
                        `}
                        <${TiptapEditor}
                            content=${body}
                            onChange=${handleBodyChange}
                            onEditorReady=${setEditor}
                            onTextareaReady=${(el) => { rawTextareaRef.current = el; }}
                            placeholder="${t('editor.body_placeholder')}"
                            resourcesPath=${resourcesPath}
                            rawMode=${rawMode} />
                    </div>
                </div>

                <!-- Meta sidebar -->
                <div class="w-full lg:w-[260px] border-t lg:border-t-0 lg:border-l border-border bg-surface overflow-y-auto shrink-0">
                    <div class="px-4 py-3 border-b border-border-light">
                        <h3 class="text-[10px] font-semibold text-text-muted uppercase tracking-wider">${t('editor.metadata')}</h3>
                    </div>

                    <div class="p-4 space-y-4 border-b border-border-light">
                        <div>
                            <label class="block text-sm font-medium leading-none mb-2">${t('editor.slug')}</label>
                            <input type="text" value=${slug}
                                oninput=${e => setSlug(e.target.value)}
                                class="w-full h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20" />
                            <p class="text-xs text-text-secondary mt-1">${t('editor.slug_edit_warning')}</p>
                        </div>
                    </div>

                    <div class="p-4 space-y-4">
                        ${groups.map(group => {
                            if (group.type === 'object_list') {
                                return html`<${ObjectListField}
                                    key=${group.parent}
                                    fieldKey=${group.parent}
                                    subTypes=${group.subTypes}
                                    fm=${fm}
                                    onChange=${updateField}
                                    onAddItem=${addItem}
                                    onRemoveItem=${removeItem} />`;
                            }
                            if (group.parent && group.children) {
                                return html`
                                    <div key=${group.parent} class="-mx-4 px-4 pt-4 border-t border-border space-y-3">
                                        <span class="text-sm font-medium">${formatLabel(group.parent)}</span>
                                        ${group.children.map(([key, type]) => html`
                                            <${FieldInput} key=${key} fieldKey=${key} type=${type} value=${fm[key] || ''} onChange=${updateField} />
                                        `)}
                                    </div>
                                `;
                            }
                            return html`<${FieldInput} key=${group.key} fieldKey=${group.key} type=${group.type} value=${fm[group.key] || ''} onChange=${updateField} />`;
                        })}
                    </div>
                </div>
            </div>

            <${ResourceBrowserModal}
                open=${showResourceModal}
                onClose=${() => setShowResourceModal(false)}
                onSelect=${handleUploadSelect} />

            <${PreviewModal}
                open=${showPreview}
                onClose=${() => { cleanupDraft(); setShowPreview(false); }}
                previewUrl=${previewUrl} />

            <${VersionHistoryModal}
                open=${showHistory}
                onClose=${() => setShowHistory(false)}
                folder=${folder}
                file=${file}
                onRestore=${loadFile} />

            <${LicenseRequiredModal}
                open=${showLicenseModal}
                onClose=${() => setShowLicenseModal(false)} />
        </div>
    `;
}
