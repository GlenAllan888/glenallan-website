import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';
import { route } from '../router.js?v=20260538';
import { t } from '../i18n.js?v=20260538';
import { user, siteName, siteLogo, siteLogoDark, config, showFlash } from '../state.js?v=20260538';
import { supportsPasskeys, registerPasskey } from '../webauthn.js?v=20260538';

const html = htm.bind(h);

export function Welcome() {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const canUsePasskey = supportsPasskeys();
    const email = user.value?.email || '';
    const firstFolder = config.value?.folders?.[0]?.index ?? 0;

    function goToApp() {
        route(`/files/${firstFolder}`);
    }

    async function handleAddPasskey() {
        setError('');
        setBusy(true);
        try {
            await registerPasskey(t('welcome.default_passkey_name'));
            showFlash('success', t('account.passkey_added'));
            goToApp();
        } catch (err) {
            if (!err || (err.name !== 'NotAllowedError' && err.name !== 'AbortError')) {
                setError(t('welcome.passkey_failed'));
            }
            setBusy(false);
        }
    }

    const logoUrl = siteLogo.value;
    const logoDarkUrl = siteLogoDark.value;
    const name = siteName.value || t('login.title');

    return html`
        <div class="min-h-screen flex items-center justify-center bg-bg px-4">
            <div class="w-full max-w-sm">
                <div class="text-center mb-8">
                    ${logoUrl && logoDarkUrl
                        ? html`
                            <img src=${logoUrl} alt=${name} class="h-10 mx-auto mb-3 dark:hidden" />
                            <img src=${logoDarkUrl} alt=${name} class="h-10 mx-auto mb-3 hidden dark:block" />
                        `
                        : logoUrl
                            ? html`<img src=${logoUrl} alt=${name} class="h-10 mx-auto mb-3" />`
                            : html`<h1 class="text-2xl font-bold text-text">${name}</h1>`
                    }
                </div>

                <div class="bg-surface rounded-xl shadow-sm border border-border p-6 text-center">
                    <h2 class="text-lg font-semibold text-text mb-2">
                        ${t('welcome.title', { name: email })}
                    </h2>
                    <p class="text-sm text-text-muted mb-6">
                        ${canUsePasskey ? t('welcome.subtitle') : t('welcome.subtitle_no_passkey')}
                    </p>

                    ${error && html`
                        <div class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4 text-left">
                            ${error}
                        </div>
                    `}

                    ${canUsePasskey
                        ? html`
                            <button
                                type="button"
                                onClick=${handleAddPasskey}
                                disabled=${busy}
                                class="w-full py-2 px-4 bg-accent-dark hover:bg-accent-dark disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors mb-3"
                            >
                                ${busy ? t('account.passkey_adding') : t('welcome.add_passkey')}
                            </button>
                            <button
                                type="button"
                                onClick=${goToApp}
                                class="text-sm text-text-muted hover:text-text underline"
                            >
                                ${t('welcome.skip')}
                            </button>
                        `
                        : html`
                            <button
                                type="button"
                                onClick=${goToApp}
                                class="w-full py-2 px-4 bg-accent-dark hover:bg-accent-dark text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                ${t('welcome.continue')}
                            </button>
                        `
                    }
                </div>
            </div>
        </div>
    `;
}
