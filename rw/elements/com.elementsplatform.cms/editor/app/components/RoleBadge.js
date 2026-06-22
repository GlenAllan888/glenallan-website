import { h } from 'preact';
import htm from 'htm';

const html = htm.bind(h);

export function RoleBadge({ role }) {
    const isOwner = role === 'owner' || role === 'admin';
    return html`
        <span class="inline-block px-2.5 py-0.5 rounded-pill text-[11px] font-medium ${
            isOwner
                ? 'bg-[#ede9fe] text-[#7c3aed]'
                : 'bg-accent-light text-accent'
        }">${role}</span>
    `;
}
