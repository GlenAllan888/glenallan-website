import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import htm from 'htm';
import { route, currentPath } from '../router.js?v=20260538';
import { t } from '../i18n.js?v=20260538';
import { api } from '../api.js?v=20260538';
import { capitalize } from '../utils.js?v=20260538';
import { user, config, sidebarOpen, sidebarCollapsed, isAdmin, isOwner, isLicensed, featureEnabled, siteName, siteLogo, siteLogoDark, showFlash, contentSubpath, sidebarTree, resourceSubpath, resourceSidebarTree, resourcesActiveTab } from '../state.js?v=20260538';
import { Folder, Users, Settings, Shield, Webhook, X, Plus, ChevronDown, ChevronRight, PanelLeft, MoreHorizontal, Loader, Sparkles, Key } from '../icons.js?v=20260538';
import { FolderBrowserModal } from './FolderBrowserModal.js?v=20260538';
import { LicenseRequiredModal } from './LicenseRequiredModal.js?v=20260538';

const html = htm.bind(h);

// Section header (non-collapsible label)
function SectionHeader({ label, onAdd }) {
    const collapsed = sidebarCollapsed.value;

    return html`
        <div class="flex items-center justify-between px-[18px] py-[6px] mt-2 first:mt-0 ${collapsed ? 'md:hidden' : ''}">
            <span class="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-muted">
                ${label}
            </span>
            ${onAdd && html`
                <button onclick=${onAdd}
                    class="text-text-muted hover:text-text p-0.5 rounded transition-colors" title="${label === t('sidebar.content') ? t('sidebar.add_content_folder') : t('sidebar.add_resource_folder')}">
                    <${Plus} size=${12} />
                </button>
            `}
        </div>
    `;
}

// Reusable nav item
function NavItem({ icon, label, isActiveFn, onClick, actions, menuId, menuOpen, setMenuOpen, menuRef, chevron, chevronExpanded, onChevronClick, locked }) {
    const active = isActiveFn();
    const collapsed = sidebarCollapsed.value;
    const hasMenu = actions && actions.length > 0;
    const isMenuOpen = hasMenu && menuOpen === menuId;

    return html`
        <div class="relative group flex items-center mx-[8px] ${collapsed ? 'md:mx-[4px]' : ''}" style="width: calc(100% - ${collapsed ? '8px' : '16px'})">
            <button onclick=${onClick}
                class="flex-1 min-w-0 flex items-center gap-2.5 px-[10px] py-[7px] rounded-md text-[13px] transition-colors ${collapsed ? 'md:justify-center md:px-[8px]' : ''
        } ${locked ? 'opacity-55' : ''} ${active
            ? 'bg-border-light text-text font-semibold'
            : 'hover:bg-border-light text-text-secondary'
        }"
                title=${collapsed ? label : ''}>
                ${chevron && html`
                    <span
                        onclick=${(e) => { e.stopPropagation(); e.preventDefault(); onChevronClick(); }}
                        class="shrink-0 p-0.5 -ml-1 rounded hover:bg-border transition-colors text-text-muted cursor-pointer"
                    >
                        <${chevronExpanded ? ChevronDown : ChevronRight} size=${11} />
                    </span>
                `}
                <${icon} size=${15} className="${active ? 'opacity-100' : 'opacity-60'} shrink-0" />
                <span class="truncate ${collapsed ? 'md:hidden' : ''}">${label}</span>
            </button>
            ${hasMenu && !collapsed && html`
                <div class="absolute z-10 right-1 shrink-0 ${isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity ${collapsed ? 'md:hidden' : ''}"
                    ref=${isMenuOpen ? menuRef : null}>
                    <button
                        onclick=${(e) => {
                e.stopPropagation();
                setMenuOpen(isMenuOpen ? null : menuId);
            }}
                        class="p-1 rounded hover:bg-border text-text-muted hover:text-text transition-colors">
                        <${MoreHorizontal} size=${14} />
                    </button>
                    ${isMenuOpen && html`
                        <div class="absolute right-0 top-full bg-surface border border-border rounded-btn shadow-lg z-50 min-w-[120px] py-1">
                            ${actions.map(a => html`
                                <button
                                    onclick=${(e) => {
                    e.stopPropagation();
                    setMenuOpen(null);
                    a.onClick();
                }}
                                    class="w-full text-left px-3 py-1.5 text-[12px] ${a.danger ? 'text-red-600' : 'text-text'} hover:bg-border-light transition-colors">
                                    ${a.label}
                                </button>
                            `)}
                        </div>
                    `}
                </div>
            `}
        </div>
    `;
}

// Helpers for sidebar tree state
function getTreeNode(folderIndex, subpath) {
    const tree = sidebarTree.value;
    if (!subpath) return tree[folderIndex] || null;
    const children = tree[folderIndex]?.children || {};
    return children[subpath] || null;
}

function setTreeNode(folderIndex, subpath, updates) {
    const tree = { ...sidebarTree.value };
    if (!subpath) {
        tree[folderIndex] = { ...(tree[folderIndex] || {}), ...updates };
    } else {
        if (!tree[folderIndex]) tree[folderIndex] = {};
        const children = { ...(tree[folderIndex].children || {}) };
        children[subpath] = { ...(children[subpath] || {}), ...updates };
        tree[folderIndex] = { ...tree[folderIndex], children };
    }
    sidebarTree.value = tree;
}

async function toggleFolder(folderIndex, subpath) {
    const node = getTreeNode(folderIndex, subpath);
    const isExpanded = node?.expanded || false;

    if (isExpanded) {
        setTreeNode(folderIndex, subpath, { expanded: false });
        return;
    }

    setTreeNode(folderIndex, subpath, { expanded: true });

    // Fetch dirs if not cached
    if (!node?.dirs) {
        setTreeNode(folderIndex, subpath, { loading: true });
        const params = { folder: folderIndex };
        if (subpath) params.subpath = subpath;
        const data = await api('files.list', { params });
        if (data && !data._error) {
            setTreeNode(folderIndex, subpath, { dirs: data.dirs || [], loading: false });
        } else {
            setTreeNode(folderIndex, subpath, { loading: false });
        }
    }
}

// Recursive subfolder tree for sidebar
function SubfolderTree({ folderIndex, subpath, depth, nav }) {
    const node = getTreeNode(folderIndex, subpath);
    if (!node?.expanded) return null;

    const dirs = node.dirs;
    if (!dirs || dirs.length === 0) return null;

    const collapsed = sidebarCollapsed.value;
    if (collapsed) return null;

    const path = currentPath.value;
    const indent = depth * 12 + 30;

    return html`
        ${dirs.map(dir => {
            const childSubpath = subpath ? subpath + '/' + dir.name : dir.name;
            const isActive = path.startsWith(`/files/${folderIndex}`) && contentSubpath.value === childSubpath;
            const childNode = getTreeNode(folderIndex, childSubpath);
            const isLoading = childNode?.loading;

            return html`
                <div key=${childSubpath}>
                    <button
                        onclick=${() => { contentSubpath.value = childSubpath; sidebarOpen.value = false; route('/files/' + folderIndex); }}
                        class="flex items-center w-full mx-[8px] gap-1.5 py-[5px] px-[6px] rounded-md text-[12px] transition-colors ${
                            isActive ? 'bg-border-light text-text font-semibold' : 'hover:bg-border-light text-text-secondary'
                        }"
                        style="width: calc(100% - 16px); padding-left: ${indent}px"
                    >
                        <span
                            onclick=${(e) => { e.stopPropagation(); e.preventDefault(); toggleFolder(folderIndex, childSubpath); }}
                            class="shrink-0 p-0.5 rounded hover:bg-border transition-colors text-text-muted cursor-pointer"
                        >
                            <${childNode?.expanded ? ChevronDown : ChevronRight} size=${11} />
                        </span>
                        ${isLoading
                            ? html`<${Loader} size=${13} className="opacity-60 shrink-0" />`
                            : html`<${Folder} size=${13} className="${isActive ? 'opacity-100' : 'opacity-60'} shrink-0" />`
                        }
                        <span class="truncate">${capitalize(dir.name)}</span>
                    </button>
                    <${SubfolderTree} folderIndex=${folderIndex} subpath=${childSubpath} depth=${depth + 1} nav=${nav} />
                </div>
            `;
        })}
    `;
}

// Helpers for resource sidebar tree state
function getResourceTreeNode(folderIndex, subpath) {
    const tree = resourceSidebarTree.value;
    if (!subpath) return tree[folderIndex] || null;
    const children = tree[folderIndex]?.children || {};
    return children[subpath] || null;
}

function setResourceTreeNode(folderIndex, subpath, updates) {
    const tree = { ...resourceSidebarTree.value };
    if (!subpath) {
        tree[folderIndex] = { ...(tree[folderIndex] || {}), ...updates };
    } else {
        if (!tree[folderIndex]) tree[folderIndex] = {};
        const children = { ...(tree[folderIndex].children || {}) };
        children[subpath] = { ...(children[subpath] || {}), ...updates };
        tree[folderIndex] = { ...tree[folderIndex], children };
    }
    resourceSidebarTree.value = tree;
}

async function toggleResourceFolder(folderIndex, subpath) {
    const node = getResourceTreeNode(folderIndex, subpath);
    const isExpanded = node?.expanded || false;

    if (isExpanded) {
        setResourceTreeNode(folderIndex, subpath, { expanded: false });
        return;
    }

    setResourceTreeNode(folderIndex, subpath, { expanded: true });

    // Fetch dirs if not cached
    if (!node?.dirs) {
        setResourceTreeNode(folderIndex, subpath, { loading: true });
        const params = { folder: folderIndex };
        if (subpath) params.subpath = subpath;
        const data = await api('resources.list', { params });
        if (data && !data._error) {
            setResourceTreeNode(folderIndex, subpath, { dirs: data.dirs || [], loading: false });
        } else {
            setResourceTreeNode(folderIndex, subpath, { loading: false });
        }
    }
}

// Recursive subfolder tree for resource folders in sidebar
function ResourceSubfolderTree({ folderIndex, subpath, depth, nav }) {
    const node = getResourceTreeNode(folderIndex, subpath);
    if (!node?.expanded) return null;

    const dirs = node.dirs;
    if (!dirs || dirs.length === 0) return null;

    const collapsed = sidebarCollapsed.value;
    if (collapsed) return null;

    const path = currentPath.value;
    const indent = depth * 12 + 30;

    return html`
        ${dirs.map(dir => {
            const childSubpath = subpath ? subpath + '/' + dir.name : dir.name;
            const isActive = path.startsWith(`/resources/${folderIndex}`) && resourceSubpath.value === childSubpath;
            const childNode = getResourceTreeNode(folderIndex, childSubpath);
            const isLoading = childNode?.loading;

            return html`
                <div key=${childSubpath}>
                    <button
                        onclick=${() => { resourceSubpath.value = childSubpath; sidebarOpen.value = false; route('/resources/' + folderIndex); }}
                        class="flex items-center w-full mx-[8px] gap-1.5 py-[5px] px-[6px] rounded-md text-[12px] transition-colors ${
                            isActive ? 'bg-border-light text-text font-semibold' : 'hover:bg-border-light text-text-secondary'
                        }"
                        style="width: calc(100% - 16px); padding-left: ${indent}px"
                    >
                        <span
                            onclick=${(e) => { e.stopPropagation(); e.preventDefault(); toggleResourceFolder(folderIndex, childSubpath); }}
                            class="shrink-0 p-0.5 rounded hover:bg-border transition-colors text-text-muted cursor-pointer"
                        >
                            <${childNode?.expanded ? ChevronDown : ChevronRight} size=${11} />
                        </span>
                        ${isLoading
                            ? html`<${Loader} size=${13} className="opacity-60 shrink-0" />`
                            : html`<${Folder} size=${13} className="${isActive ? 'opacity-100' : 'opacity-60'} shrink-0" />`
                        }
                        <span class="truncate">${capitalize(dir.name)}</span>
                    </button>
                    <${ResourceSubfolderTree} folderIndex=${folderIndex} subpath=${childSubpath} depth=${depth + 1} nav=${nav} />
                </div>
            `;
        })}
    `;
}

export function Sidebar() {
    const cfg = config.value;
    const path = currentPath.value;
    const collapsed = sidebarCollapsed.value;
    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState('content');
    const [licenseModalOpen, setLicenseModalOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(null);
    const menuRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(e) {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(null);
            }
        }
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    async function handleLogout() {
        await api('logout', { method: 'POST' });
        user.value = null;
        config.value = null;
        sidebarOpen.value = false;
        route('/login');
    }

    function nav(path) {
        sidebarOpen.value = false;
        route(path);
    }

    function isActive(prefix) {
        return path.startsWith(prefix);
    }

    async function handleFolderSelect({ path, label }) {
        const action = modalType === 'content' ? 'folders.add' : 'resourceFolders.add';
        const res = await api(action, {
            method: 'POST',
            body: { label, path },
        });
        if (res && !res._error) {
            if (res.config) config.value = res.config;
            if (res.warning) {
                showFlash('warning', res.warning);
            } else {
                showFlash('success', res.message || t('common.folder_added'));
            }
            setModalOpen(false);
        }
    }

    function handleAddContent(e) {
        e.stopPropagation();
        if (!isLicensed.value && (cfg?.folders?.length || 0) >= 1) {
            setLicenseModalOpen(true);
        } else {
            setModalType('content');
            setModalOpen(true);
        }
    }

    function handleAddResource(e) {
        e.stopPropagation();
        if (!isLicensed.value && (cfg?.resource_folders?.length || 0) >= 1) {
            setLicenseModalOpen(true);
        } else {
            setModalType('resources');
            setModalOpen(true);
        }
    }

    const initial = (user.value?.email || '?')[0].toUpperCase();
    const themeAllowed = featureEnabled('theme_customization');
    const webhooksAllowed = featureEnabled('webhooks');
    const aiAllowed = featureEnabled('ai');
    const mcpAllowed = featureEnabled('mcp_tokens');
    const apiAllowed = featureEnabled('api_tokens');
    // On mobile the sidebar is always full-width overlay; collapsed only applies on desktop
    const sidebarWidth = collapsed ? 'w-[240px] md:w-[60px]' : 'w-[240px]';

    return html`<${Fragment}>
        <aside class="fixed top-0 left-0 ${sidebarWidth} h-full bg-sidebar border-r border-border flex flex-col overflow-y-auto z-40 ${sidebarOpen.value ? 'translate-x-0 shadow-lg' : '-translate-x-full'} md:translate-x-0 md:shadow-none transition-all duration-200">

            <!-- Header: Logo + collapse toggle -->
            <div class="px-[14px] pt-3.5 pb-1 flex items-center justify-between ${collapsed ? 'md:justify-center' : ''}">
                <div class="${collapsed ? 'md:hidden' : ''}">${
            siteLogo.value && siteLogoDark.value
                ? html`<${Fragment}>
                    <img src="${siteLogo.value}" alt="${siteName.value}" class="h-6 dark:hidden" />
                    <img src="${siteLogoDark.value}" alt="${siteName.value}" class="h-6 hidden dark:block" />
                <//>`
                : siteLogo.value
                    ? html`<img src="${siteLogo.value}" alt="${siteName.value}" class="h-6" />`
                    : siteLogoDark.value
                        ? html`<img src="${siteLogoDark.value}" alt="${siteName.value}" class="h-6" />`
                        : html`<span class="text-[14px] font-bold text-text truncate">${siteName.value || 'Elements CMS'}</span>`
        }</div>
                <div class="flex items-center gap-1">
                    <button onclick=${() => sidebarOpen.value = false}
                        class="md:hidden text-text-muted hover:text-text p-1 rounded transition-colors">
                        <${X} size=${16} />
                    </button>
                    <button onclick=${() => { sidebarCollapsed.value = !sidebarCollapsed.value; }}
                        class="hidden md:flex text-text-muted hover:text-text p-1 rounded transition-colors" title="${collapsed ? t('sidebar.expand') : t('sidebar.collapse')}">
                        <${PanelLeft} size=${16} />
                    </button>
                </div>
            </div>

            <nav class="flex-1 mt-1 flex flex-col">

                <!-- Content section -->
                ${(cfg?.folders?.length > 0 || isAdmin.value) && html`
                    <div class="mb-6">
                        <${SectionHeader}
                            label=${t('sidebar.content')}
                            onAdd=${isAdmin.value ? handleAddContent : null}
                        />
                        ${(cfg?.folders || []).map(f => {
                            const rootNode = getTreeNode(f.index, '');
                            const isLoading = rootNode?.loading;
                            const folderIcon = isLoading ? Loader : Folder;
                            return html`
                            <div key=${`folder-${f.index}`}>
                                <${NavItem}
                                    icon=${folderIcon}
                                    label=${f.label}
                                    onClick=${() => { contentSubpath.value = ''; nav(`/files/${f.index}`); }}
                                    isActiveFn=${() => isActive(`/files/${f.index}`)}
                                    chevron=${isLicensed.value && !collapsed}
                                    chevronExpanded=${rootNode?.expanded}
                                    onChevronClick=${() => toggleFolder(f.index, '')}
                                />
                                ${isLicensed.value && !collapsed && html`
                                    <${SubfolderTree} folderIndex=${f.index} subpath="" depth=${0} nav=${nav} />
                                `}
                            </div>
                        `})}
                    </div>
                `}

                <!-- Resources section -->
                ${(cfg?.resource_folders?.length > 0 || isAdmin.value) && html`
                    <div class="mb-6">
                        <${SectionHeader}
                            label=${t('sidebar.resources')}
                            onAdd=${isAdmin.value ? handleAddResource : null}
                        />
                        ${(cfg?.resource_folders || []).map(uf => {
                            const rootNode = getResourceTreeNode(uf.index, '');
                            const isLoading = rootNode?.loading;
                            const folderIcon = isLoading ? Loader : Folder;
                            return html`
                            <div key=${`resource-folder-${uf.index}`}>
                                <${NavItem}
                                    icon=${folderIcon}
                                    label=${uf.label}
                                    onClick=${() => { resourceSubpath.value = ''; resourcesActiveTab.value = 'content'; nav(`/resources/${uf.index}`); }}
                                    isActiveFn=${() => isActive(`/resources/${uf.index}`)}
                                    actions=${isAdmin.value ? [{ label: t('common.settings'), onClick: () => { resourceSubpath.value = ''; resourcesActiveTab.value = 'settings'; nav(`/resources/${uf.index}`); } }] : null}
                                    menuId=${`resource-${uf.index}`}
                                    menuOpen=${menuOpen}
                                    setMenuOpen=${setMenuOpen}
                                    menuRef=${menuRef}
                                    chevron=${isLicensed.value && !collapsed}
                                    chevronExpanded=${rootNode?.expanded}
                                    onChevronClick=${() => toggleResourceFolder(uf.index, '')}
                                />
                                ${isLicensed.value && !collapsed && html`
                                    <${ResourceSubfolderTree} folderIndex=${uf.index} subpath="" depth=${0} nav=${nav} />
                                `}
                            </div>
                        `})}
                    </div>
                `}

                <!-- Team section (admin only) -->
                ${isAdmin.value && html`
                    <div class="mb-6">
                        <${SectionHeader} label=${t('sidebar.team')} />
                        <${NavItem}
                            icon=${Users}
                            label=${t('sidebar.members')}
                            onClick=${() => nav('/users')}
                            isActiveFn=${() => isActive('/users')}
                        />
                    </div>
                `}

                <!-- Workspace section (owner only settings + license) -->
                ${isOwner.value && html`
                    <div class="mb-6">
                        <${SectionHeader} label=${t('sidebar.workspace')} />
                        <${NavItem}
                            icon=${Settings}
                            label=${t('sidebar.general')}
                            onClick=${() => nav('/settings')}
                            isActiveFn=${() => isActive('/settings')}
                            locked=${!themeAllowed}
                        />
                        <${NavItem}
                            icon=${Webhook}
                            label=${t('sidebar.webhooks')}
                            onClick=${() => nav('/webhooks')}
                            isActiveFn=${() => isActive('/webhooks')}
                            locked=${!webhooksAllowed}
                        />
                        <${NavItem}
                            icon=${Sparkles}
                            label=${t('sidebar.ai')}
                            onClick=${() => nav('/ai')}
                            isActiveFn=${() => isActive('/ai')}
                            locked=${!aiAllowed && !mcpAllowed}
                        />
                        <${NavItem}
                            icon=${Key}
                            label=${t('sidebar.api')}
                            onClick=${() => nav('/api')}
                            isActiveFn=${() => isActive('/api')}
                            locked=${!apiAllowed}
                        />
                        <${NavItem}
                            icon=${Shield}
                            label=${t('sidebar.license')}
                            onClick=${() => nav('/license')}
                            isActiveFn=${() => isActive('/license')}
                        />
                    </div>
                `}
            </nav>

            <!-- User footer -->
            <div class="px-3 py-3">
                <button onclick=${() => nav('/account')}
                    class="w-full flex items-center gap-2.5 ${collapsed ? 'md:justify-center md:gap-0' : ''} px-2 py-1.5 rounded-md hover:bg-border-light transition-colors">
                    <div class="w-[28px] h-[28px] rounded-full bg-accent flex items-center justify-center text-white text-[11px] font-semibold shrink-0">
                        ${initial}
                    </div>
                    <div class="flex-1 text-left min-w-0 ${collapsed ? 'md:hidden' : ''}">
                        <div class="text-[13px] text-text font-medium truncate">${user.value?.email}</div>
                    </div>
                    <${ChevronDown} size=${14} className="text-text-muted shrink-0 ${collapsed ? 'md:hidden' : ''}" />
                </button>
            </div>
        </aside>
        <${FolderBrowserModal}
            open=${modalOpen}
            onClose=${() => setModalOpen(false)}
            title=${modalType === 'content' ? t('sidebar.add_content') : t('sidebar.add_resource')}
            onSelect=${handleFolderSelect}
        />
        <${LicenseRequiredModal}
            open=${licenseModalOpen}
            onClose=${() => setLicenseModalOpen(false)}
        />
    <//>`;
}
