import { h } from 'preact';
import htm from 'htm';
import { goToPurchase } from '../license-actions.js?v=20260538';
import { t } from '../i18n.js?v=20260538';
import { Modal } from './Modal.js?v=20260538';
import { Shield, ExternalLink } from '../icons.js?v=20260538';

const html = htm.bind(h);

export function LicenseRequiredModal({ open, onClose }) {
    function handlePurchase() {
        if (onClose) onClose();
        goToPurchase();
    }

    return html`
        <${Modal} open=${open} onClose=${onClose} title=${t('license_modal.title')} maxWidth="max-w-sm">
            <div class="p-5">
                <div class="flex justify-center mb-4">
                    <div class="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                        <${Shield} size=${24} className="text-accent-dark" />
                    </div>
                </div>
                <p class="text-sm text-text-secondary text-center mb-6">
                    ${t('license_modal.desc')}
                </p>
                <div class="flex gap-2">
                    <button
                        onclick=${onClose}
                        class="flex-1 px-4 py-2 bg-bg hover:bg-border/30 text-text text-sm font-medium rounded-lg transition-colors"
                    >
                        ${t('common.cancel')}
                    </button>
                    <button
                        onclick=${handlePurchase}
                        class="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-accent-dark hover:bg-accent-dark text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <${ExternalLink} size=${14} />
                        ${t('license_modal.purchase')}
                    </button>
                </div>
            </div>
        <//>
    `;
}
