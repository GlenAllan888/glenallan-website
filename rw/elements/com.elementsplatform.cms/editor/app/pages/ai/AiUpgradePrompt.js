import { h } from 'preact';
import htm from 'htm';
import { goToPurchase } from '../../license-actions.js?v=20260538';
import { Shield, ExternalLink, Sparkles, Key, Check } from '../../icons.js?v=20260538';
import { t } from '../../i18n.js?v=20260538';

const html = htm.bind(h);

export function AiUpgradePrompt() {
    function handlePurchase() {
        goToPurchase();
    }

    const features = [
        { icon: Sparkles, title: t('ai.upgrade.feature_writer_title'), desc: t('ai.upgrade.feature_writer_desc') },
        { icon: Key, title: t('ai.upgrade.feature_byok_title'), desc: t('ai.upgrade.feature_byok_desc') },
        { icon: ExternalLink, title: t('ai.upgrade.feature_mcp_title'), desc: t('ai.upgrade.feature_mcp_desc') },
    ];

    return html`
        <div class="max-w-2xl">
            <div class="border border-border rounded-2xl bg-surface p-8 text-center">
                <div class="flex justify-center mb-5">
                    <div class="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
                        <${Shield} size=${28} className="text-accent-dark" />
                    </div>
                </div>

                <h2 class="text-[18px] font-bold text-text mb-2">${t('ai.upgrade.title')}</h2>
                <p class="text-[13px] text-text-secondary max-w-md mx-auto mb-6">${t('ai.upgrade.subtitle')}</p>

                <div class="grid gap-3 text-left mb-6">
                    ${features.map(f => html`
                        <div class="flex items-start gap-3 p-3 border border-border-light rounded-lg bg-bg">
                            <div class="shrink-0 w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent-dark">
                                <${f.icon} size=${16} />
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="text-[13px] font-semibold text-text mb-0.5">${f.title}</div>
                                <div class="text-[12px] text-text-muted leading-relaxed">${f.desc}</div>
                            </div>
                            <${Check} size=${14} className="text-accent-dark shrink-0 mt-1" />
                        </div>
                    `)}
                </div>

                <button
                    onclick=${handlePurchase}
                    class="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-accent-dark hover:bg-accent text-white text-sm font-semibold rounded-lg transition-colors"
                >
                    <${ExternalLink} size=${14} />
                    ${t('ai.upgrade.cta')}
                </button>
                <p class="text-[11px] text-text-muted mt-3">${t('ai.upgrade.note')}</p>
            </div>
        </div>
    `;
}
