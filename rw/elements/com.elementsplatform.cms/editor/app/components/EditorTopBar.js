import { h } from 'preact';
import htm from 'htm';
import { History } from '../icons.js?v=20260538';
import { t } from '../i18n.js?v=20260538';

const html = htm.bind(h);

export function EditorTopBar({ folder, folderLabel, filename, saving, onSave, showPreview, onTogglePreview, previewUrl, onHistory }) {
    return html`
        <div class="shrink-0">
            <div class="h-[44px] flex items-center justify-between px-4 border-b border-border bg-surface">
                <nav class="flex items-center gap-1.5 min-w-0">
                    <a href=${`#/files/${folder}`}
                       class="text-[12px] text-text-muted hover:text-text transition-colors whitespace-nowrap">
                        ← ${folderLabel || t('editor.back')}
                    </a>
                    <span class="text-[12px] text-text-muted">/</span>
                    <span class="text-[13px] font-semibold text-text truncate">${filename}</span>
                </nav>

                <div class="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick=${onHistory}
                        class="inline-flex items-center gap-1 px-3 py-[5px] bg-surface border border-border rounded-btn text-[11px] font-medium text-text-secondary transition-colors hover:bg-bg"
                    >
                        <${History} size=${13} />
                        ${t('editor.history')}
                    </button>
                    ${previewUrl && html`
                        <button
                            type="button"
                            onClick=${onTogglePreview}
                            class="px-3 py-[5px] bg-surface border border-border rounded-btn text-[11px] font-medium text-text-secondary transition-colors hover:bg-bg"
                        >
                            ${showPreview ? t('editor.edit') : t('editor.preview')}
                        </button>
                    `}
                    <button
                        type="button"
                        onClick=${onSave}
                        disabled=${saving}
                        class="px-3 py-[5px] bg-accent hover:bg-accent-dark text-white rounded-btn text-[11px] font-medium transition-colors disabled:opacity-50"
                    >
                        ${saving ? t('editor.saving') : t('editor.save')}
                    </button>
                </div>
            </div>
        </div>
    `;
}
