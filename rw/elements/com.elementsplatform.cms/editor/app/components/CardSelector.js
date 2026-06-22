import { h } from 'preact';
import htm from 'htm';

const html = htm.bind(h);

const colClasses = { 2: 'grid-cols-2', 3: 'grid-cols-3' };

export function CardSelector({ options, value, onChange, columns = 2 }) {
    return html`
        <div class="grid ${colClasses[columns] || 'grid-cols-2'} gap-3">
            ${options.map(opt => html`
                <button
                    type="button"
                    key=${opt.value}
                    onclick=${() => onChange(opt.value)}
                    class="text-left p-3.5 rounded-[8px] border-2 transition-colors ${
                        value === opt.value
                            ? 'border-accent bg-accent-light'
                            : 'border-border hover:border-border'
                    }"
                >
                    ${opt.swatch && html`<div class="mb-2">${opt.swatch}</div>`}
                    <div class="text-[13px] font-semibold ${value === opt.value ? 'text-accent-dark' : 'text-text'}">${opt.title}</div>
                    ${opt.description && html`<div class="text-[11px] text-text-muted mt-0.5">${opt.description}</div>`}
                </button>
            `)}
        </div>
    `;
}
