import { h } from 'preact';
import htm from 'htm';
import { goToPurchase, contactSupport } from '../license-actions.js?v=20260538';
import { isOwner, license } from '../state.js?v=20260538';
import { Shield, ExternalLink } from '../icons.js?v=20260538';
import { t } from '../i18n.js?v=20260538';

const html = htm.bind(h);

export function FeatureAccessPrompt({ title, description, className = 'max-w-3xl mb-6' }) {
    const isPlanLocked = license.value?.valid === true;
    const heading = isPlanLocked
        ? t('feature_access.plan_locked_title')
        : (title || t('common.license_required'));
    const body = isPlanLocked
        ? t('feature_access.plan_locked_desc')
        : (description || t('feature_access.license_required_desc'));
    const ctaLabel = isPlanLocked
        ? t('feature_access.contact_support')
        : t('common.purchase_license');
    const handleCta = isPlanLocked ? contactSupport : goToPurchase;

    return html`
        <div class="${className}">
            <div class="rounded-xl border border-accent-light bg-accent-light p-6 text-center">
                <div class="flex justify-center mb-3">
                    <div class="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                        <${Shield} size=${24} className="text-accent-dark" />
                    </div>
                </div>
                <h2 class="text-base font-semibold text-accent-dark mb-1">${heading}</h2>
                <p class="text-sm text-accent-dark mb-4">${body}</p>
                ${isOwner.value && html`
                    <button
                        type="button"
                        onclick=${handleCta}
                        class="inline-flex items-center gap-1.5 px-4 py-2 bg-accent-dark hover:bg-accent-dark text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <${ExternalLink} size=${14} />
                        ${ctaLabel}
                    </button>
                `}
            </div>
        </div>
    `;
}
