import { h } from 'preact';
import htm from 'htm';
import { route } from '../router.js?v=20260538';
import { isOwner } from '../state.js?v=20260538';
import { goToPurchase } from '../license-actions.js?v=20260538';
import { t } from '../i18n.js?v=20260538';
import { Shield, ExternalLink } from '../icons.js?v=20260538';

const html = htm.bind(h);

export function FolderUnavailable({ kind, backHref }) {
    function handlePurchase() {
        goToPurchase();
    }

    const isLicense = kind === 'license';
    const title = isLicense
        ? t('folder_unavailable.license_title')
        : t('folder_unavailable.not_found_title');
    const desc = isLicense
        ? t('folder_unavailable.license_desc')
        : t('folder_unavailable.not_found_desc');

    return html`
        <div class="max-w-3xl rounded-xl border border-accent-light bg-accent-light p-6 mb-6 text-center">
            <div class="flex justify-center mb-3">
                <div class="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <${Shield} size=${24} className="text-accent-dark" />
                </div>
            </div>
            <h2 class="text-base font-semibold text-accent-dark mb-1">${title}</h2>
            <p class="text-sm text-accent-dark mb-4">${desc}</p>
            ${isLicense && isOwner.value && html`
                <button
                    onclick=${handlePurchase}
                    class="inline-flex items-center gap-1.5 px-4 py-2 bg-accent-dark hover:bg-accent-dark text-white text-sm font-medium rounded-lg transition-colors"
                >
                    <${ExternalLink} size=${14} />
                    ${t('common.purchase_license')}
                </button>
            `}
            ${!isLicense && backHref && html`
                <button
                    onclick=${() => route(backHref)}
                    class="inline-flex items-center gap-1.5 px-4 py-2 bg-accent-dark hover:bg-accent-dark text-white text-sm font-medium rounded-lg transition-colors"
                >
                    ${t('folder_unavailable.back_to_first')}
                </button>
            `}
        </div>
    `;
}
