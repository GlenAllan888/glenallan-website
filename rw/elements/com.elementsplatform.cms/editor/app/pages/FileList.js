import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';
import { config, contentSubpath, isAdmin, isLicensed } from '../state.js?v=20260538';
import { capitalize } from '../utils.js?v=20260538';
import { ChevronRight } from '../icons.js?v=20260538';
import { PageHeader } from '../components/PageHeader.js?v=20260538';
import { FolderUnavailable } from '../components/FolderUnavailable.js?v=20260538';
import { t } from '../i18n.js?v=20260538';
import { ContentTab } from './files/ContentTab.js?v=20260538';
import { FieldsTab } from './files/FieldsTab.js?v=20260538';
import { SettingsTab } from './files/SettingsTab.js?v=20260538';

const html = htm.bind(h);

const TABS = [
    { id: 'content',  label: 'files.tab_content',  component: ContentTab,  adminOnly: false },
    { id: 'fields',   label: 'files.tab_fields',   component: FieldsTab,   adminOnly: true },
    { id: 'settings', label: 'files.tab_settings', component: SettingsTab, adminOnly: true },
];

export function FileList({ folder }) {
    const [activeId, setActiveId] = useState('content');

    const folderIndex = parseInt(folder, 10);
    const folders = config.value?.folders || [];
    const folderInfo = folders.find(f => f.index === folderIndex);

    if (!folderInfo) {
        const firstIndex = folders[0]?.index ?? 0;
        return html`
            <div>
                <${PageHeader} title=${t('folder_unavailable.not_found_title')} />
                <${FolderUnavailable}
                    kind=${isLicensed.value ? 'not_found' : 'license'}
                    backHref=${folders.length > 0 ? `/files/${firstIndex}` : null}
                />
            </div>
        `;
    }

    const folderLabel = folderInfo.label || 'Files';
    const subpath = contentSubpath.value;
    const breadcrumbParts = subpath ? subpath.split('/') : [];

    const visibleTabs = TABS.filter(tab => !tab.adminOnly || isAdmin.value);
    const ActiveComponent = visibleTabs.find(tab => tab.id === activeId)?.component || ContentTab;

    const headerTitle = breadcrumbParts.length > 0 ? html`
        <span class="flex items-center gap-1.5">
            <button onClick=${() => { contentSubpath.value = ''; }}
                class="text-accent hover:underline cursor-pointer font-bold"
            >
                ${folderLabel}
            </button>
            ${breadcrumbParts.map((part, i) => html`
                <${ChevronRight} size=${14} className="text-text-muted" />
                ${i < breadcrumbParts.length - 1 ? html`
                    <button
                        onClick=${() => { contentSubpath.value = breadcrumbParts.slice(0, i + 1).join('/'); }}
                        class="text-accent hover:underline cursor-pointer font-bold"
                    >
                        ${capitalize(part)}
                    </button>
                ` : html`
                    <span>${capitalize(part)}</span>
                `}
            `)}
        </span>
    ` : folderLabel;

    return html`
        <div>
            <${PageHeader} title=${headerTitle} />

            ${visibleTabs.length > 1 && html`
                <div class="mb-5 border-b border-border">
                    <div class="flex gap-1">
                        ${visibleTabs.map(tab => html`
                            <button key=${tab.id}
                                onclick=${() => setActiveId(tab.id)}
                                class="px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${activeId === tab.id
                                    ? 'border-accent-dark text-text'
                                    : 'border-transparent text-text-muted hover:text-text'}">
                                ${t(tab.label)}
                            </button>
                        `)}
                    </div>
                </div>
            `}

            <${ActiveComponent} folder=${folder} key=${`${folder}|${subpath}`} />
        </div>
    `;
}
