import { h } from 'preact';
import htm from 'htm';

const html = htm.bind(h);

export function PageHeader({ title, subtitle, icon, children }) {
    return html`
        <div class="mb-6">
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-[18px] font-bold text-text flex items-center gap-2">
                        ${icon && html`<span class="opacity-50">${icon}</span>`}
                        ${title}
                    </h1>
                    ${subtitle && html`
                        <p class="text-[13px] text-text-muted mt-1">${subtitle}</p>
                    `}
                </div>
                ${children && html`<div class="flex items-center gap-2">${children}</div>`}
            </div>
        </div>
    `;
}
