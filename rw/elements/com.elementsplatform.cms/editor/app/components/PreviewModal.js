import { h } from 'preact';
import { useEffect } from 'preact/hooks';
import htm from 'htm';
import { X } from '../icons.js?v=20260538';
import { t } from '../i18n.js?v=20260538';

const html = htm.bind(h);

export function PreviewModal({ open, onClose, previewUrl }) {
    useEffect(() => {
        if (!open) return;
        function onKey(e) {
            if (e.key === 'Escape') onClose();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    if (!open || !previewUrl) return null;

    return html`
        <div class="fixed inset-0 z-50 flex items-center justify-center p-6"
            style="background:rgba(0,0,0,.45)"
            onclick=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div class="bg-surface rounded-xl shadow-2xl w-full h-full flex flex-col overflow-hidden">
                <div class="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
                    <h3 class="text-sm font-semibold text-text-secondary uppercase tracking-wider">${t('preview_modal.title')}</h3>
                    <button type="button" onclick=${onClose}
                        class="text-text-secondary hover:text-text p-1">
                        <${X} size=${18} />
                    </button>
                </div>
                <iframe src=${previewUrl} class="flex-1 w-full border-0" />
            </div>
        </div>
    `;
}
