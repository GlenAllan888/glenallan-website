import { h } from 'preact';
import htm from 'htm';
import { Sidebar } from './Sidebar.js?v=20260538';
import { sidebarOpen, sidebarCollapsed } from '../state.js?v=20260538';
import { Menu } from '../icons.js?v=20260538';

const html = htm.bind(h);

export function Layout({ fullBleed, children }) {
    const collapsed = sidebarCollapsed.value;
    const marginClass = collapsed ? 'md:ml-[60px]' : 'md:ml-[240px]';

    const mainClass = fullBleed
        ? `${marginClass} pt-14 md:pt-0 h-screen flex flex-col overflow-hidden transition-[margin] duration-200`
        : `${marginClass} pt-16 min-h-screen bg-surface transition-[margin] duration-200 p-6 md:p-8`;

    return html`
        <div class=${fullBleed ? 'h-screen overflow-hidden bg-surface' : 'min-h-screen bg-bg'}>
            <button onclick=${() => sidebarOpen.value = true}
                class="md:hidden fixed top-4 left-4 z-30 p-2 rounded-lg bg-surface shadow-md border border-border text-text-secondary hover:text-text">
                <${Menu} size=${20} />
            </button>

            ${sidebarOpen.value && html`
                <div class="fixed inset-0 bg-black/40 z-30 md:hidden"
                    onclick=${() => sidebarOpen.value = false}></div>
            `}

            <${Sidebar} />

            <main class=${mainClass}>
                ${children}
            </main>
        </div>
    `;
}
