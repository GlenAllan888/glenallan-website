import { h } from 'preact';
import htm from 'htm';

const html = htm.bind(h);

export function SectionLayout({ title, description, last, children }) {
    return html`
        <div class="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4 sm:gap-8 ${last ? '' : 'pb-8 mb-8 border-b border-border-light'}">
            <div>
                <h3 class="text-[14px] font-semibold text-text">${title}</h3>
                ${description && html`<p class="text-[12px] text-text-muted leading-relaxed mt-1">${description}</p>`}
            </div>
            <div class="flex flex-col gap-4 min-w-0">
                ${children}
            </div>
        </div>
    `;
}
