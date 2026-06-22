import { h } from 'preact';
import htm from 'htm';

const html = htm.bind(h);

const statusColors = {
    published: 'bg-success',
    draft: 'bg-warning',
    review: 'bg-accent',
};

const statusLabels = {
    published: 'Published',
    draft: 'Draft',
    review: 'In Review',
};

export function StatusDot({ status }) {
    const color = statusColors[status] || 'bg-text-muted';
    const label = statusLabels[status] || status;
    return html`
        <span class="inline-flex items-center gap-1.5 text-[12px] text-text-secondary">
            <span class="inline-block w-[7px] h-[7px] rounded-full ${color}"></span>
            ${label}
        </span>
    `;
}
