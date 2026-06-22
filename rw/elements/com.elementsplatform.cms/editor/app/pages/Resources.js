import { h } from 'preact';
import htm from 'htm';
import { config, resourceSubpath, resourcesActiveTab, isAdmin, isLicensed } from '../state.js?v=20260538';
import { capitalize } from '../utils.js?v=20260538';
import { ChevronRight } from '../icons.js?v=20260538';
import { PageHeader } from '../components/PageHeader.js?v=20260538';
import { FolderUnavailable } from '../components/FolderUnavailable.js?v=20260538';
import { t } from '../i18n.js?v=20260538';
import { ContentTab } from './resources/ContentTab.js?v=20260538';
import { SettingsTab } from './resources/SettingsTab.js?v=20260538';

const html = htm.bind(h);

const TABS = [
    { id: 'content',  label: 'resources.tab_content',  component: ContentTab,  adminOnly: false },
    { id: 'settings', label: 'resources.tab_settings', component: SettingsTab, adminOnly: true },
];

export function Resources({ folder }) {
    const activeId = resourcesActiveTab.value;

    const folderIndex = parseInt(folder, 10);
    const folders = config.value?.resource_folders || [];
    const folderInfo = folders.find(f => f.index === folderIndex);

    if (!folderInfo) {
        const firstIndex = folders[0]?.index ?? 0;
        return html`
            <div>
                <${PageHeader} title=${t('folder_unavailable.not_found_title')} />
                <${FolderUnavailable}
                    kind=${isLicensed.value ? 'not_found' : 'license'}
                    backHref=${folders.length > 0 ? `/resources/${firstIndex}` : null}
                />
            </div>
        `;
    }

    const folderLabel = folderInfo.label || 'Resources';
    const subpath = resourceSubpath.value;
    const breadcrumbParts = subpath ? subpath.split('/') : [];

    const visibleTabs = TABS.filter(tab => !tab.adminOnly || isAdmin.value);
    const currentTab = visibleTabs.find(tab => tab.id === activeId) || visibleTabs[0];
    const ActiveComponent = currentTab.component;

    const headerTitle = breadcrumbParts.length > 0 ? html`
        <span class="flex items-center gap-1.5">
            <button onClick=${() => { resourceSubpath.value = ''; }}
                class="text-accent hover:underline cursor-pointer font-bold"
            >
                ${folderLabel}
            </button>
            ${breadcrumbParts.map((part, i) => html`
                <${ChevronRight} size=${14} className="text-text-muted" />
                ${i < breadcrumbParts.length - 1 ? html`
                    <button
                        onClick=${() => { resourceSubpath.value = breadcrumbParts.slice(0, i + 1).join('/'); }}
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
                                onclick=${() => { resourcesActiveTab.value = tab.id; }}
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
