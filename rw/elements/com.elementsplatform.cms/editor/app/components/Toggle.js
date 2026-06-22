import { h } from 'preact';
import htm from 'htm';

const html = htm.bind(h);

export function Toggle({ checked, onChange }) {
    return html`
        <button
            type="button"
            role="switch"
            aria-checked=${checked}
            onclick=${() => onChange(!checked)}
            class="relative inline-flex shrink-0 cursor-pointer rounded-[8px] transition-colors ${checked ? 'bg-accent' : 'bg-border'}"
            style="width: 30px; height: 16px"
        >
            <span
                class="pointer-events-none inline-block rounded-full bg-white shadow-sm transition-transform"
                style="width: 12px; height: 12px; margin-top: 2px; margin-left: ${checked ? '16px' : '2px'}; transition: margin-left 0.15s ease"
            />
        </button>
    `;
}
