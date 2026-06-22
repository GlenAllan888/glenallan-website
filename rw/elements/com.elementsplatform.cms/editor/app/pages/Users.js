import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { api } from '../api.js?v=20260538';
import { user, showFlash, isLicensed, isOwner, config } from '../state.js?v=20260538';
import { goToPurchase } from '../license-actions.js?v=20260538';
import { Shield, ExternalLink, Check, Minus, Trash2, Plus } from '../icons.js?v=20260538';
import { SectionLayout } from '../components/SectionLayout.js?v=20260538';
import { PageHeader } from '../components/PageHeader.js?v=20260538';
import { CardSelector } from '../components/CardSelector.js?v=20260538';
import { Modal } from '../components/Modal.js?v=20260538';
import { t } from '../i18n.js?v=20260538';

const html = htm.bind(h);

const AVATAR_COLORS = ['rgb(var(--accent))', '#10b981', '#f59e0b'];

function UserAvatar({ email, index }) {
    const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
    const initial = (email || '?')[0].toUpperCase();
    return html`
        <div class="shrink-0 flex items-center justify-center rounded-full text-white font-medium"
             style="width:36px;height:36px;font-size:14px;background:${color}">
            ${initial}
        </div>
    `;
}

export function UsersList() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState(null);
    const [editRole, setEditRole] = useState('');
    const [editPassword, setEditPassword] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState('editor');
    const [submitting, setSubmitting] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);

    async function load() {
        setLoading(true);
        const res = await api('users.list');
        if (res && !res._error) {
            setUsers(res.users);
        }
        setLoading(false);
    }

    useEffect(() => { load(); }, []);

    function startEdit(u) {
        setEditingUser(u.email);
        setEditRole(u.role);
        setEditPassword('');
    }

    function cancelEdit() {
        setEditingUser(null);
        setEditRole('');
        setEditPassword('');
    }

    async function saveEdit(email) {
        setSubmitting(true);
        const body = { email, role: editRole };
        if (editPassword) body.password = editPassword;
        const res = await api('users.update', { method: 'POST', body });
        setSubmitting(false);
        if (res && !res._error) {
            showFlash('success', t('users.updated'));
            cancelEdit();
            load();
        }
    }

    async function handleDelete(email) {
        if (email === user.value.email) {
            showFlash('error', t('users.delete_self_error'));
            return;
        }
        if (!confirm(t('users.delete_confirm', { name: email }))) return;
        const res = await api('users.delete', { method: 'POST', body: { email } });
        if (res && !res._error) {
            showFlash('success', t('users.deleted'));
            load();
        }
    }

    async function handleCreate(e) {
        e.preventDefault();
        setSubmitting(true);
        const res = await api('users.create', {
            method: 'POST',
            body: { email: newEmail, password: newPassword, role: newRole },
        });
        setSubmitting(false);
        if (res && !res._error) {
            showFlash('success', t('users.created'));
            setNewEmail('');
            setNewPassword('');
            setNewRole('editor');
            setShowAddModal(false);
            if (res.users) {
                setUsers(res.users);
            }
        }
    }

    function handlePurchase() {
        goToPurchase();
    }

    if (loading) {
        return html`<div class="flex items-center justify-center py-20 text-text-secondary">${t('common.loading')}</div>`;
    }

    const roleOptions = [
        { value: 'editor', title: t('users.editor'), description: t('users.editor_desc') },
        { value: 'admin', title: t('users.admin'), description: t('users.admin_desc') },
        ...(isOwner.value ? [{ value: 'owner', title: t('users.owner'), description: t('users.owner_desc') }] : []),
    ];

    const ownerCount = users.filter(u => u.role === 'owner').length;

    const clampedFeatures = config.value?.clamped_features ?? [];
    const usersClamped = clampedFeatures.includes('users');
    const survivingUser = config.value?.users_surviving ?? null;
    const clampedCount = usersClamped ? users.filter(u => u.email !== survivingUser).length : 0;

    // Per-tier user cap from the signed limits payload (free defaults applied
    // server-side when no payload). null = unlimited; integer = inclusive cap.
    const limits = config.value?.limits ?? null;
    const maxUsers = limits === null
        ? 1
        : (Object.prototype.hasOwnProperty.call(limits, 'max_users') ? limits.max_users : null);
    const atUserCap = maxUsers !== null && users.length >= maxUsers;

    const permissions = [
        { label: t('users.perm_create_posts'), editor: true, admin: true, owner: true },
        { label: t('users.perm_edit_posts'), editor: true, admin: true, owner: true },
        { label: t('users.perm_manage_resources'), editor: true, admin: true, owner: true },
        { label: t('users.perm_version_history'), editor: true, admin: true, owner: true },
        { label: t('users.perm_manage_folders'), editor: false, admin: true, owner: true },
        { label: t('users.perm_manage_users'), editor: false, admin: true, owner: true },
        { label: t('users.perm_site_appearance'), editor: false, admin: false, owner: true },
        { label: t('users.perm_manage_webhooks'), editor: false, admin: false, owner: true },
        { label: t('users.perm_ai_mcp'), editor: false, admin: false, owner: true },
        { label: t('users.perm_manage_license'), editor: false, admin: false, owner: true },
        { label: t('users.perm_manage_owners'), editor: false, admin: false, owner: true },
    ];

    return html`
        <div class="max-w-3xl">
            <${PageHeader} title=${t('users.title')} subtitle=${t('users.subtitle')} />

            <div>
                ${usersClamped && html`
                    <div class="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <div class="flex items-start gap-3">
                            <div class="shrink-0 mt-0.5">
                                <${Shield} size=${18} className="text-amber-700" />
                            </div>
                            <div class="flex-1">
                                <div class="text-[13px] font-semibold text-amber-900">${t('users.clamp_banner_title')}</div>
                                <div class="text-[12px] text-amber-800 mt-0.5">${t('users.clamp_banner_desc', { count: clampedCount })}</div>
                            </div>
                        </div>
                    </div>
                `}

                <!-- Team Section -->
                <${SectionLayout} title=${t('users.team')} description=${t('users.team_desc')}>
                    <div>
                        ${users.map((u, i) => {
                            const isFirst = i === 0;
                            const isLast = i === users.length - 1;
                            const borderClass = isFirst && isLast
                                ? 'rounded-[8px] border'
                                : isFirst
                                    ? 'rounded-t-[8px] border'
                                    : isLast
                                        ? 'rounded-b-[8px] border-x border-b'
                                        : 'border-x border-b';

                            if (editingUser === u.email) {
                                return html`
                                    <div key=${u.email} class="bg-surface ${borderClass} border-border">
                                        <div class="flex items-center gap-3.5 px-4 py-3.5">
                                            <${UserAvatar} email=${u.email} index=${i} />
                                            <div class="flex-1 min-w-0">
                                                <div class="text-[13px] font-bold text-text">${u.email}</div>
                                                <div class="text-[11px] text-text-muted">${u.role}</div>
                                            </div>
                                        </div>
                                        <div class="px-4 pb-3.5">
                                            <div class="grid grid-cols-2 gap-3 mb-3">
                                                <div>
                                                    <label class="block text-sm font-medium leading-none mb-2">${t('common.role')}</label>
                                                    <select
                                                        value=${editRole}
                                                        onChange=${e => setEditRole(e.target.value)}
                                                        class="w-full h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20"
                                                    >
                                                        <option value="editor">editor</option>
                                                        <option value="admin">admin</option>
                                                        ${(isOwner.value || u.role === 'owner') && html`<option value="owner">owner</option>`}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label class="block text-sm font-medium leading-none mb-2">${t('users.new_password')}</label>
                                                    <input
                                                        type="password"
                                                        placeholder=${t('users.optional')}
                                                        value=${editPassword}
                                                        onInput=${e => setEditPassword(e.target.value)}
                                                        class="w-full h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20"
                                                    />
                                                </div>
                                            </div>
                                            <div class="flex items-center">
                                                <button
                                                    onClick=${() => handleDelete(u.email)}
                                                    class="px-3.5 py-1.5 text-red-500 hover:bg-red-50 rounded-btn text-[12px] font-medium flex items-center gap-1"
                                                >
                                                    <${Trash2} size=${13} />
                                                    ${t('common.delete')}
                                                </button>
                                                <div class="ml-auto flex items-center gap-2">
                                                    <button
                                                        onClick=${cancelEdit}
                                                        class="px-3.5 py-1.5 bg-bg hover:bg-border/30 text-text-secondary rounded-btn text-[12px] font-medium"
                                                    >
                                                        ${t('common.cancel')}
                                                    </button>
                                                    <button
                                                        onClick=${() => saveEdit(u.email)}
                                                        disabled=${submitting}
                                                        class="px-3.5 py-1.5 bg-accent hover:bg-accent-dark text-white rounded-btn text-[12px] font-medium disabled:opacity-50"
                                                    >
                                                        ${t('common.save')}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }

                            const isClamped = usersClamped && u.email !== survivingUser;
                            return html`
                                <div key=${u.email} class="bg-surface ${borderClass} border-border ${isClamped ? 'opacity-60' : ''}">
                                    <div class="flex items-center gap-3.5 px-4 py-3.5">
                                        <${UserAvatar} email=${u.email} index=${i} />
                                        <div class="flex-1 min-w-0">
                                            <div class="text-[13px] font-bold text-text flex items-center gap-2">
                                                ${u.email}
                                                ${isClamped && html`
                                                    <span class="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-medium">
                                                        ${t('users.disabled_on_free')}
                                                    </span>
                                                `}
                                            </div>
                                            <div class="text-[11px] text-text-muted">${u.role}</div>
                                        </div>
                                        ${(() => {
                                            const canEdit = !isClamped && !usersClamped && (u.role !== 'owner' || isOwner.value);
                                            const canDelete = u.email !== user.value?.email
                                                && (u.role !== 'owner' || (isOwner.value && ownerCount > 1));
                                            if (!canEdit && !canDelete) return null;
                                            return html`
                                                <div class="flex items-center gap-1">
                                                    ${canDelete && html`
                                                        <button
                                                            onClick=${() => handleDelete(u.email)}
                                                            class="px-2.5 py-1 text-text-muted hover:text-red-500 rounded-btn hover:bg-red-50 transition-colors text-[12px] font-medium"
                                                        >
                                                            ${t('common.delete')}
                                                        </button>
                                                    `}
                                                    ${canEdit && html`
                                                        <button
                                                            onClick=${() => startEdit(u)}
                                                            class="px-2.5 py-1 text-text-muted hover:text-text rounded-btn hover:bg-bg transition-colors text-[12px] font-medium"
                                                        >
                                                            ${t('common.edit')}
                                                        </button>
                                                    `}
                                                </div>
                                            `;
                                        })()}
                                    </div>
                                </div>
                            `;
                        })}
                    </div>
                    <div class="mt-3">
                        <button
                            onClick=${() => setShowAddModal(true)}
                            disabled=${atUserCap}
                            title=${atUserCap ? t('users.at_cap_tooltip', { count: maxUsers }) : ''}
                            class="px-3.5 py-1.5 bg-accent hover:bg-accent-dark text-white rounded-btn text-[12px] font-medium inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-accent"
                        >
                            <${Plus} size=${14} />
                            ${t('users.add')}
                        </button>
                        ${atUserCap && html`
                            <span class="ml-2 text-[12px] text-text-muted">${t('users.at_cap_tooltip', { count: maxUsers })}</span>
                        `}
                    </div>
                <//>

                <${Modal} open=${showAddModal} onClose=${() => setShowAddModal(false)} title=${t('users.add')}>
                    <div class="p-5">
                        ${isLicensed.value ? html`
                            <form onSubmit=${handleCreate}>
                                <div class="grid grid-cols-2 gap-3 mb-3">
                                    <div>
                                        <label class="block text-sm font-medium leading-none mb-2">${t('common.email')}</label>
                                        <input
                                            type="email"
                                            value=${newEmail}
                                            onInput=${e => setNewEmail(e.target.value)}
                                            autocomplete="off"
                                            required
                                            class="w-full h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20"
                                        />
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium leading-none mb-2">${t('common.password')}</label>
                                        <input
                                            type="password"
                                            value=${newPassword}
                                            onInput=${e => setNewPassword(e.target.value)}
                                            required
                                            class="w-full h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20"
                                        />
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="block text-sm font-medium leading-none mb-2">${t('common.role')}</label>
                                    <${CardSelector}
                                        options=${roleOptions}
                                        value=${newRole}
                                        onChange=${v => setNewRole(v)}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled=${submitting}
                                    class="px-3.5 py-1.5 bg-accent hover:bg-accent-dark text-white rounded-btn text-[12px] font-medium disabled:opacity-50"
                                >
                                    ${submitting ? t('common.creating') : t('users.create_user')}
                                </button>
                            </form>
                        ` : html`
                            <div class="rounded-xl border border-accent-light bg-accent-light p-6 text-center">
                                <div class="flex justify-center mb-3">
                                    <div class="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                                        <${Shield} size=${24} className="text-accent-dark" />
                                    </div>
                                </div>
                                <h2 class="text-base font-semibold text-accent-dark mb-1">${t('common.license_required')}</h2>
                                <p class="text-sm text-accent-dark mb-4">${t('users.license_required_desc')}</p>
                                ${isOwner.value && html`
                                    <button
                                        onclick=${handlePurchase}
                                        class="inline-flex items-center gap-1.5 px-4 py-2 bg-accent-dark hover:bg-accent-dark text-white text-sm font-medium rounded-lg transition-colors"
                                    >
                                        <${ExternalLink} size=${14} />
                                        ${t('common.purchase_license')}
                                    </button>
                                `}
                            </div>
                        `}
                    </div>
                <//>

                <!-- Roles Section -->
                <${SectionLayout} title=${t('users.roles')} description=${t('users.roles_desc')} last=${true}>
                    <div class="border border-border rounded-[8px] overflow-hidden">
                        <table class="w-full text-[13px]">
                            <thead>
                                <tr class="border-b border-border bg-bg">
                                    <th class="text-left px-4 py-2.5 font-medium text-text-secondary">${t('users.permission')}</th>
                                    <th class="text-center px-4 py-2.5 font-medium text-text-secondary">${t('users.editor')}</th>
                                    <th class="text-center px-4 py-2.5 font-medium text-text-secondary">${t('users.admin')}</th>
                                    <th class="text-center px-4 py-2.5 font-medium text-text-secondary">${t('users.owner')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${permissions.map((p, i) => html`
                                    <tr key=${p.label} class="${i < permissions.length - 1 ? 'border-b border-border' : ''}">
                                        <td class="px-4 py-2.5 text-text">${p.label}</td>
                                        <td class="px-4 py-2.5 text-center">
                                            ${p.editor
                                                ? html`<${Check} size=${16} className="inline-block text-success" />`
                                                : html`<${Minus} size=${16} className="inline-block text-text-muted" />`
                                            }
                                        </td>
                                        <td class="px-4 py-2.5 text-center">
                                            ${p.admin
                                                ? html`<${Check} size=${16} className="inline-block text-success" />`
                                                : html`<${Minus} size=${16} className="inline-block text-text-muted" />`
                                            }
                                        </td>
                                        <td class="px-4 py-2.5 text-center">
                                            ${p.owner
                                                ? html`<${Check} size=${16} className="inline-block text-success" />`
                                                : html`<${Minus} size=${16} className="inline-block text-text-muted" />`
                                            }
                                        </td>
                                    </tr>
                                `)}
                            </tbody>
                        </table>
                    </div>
                <//>
            </div>
        </div>
    `;
}
