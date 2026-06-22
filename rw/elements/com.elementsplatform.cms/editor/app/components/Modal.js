import { h } from 'preact';
import { useEffect } from 'preact/hooks';
import htm from 'htm';
import { X } from '../icons.js?v=20260538';

const html = htm.bind(h);

export function Modal({ open, onClose, title, maxWidth, children }) {
    useEffect(() => {
        if (!open) return;
        function onKey(e) {
            if (e.key === 'Escape') onClose();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    if (!open) return null;

    return html`
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4"
            style="background:rgba(0,0,0,.45)"
            onclick=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div class="bg-surface rounded-xl shadow-2xl w-full ${maxWidth || 'max-w-lg'} flex flex-col" style="max-height:80vh">
                <div class="flex items-center justify-between px-5 py-4 border-b border-border">
                    <h3 class="text-lg font-semibold text-text">${title}</h3>
                    <button type="button" onclick=${onClose}
                        class="text-text-secondary hover:text-text p-1">
                        <${X} size=${18} />
                    </button>
                </div>
                <div class="flex-1 overflow-y-auto">
                    ${children}
                </div>
            </div>
        </div>
    `;
}
