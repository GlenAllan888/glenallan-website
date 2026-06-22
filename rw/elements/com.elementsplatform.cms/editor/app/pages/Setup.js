import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { route } from '../router.js?v=20260538';
import { api } from '../api.js?v=20260538';
import { user, csrf, config } from '../state.js?v=20260538';
import { FolderBrowserModal } from '../components/FolderBrowserModal.js?v=20260538';
import { t, setLocale, availableLocales } from '../i18n.js?v=20260538';

const html = htm.bind(h);

const CHECK_LABELS = {
    php_version:      'setup.req.php_version',
    ext_json:         'setup.req.ext_json',
    ext_session:      'setup.req.ext_session',
    ext_curl:         'setup.req.ext_curl',
    ext_mbstring:     'setup.req.ext_mbstring',
    ext_fileinfo:     'setup.req.ext_fileinfo',
    composer:         'setup.req.composer',
    config_writable:  'setup.req.config_writable',
};

export function Setup() {
    const [requirements, setRequirements] = useState(null); // null=loading, {ok, checks}
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [folders, setFolders] = useState([{ label: '', path: '' }]);
    const [resourceFolders, setResourceFolders] = useState([{ label: 'Resources', path: '' }]);
    const [errors, setErrors] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [browseOpen, setBrowseOpen] = useState(false);
    const [browseTarget, setBrowseTarget] = useState(null); // { type: 'content'|'resources', index }
    const [language, setLanguage] = useState('en');

    useEffect(() => {
        api('setup.requirements', { silent: true }).then(data => {
            if (data && data.checks) {
                setRequirements(data);
            } else {
                setRequirements({ ok: false, checks: [] });
            }
        });
    }, []);

    function openBrowser(type, index) {
        setBrowseTarget({ type, index });
        setBrowseOpen(true);
    }

    function handleBrowseSelect({ path, displayPath, label }) {
        if (!browseTarget) return;
        if (browseTarget.type === 'content') {
            setFolders(prev => prev.map((f, i) => i === browseTarget.index
                ? { ...f, path, displayPath: displayPath || path, label: f.label || label }
                : f
            ));
        } else {
            setResourceFolders(prev => prev.map((f, i) => i === browseTarget.index
                ? { ...f, path, displayPath: displayPath || path, label: f.label || label }
                : f
            ));
        }
        setBrowseOpen(false);
    }

    function updateFolder(index, field, value) {
        setFolders(prev => prev.map((f, i) => i === index
            ? { ...f, [field]: value, ...(field === 'path' ? { displayPath: value } : {}) }
            : f
        ));
    }

    function updateResourceFolder(index, field, value) {
        setResourceFolders(prev => prev.map((f, i) => i === index
            ? { ...f, [field]: value, ...(field === 'path' ? { displayPath: value } : {}) }
            : f
        ));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setErrors([]);
        setSubmitting(true);

        const data = await api('setup.complete', {
            method: 'POST',
            body: {
                email,
                password,
                password_confirm: passwordConfirm,
                folders,
                resource_folders: resourceFolders,
                language,
            },
            silent: true,
        });

        if (!data) {
            setErrors([t('common.network_error')]);
            setSubmitting(false);
            return;
        }

        if (data.errors) {
            setErrors(data.errors);
            setSubmitting(false);
            return;
        }

        if (data._error) {
            setErrors([data._error]);
            setSubmitting(false);
            return;
        }

        user.value = data.user;
        csrf.value = data.csrf;
        config.value = data.config;
        route('/welcome');
    }

    return html`
        <div class="min-h-screen flex items-center justify-center bg-bg px-4 py-12">
            <div class="w-full max-w-lg">
                <div class="text-center mb-8">
                    <h1 class="text-2xl font-bold text-text">${t('login.title')}</h1>
                    <p class="text-sm text-text-secondary mt-1">${t('setup.subtitle')}</p>
                </div>

                ${requirements === null && html`
                    <div class="bg-surface rounded-xl shadow-sm border border-border p-6 text-center text-sm text-text-secondary">
                        ${t('setup.checking_requirements')}
                    </div>
                `}

                ${requirements !== null && !requirements.ok && html`
                    <div class="bg-surface rounded-xl shadow-sm border border-border p-6 mb-6">
                        <p class="text-sm font-medium text-red-600 mb-4">${t('setup.requirements_failed')}</p>
                        <ul class="space-y-2">
                            ${requirements.checks.map(c => html`
                                <li class="flex items-center gap-2 text-sm">
                                    <span class=${c.pass ? 'text-green-600' : 'text-red-600'}>${c.pass ? '\u2713' : '\u2717'}</span>
                                    <span class=${c.pass ? 'text-text' : 'text-red-700 font-medium'}>
                                        ${t(CHECK_LABELS[c.name] || c.name)}${c.value ? ` (${c.value})` : ''}${c.required ? ` — ${c.required}` : ''}
                                    </span>
                                </li>
                            `)}
                        </ul>
                    </div>
                `}

                ${requirements !== null && requirements.ok && html`<div class="bg-surface rounded-xl shadow-sm border border-border p-6">
                    <div class="mb-6">
                        <p class="text-sm font-medium text-green-600 mb-4">${t('setup.requirements_passed')}</p>
                        <ul class="space-y-2">
                            ${requirements.checks.map(c => html`
                                <li class="flex items-center gap-2 text-sm">
                                    <span class="text-green-600">${'\u2713'}</span>
                                    <span class="text-text">
                                        ${t(CHECK_LABELS[c.name] || c.name)}${c.value ? ` (${c.value})` : ''}
                                    </span>
                                </li>
                            `)}
                        </ul>
                    </div>

                    ${errors.length > 0 && html`
                        <div class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-6">
                            <ul class="list-disc list-inside space-y-1">
                                ${errors.map(err => html`<li>${err}</li>`)}
                            </ul>
                        </div>
                    `}

                    <form onSubmit=${handleSubmit}>
                        <fieldset class="mb-6">
                            <legend class="text-sm font-semibold text-text mb-3">${t('setup.language')}</legend>
                            <select
                                value=${language}
                                onChange=${e => { setLanguage(e.target.value); setLocale(e.target.value); }}
                                class="w-full h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20"
                            >
                                ${availableLocales.map(l => html`<option value=${l.code}>${l.label}</option>`)}
                            </select>
                        </fieldset>

                        <fieldset class="mb-6">
                            <legend class="text-sm font-semibold text-text mb-3">${t('setup.admin_account')}</legend>

                            <div class="mb-3">
                                <label class="block text-sm font-medium leading-none mb-2" for="setup-email">
                                    ${t('common.email')}
                                </label>
                                <input
                                    id="setup-email"
                                    type="email"
                                    value=${email}
                                    onInput=${e => setEmail(e.target.value)}
                                    class="w-full h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20"
                                    autocomplete="email"
                                    required
                                />
                            </div>

                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-sm font-medium leading-none mb-2" for="setup-password">
                                        ${t('common.password')}
                                    </label>
                                    <input
                                        id="setup-password"
                                        type="password"
                                        value=${password}
                                        onInput=${e => setPassword(e.target.value)}
                                        class="w-full h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20"
                                        autocomplete="new-password"
                                        required
                                    />
                                </div>
                                <div>
                                    <label class="block text-sm font-medium leading-none mb-2" for="setup-password-confirm">
                                        ${t('setup.confirm_password')}
                                    </label>
                                    <input
                                        id="setup-password-confirm"
                                        type="password"
                                        value=${passwordConfirm}
                                        onInput=${e => setPasswordConfirm(e.target.value)}
                                        class="w-full h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20"
                                        autocomplete="new-password"
                                        required
                                    />
                                </div>
                            </div>
                        </fieldset>

                        <fieldset class="mb-6">
                            <legend class="text-sm font-semibold text-text mb-3">${t('setup.content_folders')}</legend>

                            <div class="space-y-2">
                                <input
                                    type="text"
                                    placeholder="${t('common.label')}"
                                    value=${folders[0].label}
                                    onInput=${e => updateFolder(0, 'label', e.target.value)}
                                    class="w-full h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20"
                                />
                                <div class="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="${t('common.path')}"
                                        value=${folders[0].displayPath ?? folders[0].path}
                                        onInput=${e => updateFolder(0, 'path', e.target.value)}
                                        class="flex-1 h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20"
                                    />
                                    <button
                                        type="button"
                                        onclick=${() => openBrowser('content', 0)}
                                        class="px-3 h-9 rounded-lg border border-border bg-surface text-sm text-text-secondary shadow-sm shadow-black/5 hover:bg-bg transition-colors whitespace-nowrap"
                                    >
                                        ${t('common.browse')}
                                    </button>
                                </div>
                            </div>
                        </fieldset>

                        <fieldset class="mb-6">
                            <legend class="text-sm font-semibold text-text mb-3">${t('setup.resource_folders')}</legend>

                            <div class="space-y-2">
                                <input
                                    type="text"
                                    placeholder="${t('common.label')}"
                                    value=${resourceFolders[0].label}
                                    onInput=${e => updateResourceFolder(0, 'label', e.target.value)}
                                    class="w-full h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20"
                                />
                                <div class="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="${t('common.path')}"
                                        value=${resourceFolders[0].displayPath ?? resourceFolders[0].path}
                                        onInput=${e => updateResourceFolder(0, 'path', e.target.value)}
                                        class="flex-1 h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20"
                                    />
                                    <button
                                        type="button"
                                        onclick=${() => openBrowser('resources', 0)}
                                        class="px-3 h-9 rounded-lg border border-border bg-surface text-sm text-text-secondary shadow-sm shadow-black/5 hover:bg-bg transition-colors whitespace-nowrap"
                                    >
                                        ${t('common.browse')}
                                    </button>
                                </div>
                            </div>
                        </fieldset>

                        <button
                            type="submit"
                            disabled=${submitting}
                            class="w-full py-2 px-4 bg-accent-dark hover:bg-accent-dark disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            ${submitting ? t('setup.completing') : t('setup.complete')}
                        </button>
                    </form>
                </div>`}
            </div>

            <${FolderBrowserModal}
                open=${browseOpen}
                onClose=${() => setBrowseOpen(false)}
                title=${browseTarget?.type === 'content' ? t('setup.browse_content') : t('setup.browse_resources')}
                browseAction="setup.browse"
                onSelect=${handleBrowseSelect}
            />
        </div>
    `;
}
