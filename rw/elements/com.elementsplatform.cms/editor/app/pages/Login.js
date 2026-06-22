import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';
import { route } from '../router.js?v=20260538';
import { api } from '../api.js?v=20260538';
import { user, csrf, config, license, siteName, siteLogo, siteLogoDark, showFlash } from '../state.js?v=20260538';
import { applyTheme } from '../theme.js?v=20260538';
import { t, setLocale } from '../i18n.js?v=20260538';
import { supportsPasskeys, loginWithPasskey } from '../webauthn.js?v=20260538';

const html = htm.bind(h);

export function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [passkeyBusy, setPasskeyBusy] = useState(false);
    const canUsePasskey = supportsPasskeys();
    const [mode, setMode] = useState(canUsePasskey ? 'passkey' : 'password');

    const [resetStep, setResetStep] = useState(null);
    const [resetEmail, setResetEmail] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [resetPath, setResetPath] = useState('');
    const [resetFilename, setResetFilename] = useState('');
    const [resetConfirmedUser, setResetConfirmedUser] = useState('');
    const [resetNewPassword, setResetNewPassword] = useState('');
    const [resetConfirmPassword, setResetConfirmPassword] = useState('');
    const [resetBusy, setResetBusy] = useState(false);

    function startReset() {
        setError('');
        setResetStep('email');
        setResetEmail(email);
        setResetToken('');
        setResetPath('');
        setResetFilename('');
        setResetConfirmedUser('');
        setResetNewPassword('');
        setResetConfirmPassword('');
    }

    function cancelReset() {
        setError('');
        setResetStep(null);
    }

    function applyLoginResponse(data) {
        user.value = data.user;
        csrf.value = data.csrf;
        config.value = data.config;
        if (data.license) {
            license.value = data.license;
        }
        setLocale(data.user?.language || data.config?.language || 'en');
        const theme = data.config?.theme;
        applyTheme(theme?.preset, theme?.accent_color, theme?.font_heading, theme?.font_body, theme?.custom_palette, theme?.surface_color);
        route('/files/0');
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        const data = await api('login', {
            method: 'POST',
            body: { email, password, remember: rememberMe },
            silent: true,
        });

        if (!data) {
            setError(t('common.network_error'));
            setSubmitting(false);
            return;
        }

        if (data._error) {
            if (data._error.includes('not configured')) {
                route('/setup');
                return;
            }
            setError(data._error);
            setSubmitting(false);
            return;
        }

        applyLoginResponse(data);
    }

    async function handlePasskeyLogin() {
        setError('');
        setPasskeyBusy(true);
        try {
            const data = await loginWithPasskey(rememberMe);
            applyLoginResponse(data);
        } catch (err) {
            if (err && (err.name === 'NotAllowedError' || err.name === 'AbortError')) {
                // User cancelled — silent reset
            } else {
                setError(t('login.passkey_failed'));
            }
            setPasskeyBusy(false);
        }
    }

    async function handleResetInitiate(e) {
        e.preventDefault();
        setError('');
        setResetBusy(true);
        const data = await api('password.resetInitiate', {
            method: 'POST',
            body: { email: resetEmail },
            silent: true,
        });
        setResetBusy(false);
        if (!data) { setError(t('common.network_error')); return; }
        if (data._error) { setError(data._error); return; }
        setResetToken(data.token);
        setResetPath(data.challenge_path);
        setResetFilename(data.challenge_filename);
        setResetStep('challenge');
    }

    async function handleResetVerify() {
        setError('');
        setResetBusy(true);
        const data = await api('password.resetVerify', {
            method: 'POST',
            body: { token: resetToken },
            silent: true,
        });
        setResetBusy(false);
        if (!data) { setError(t('common.network_error')); return; }
        if (data._error) { setError(data._error); return; }
        setResetConfirmedUser(data.email);
        setResetStep('password');
    }

    async function handleResetComplete(e) {
        e.preventDefault();
        setError('');
        if (resetNewPassword.length < 6) {
            setError(t('login.reset_password_too_short'));
            return;
        }
        if (resetNewPassword !== resetConfirmPassword) {
            setError(t('login.reset_passwords_mismatch'));
            return;
        }
        setResetBusy(true);
        const data = await api('password.resetComplete', {
            method: 'POST',
            body: {
                token: resetToken,
                new_password: resetNewPassword,
                confirm_password: resetConfirmPassword,
            },
            silent: true,
        });
        setResetBusy(false);
        if (!data) { setError(t('common.network_error')); return; }
        if (data._error) { setError(data._error); return; }
        showFlash('success', t('login.reset_success'));
        setResetStep(null);
        setEmail(resetConfirmedUser);
        setPassword('');
        setMode('password');
    }

    const logoUrl = siteLogo.value;
    const logoDarkUrl = siteLogoDark.value;
    const name = siteName.value || t('login.title');

    const inputClass = "w-full h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20";
    const primaryButtonClass = "w-full py-2 px-4 bg-accent-dark hover:bg-accent-dark disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors";
    const secondaryButtonClass = "w-full py-2 px-4 border border-border hover:bg-bg disabled:opacity-50 text-text text-sm font-medium rounded-lg transition-colors";

    const rememberMeCheckbox = html`
        <label class="flex items-center gap-2 mb-4 cursor-pointer">
            <input
                type="checkbox"
                checked=${rememberMe}
                onChange=${e => setRememberMe(e.target.checked)}
                class="rounded border-border text-accent focus:ring-accent/20"
            />
            <span class="text-sm text-text">${t('login.remember_me')}</span>
        </label>
    `;

    return html`
        <div class="min-h-screen flex items-center justify-center bg-bg px-4">
            <div class="w-full max-w-sm">
                <div class="text-center mb-8">
                    ${logoUrl && logoDarkUrl
                        ? html`<${Fragment}>
                            <img src=${logoUrl} alt=${name} class="h-10 mx-auto mb-3 dark:hidden" />
                            <img src=${logoDarkUrl} alt=${name} class="h-10 mx-auto mb-3 hidden dark:block" />
                        <//>`
                        : logoUrl
                            ? html`<img src=${logoUrl} alt=${name} class="h-10 mx-auto mb-3" />`
                            : logoDarkUrl
                                ? html`<img src=${logoDarkUrl} alt=${name} class="h-10 mx-auto mb-3" />`
                                : html`<h1 class="text-2xl font-bold text-text">${name}</h1>`
                    }
                </div>

                <div class="bg-surface rounded-xl shadow-sm border border-border p-6">
                    ${error && html`
                        <div class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
                            ${error}
                        </div>
                    `}

                    ${resetStep === null && canUsePasskey && mode === 'passkey' && html`
                        ${rememberMeCheckbox}
                        <button
                            type="button"
                            onClick=${handlePasskeyLogin}
                            disabled=${passkeyBusy}
                            class=${primaryButtonClass}
                        >
                            ${passkeyBusy ? t('login.signing_in') : t('login.sign_in_with_passkey')}
                        </button>
                        <div class="text-center mt-4">
                            <button
                                type="button"
                                onClick=${() => { setMode('password'); setError(''); }}
                                class="text-sm text-text-muted hover:text-text underline"
                            >
                                ${t('login.use_password_instead')}
                            </button>
                        </div>
                    `}

                    ${resetStep === null && mode === 'password' && html`
                        <form onSubmit=${handleSubmit}>
                            <div class="mb-4">
                                <label class="block text-sm font-medium leading-none mb-2" for="email">
                                    ${t('common.email')}
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    value=${email}
                                    onInput=${e => setEmail(e.target.value)}
                                    class=${inputClass}
                                    autocomplete="email webauthn"
                                    required
                                />
                            </div>

                            <div class="mb-4">
                                <label class="block text-sm font-medium leading-none mb-2" for="password">
                                    ${t('common.password')}
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    value=${password}
                                    onInput=${e => setPassword(e.target.value)}
                                    class=${inputClass}
                                    autocomplete="current-password"
                                    required
                                />
                            </div>

                            ${rememberMeCheckbox}

                            <button
                                type="submit"
                                disabled=${submitting}
                                class=${primaryButtonClass}
                            >
                                ${submitting ? t('login.signing_in') : t('login.sign_in')}
                            </button>

                            <div class="text-center mt-4 space-y-2">
                                <button
                                    type="button"
                                    onClick=${startReset}
                                    class="text-sm text-text-muted hover:text-text underline"
                                >
                                    ${t('login.forgot_password')}
                                </button>
                                ${canUsePasskey && html`
                                    <div>
                                        <button
                                            type="button"
                                            onClick=${() => { setMode('passkey'); setError(''); }}
                                            class="text-sm text-text-muted hover:text-text underline"
                                        >
                                            ${t('login.use_passkey_instead')}
                                        </button>
                                    </div>
                                `}
                            </div>
                        </form>
                    `}

                    ${resetStep === 'email' && html`
                        <form onSubmit=${handleResetInitiate}>
                            <h2 class="text-lg font-semibold text-text mb-2">${t('login.reset_title')}</h2>
                            <p class="text-sm text-text-muted mb-4">${t('login.reset_email_intro')}</p>
                            <div class="mb-4">
                                <label class="block text-sm font-medium leading-none mb-2" for="reset-email">
                                    ${t('common.email')}
                                </label>
                                <input
                                    id="reset-email"
                                    type="email"
                                    value=${resetEmail}
                                    onInput=${e => setResetEmail(e.target.value)}
                                    class=${inputClass}
                                    autocomplete="email"
                                    required
                                />
                            </div>
                            <button type="submit" disabled=${resetBusy} class=${primaryButtonClass}>
                                ${resetBusy ? t('login.reset_working') : t('login.reset_continue')}
                            </button>
                            <div class="text-center mt-4">
                                <button type="button" onClick=${cancelReset} class="text-sm text-text-muted hover:text-text underline">
                                    ${t('common.cancel')}
                                </button>
                            </div>
                        </form>
                    `}

                    ${resetStep === 'challenge' && html`
                        <div>
                            <h2 class="text-lg font-semibold text-text mb-2">${t('login.reset_title')}</h2>
                            <p class="text-sm text-text-muted mb-3">${t('login.reset_challenge_intro')}</p>
                            <div class="mb-3">
                                <div class="text-xs font-medium text-text-muted mb-1">${t('login.reset_challenge_path_label')}</div>
                                <code class="block text-xs bg-bg border border-border rounded-lg px-3 py-2 break-all select-all">${resetPath}</code>
                            </div>
                            <p class="text-xs text-text-muted mb-4">${t('login.reset_challenge_hint')}</p>
                            <button type="button" onClick=${handleResetVerify} disabled=${resetBusy} class=${primaryButtonClass}>
                                ${resetBusy ? t('login.reset_verifying') : t('login.reset_verify')}
                            </button>
                            <div class="text-center mt-4">
                                <button type="button" onClick=${cancelReset} class="text-sm text-text-muted hover:text-text underline">
                                    ${t('common.cancel')}
                                </button>
                            </div>
                        </div>
                    `}

                    ${resetStep === 'password' && html`
                        <form onSubmit=${handleResetComplete}>
                            <h2 class="text-lg font-semibold text-text mb-2">${t('login.reset_title')}</h2>
                            <p class="text-sm text-text-muted mb-4">${t('login.reset_password_intro', { email: resetConfirmedUser })}</p>
                            <div class="mb-4">
                                <label class="block text-sm font-medium leading-none mb-2" for="reset-new-password">
                                    ${t('login.reset_new_password')}
                                </label>
                                <input
                                    id="reset-new-password"
                                    type="password"
                                    value=${resetNewPassword}
                                    onInput=${e => setResetNewPassword(e.target.value)}
                                    class=${inputClass}
                                    autocomplete="new-password"
                                    required
                                />
                            </div>
                            <div class="mb-6">
                                <label class="block text-sm font-medium leading-none mb-2" for="reset-confirm-password">
                                    ${t('login.reset_confirm_password')}
                                </label>
                                <input
                                    id="reset-confirm-password"
                                    type="password"
                                    value=${resetConfirmPassword}
                                    onInput=${e => setResetConfirmPassword(e.target.value)}
                                    class=${inputClass}
                                    autocomplete="new-password"
                                    required
                                />
                            </div>
                            <p class="text-xs text-text-muted mb-4">${t('login.reset_warning')}</p>
                            <button type="submit" disabled=${resetBusy} class=${primaryButtonClass}>
                                ${resetBusy ? t('login.reset_working') : t('login.reset_finish')}
                            </button>
                            <div class="text-center mt-4">
                                <button type="button" onClick=${cancelReset} class="text-sm text-text-muted hover:text-text underline">
                                    ${t('common.cancel')}
                                </button>
                            </div>
                        </form>
                    `}
                </div>
            </div>
        </div>
    `;
}
