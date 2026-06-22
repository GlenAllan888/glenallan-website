import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { api } from '../api.js?v=20260538';
import { t, setLocale, availableLocales } from '../i18n.js?v=20260538';
import { user, showFlash } from '../state.js?v=20260538';
import { route } from '../router.js?v=20260538';
import { SectionLayout } from '../components/SectionLayout.js?v=20260538';
import { PageHeader } from '../components/PageHeader.js?v=20260538';
import { UserIcon } from '../icons.js?v=20260538';
import { supportsPasskeys, registerPasskey } from '../webauthn.js?v=20260538';

const html = htm.bind(h);

const inputClass = 'w-full h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50';
const labelClass = 'block text-sm font-medium leading-none mb-2';

function formatRelative(ts) {
    if (!ts) return '';
    const diff = Math.max(0, Math.floor(Date.now() / 1000) - ts);
    if (diff < 60) return t('account.passkey_just_now');
    if (diff < 3600) return t('account.passkey_minutes_ago', { n: Math.floor(diff / 60) });
    if (diff < 86400) return t('account.passkey_hours_ago', { n: Math.floor(diff / 3600) });
    if (diff < 86400 * 30) return t('account.passkey_days_ago', { n: Math.floor(diff / 86400) });
    return new Date(ts * 1000).toLocaleDateString();
}

export function Account() {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [language, setLanguage] = useState(user.value?.language || 'en');
    const [passkeys, setPasskeys] = useState([]);
    const [passkeyBusy, setPasskeyBusy] = useState(false);
    const canUsePasskey = supportsPasskeys();

    const email = user.value?.email || '';
    const role = user.value?.role || '';
    const initial = email.charAt(0).toUpperCase();

    useEffect(() => {
        loadPasskeys();
    }, []);

    async function loadPasskeys() {
        const result = await api('passkey.list', { silent: true });
        if (result && !result._error && Array.isArray(result.passkeys)) {
            setPasskeys(result.passkeys);
        }
    }

    async function handleAddPasskey() {
        const name = prompt(t('account.passkey_name_prompt'), t('account.passkey_default_name'));
        if (name === null) return;
        const trimmed = name.trim() || t('account.passkey_default_name');
        setPasskeyBusy(true);
        try {
            await registerPasskey(trimmed);
            showFlash('success', t('account.passkey_added'));
            await loadPasskeys();
        } catch (err) {
            if (!err || (err.name !== 'NotAllowedError' && err.name !== 'AbortError')) {
                showFlash('error', t('account.passkey_add_failed'));
            }
        } finally {
            setPasskeyBusy(false);
        }
    }

    async function handleRenamePasskey(id, currentName) {
        const name = prompt(t('account.passkey_rename_prompt'), currentName);
        if (name === null) return;
        const trimmed = name.trim();
        if (trimmed === '' || trimmed === currentName) return;
        const result = await api('passkey.rename', {
            method: 'POST',
            body: { id, name: trimmed },
        });
        if (result && !result._error) {
            showFlash('success', t('account.passkey_renamed'));
            await loadPasskeys();
        }
    }

    async function handleDeletePasskey(id, name) {
        if (!confirm(t('account.passkey_delete_confirm', { name }))) return;
        const result = await api('passkey.delete', {
            method: 'POST',
            body: { id },
        });
        if (result && !result._error) {
            showFlash('success', t('account.passkey_removed'));
            await loadPasskeys();
        }
    }

    async function handleChangePassword(e) {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            showFlash('error', t('account.password_mismatch'));
            return;
        }

        setSubmitting(true);
        try {
            const result = await api('password.change', {
                method: 'POST',
                body: { current_password: currentPassword, new_password: newPassword, confirm_password: confirmPassword }
            });
            if (result) {
                showFlash('success', t('account.password_updated'));
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            }
        } finally {
            setSubmitting(false);
        }
    }

    async function handleLanguageChange(newLang) {
        const prev = language;
        setLanguage(newLang);
        setLocale(newLang);
        const result = await api('account.language', {
            method: 'POST',
            body: { language: newLang }
        });
        if (result && !result._error) {
            user.value = { ...user.value, language: newLang };
            showFlash('success', t('account.language_updated'));
        } else {
            setLanguage(prev);
            setLocale(prev);
        }
    }

    async function handleLogout() {
        await api('logout', { method: 'POST' });
        user.value = null;
        route('/login');
    }

    return html`
        <div>
            <${PageHeader} title=${t('account.title')} subtitle=${t('account.subtitle')} icon=${html`<${UserIcon} />`} />

            <div class="max-w-3xl">
                <${SectionLayout} title=${t('account.profile')} description=${t('account.profile_desc')}>
                    <div class="flex flex-col items-center gap-2 mb-2">
                        <div class="w-[64px] h-[64px] rounded-full bg-accent flex items-center justify-center">
                            <span class="text-white text-[24px] font-semibold">${initial}</span>
                        </div>
                        <div class="text-center">
                            <div class="text-[14px] font-bold text-text">${email}</div>
                            <div class="text-[11px] text-text-muted">${role}</div>
                        </div>
                    </div>
                    <div>
                        <label class="${labelClass}">${t('common.email')}</label>
                        <input type="email" value=${email} disabled class="${inputClass} opacity-60 cursor-not-allowed" />
                    </div>
                <//>

                <${SectionLayout} title=${t('account.language')} description=${t('account.language_desc')}>
                    <div>
                        <select
                            value=${language}
                            onChange=${e => handleLanguageChange(e.target.value)}
                            class="${inputClass}"
                        >
                            ${availableLocales.map(l => html`<option value=${l.code}>${l.label}</option>`)}
                        </select>
                    </div>
                <//>

                <${SectionLayout} title=${t('account.passkeys')} description=${t('account.passkeys_desc')}>
                    ${!canUsePasskey && html`
                        <p class="text-sm text-text-muted">${t('account.passkeys_unsupported')}</p>
                    `}
                    ${canUsePasskey && html`
                        <div class="flex flex-col gap-2 mb-3">
                            ${passkeys.length === 0 && html`
                                <p class="text-sm text-text-muted">${t('account.no_passkeys')}</p>
                            `}
                            ${passkeys.map(pk => html`
                                <div class="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-surface">
                                    <div class="flex-1 min-w-0">
                                        <div class="text-sm font-medium text-text truncate">${pk.name}</div>
                                        <div class="text-xs text-text-muted">
                                            ${pk.last_used_at
                                                ? t('account.passkey_last_used', { when: formatRelative(pk.last_used_at) })
                                                : t('account.passkey_never_used')}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick=${() => handleRenamePasskey(pk.id, pk.name)}
                                        class="px-2.5 py-1 text-[12px] text-text-secondary hover:text-text rounded-btn"
                                    >
                                        ${t('common.edit')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick=${() => handleDeletePasskey(pk.id, pk.name)}
                                        class="px-2.5 py-1 text-[12px] text-danger hover:opacity-80 rounded-btn"
                                    >
                                        ${t('common.delete')}
                                    </button>
                                </div>
                            `)}
                        </div>
                        <button
                            type="button"
                            onClick=${handleAddPasskey}
                            disabled=${passkeyBusy}
                            class="px-3.5 py-1.5 bg-accent text-white rounded-btn text-[12px] font-medium hover:opacity-90 disabled:opacity-50"
                        >
                            ${passkeyBusy ? t('account.passkey_adding') : t('account.add_passkey')}
                        </button>
                    `}
                <//>

                <${SectionLayout} title=${t('account.password')} description=${t('account.password_desc')}>
                    <form onSubmit=${handleChangePassword} class="flex flex-col gap-3">
                        <div>
                            <label class="${labelClass}">${t('account.current_password')}</label>
                            <input type="password" value=${currentPassword} onInput=${e => setCurrentPassword(e.target.value)} class="${inputClass}" />
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="${labelClass}">${t('account.new_password')}</label>
                                <input type="password" value=${newPassword} onInput=${e => setNewPassword(e.target.value)} class="${inputClass}" />
                            </div>
                            <div>
                                <label class="${labelClass}">${t('account.confirm_password')}</label>
                                <input type="password" value=${confirmPassword} onInput=${e => setConfirmPassword(e.target.value)} class="${inputClass}" />
                            </div>
                        </div>
                        <div>
                            <button type="submit" disabled=${submitting} class="px-3.5 py-1.5 bg-accent text-white rounded-btn text-[12px] font-medium hover:opacity-90 disabled:opacity-50">
                                ${submitting ? t('account.updating') : t('account.update_password')}
                            </button>
                        </div>
                    </form>
                <//>

                <${SectionLayout} title=${t('account.sign_out')} description=${t('account.sign_out_desc')} last=${true}>
                    <div>
                        <button onClick=${handleLogout} class="px-3.5 py-1.5 bg-surface border border-danger text-danger rounded-btn text-[12px] font-medium hover:bg-red-50">
                            ${t('account.sign_out')}
                        </button>
                    </div>
                <//>
            </div>
        </div>
    `;
}
