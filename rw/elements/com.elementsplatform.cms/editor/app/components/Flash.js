import { h } from 'preact';
import htm from 'htm';
import { flash } from '../state.js?v=20260538';
import { Check, AlertTriangle, X } from '../icons.js?v=20260538';

const html = htm.bind(h);

export function Flash() {
    if (!flash.value) return null;

    const { type, message } = flash.value;
    const isError = type === 'error';
    const isWarning = type === 'warning';

    const styles = isError
        ? 'bg-red-50 border-red-200 text-red-800'
        : isWarning
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800';

    const icon = isError || isWarning
        ? html`<${AlertTriangle} size=${18} className="${isError ? 'text-red-500' : 'text-amber-500'} shrink-0" />`
        : html`<${Check} size=${18} className="text-emerald-500 shrink-0" />`;

    return html`
        <div class="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm animate-[slideDown_0.3s_ease-out]">
            <div class="flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border ${styles}">
                ${icon}
                <span class="text-sm font-medium">${message}</span>
                <button onclick=${() => flash.value = null}
                    class="ml-2 shrink-0 opacity-50 hover:opacity-100">
                    <${X} size=${16} />
                </button>
            </div>
        </div>
    `;
}
