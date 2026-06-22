import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';
import { featureEnabled } from '../state.js?v=20260538';
import { PageHeader } from '../components/PageHeader.js?v=20260538';
import { t } from '../i18n.js?v=20260538';
import { FeatureAccessPrompt } from '../components/FeatureAccessPrompt.js?v=20260538';
import { ProvidersTab } from './ai/ProvidersTab.js?v=20260538';
import { FeaturesTab } from './ai/FeaturesTab.js?v=20260538';
import { ConnectionsTab } from './ai/ConnectionsTab.js?v=20260538';

const html = htm.bind(h);

const TABS = [
    { id: 'providers', label: 'ai.tab_providers', component: ProvidersTab },
    { id: 'features',  label: 'ai.tab_features',  component: FeaturesTab },
    { id: 'connections', label: 'ai.tab_mcp',     component: ConnectionsTab },
];

export function AI() {
    const aiAllowed = featureEnabled('ai');
    const mcpAllowed = featureEnabled('mcp_tokens');
    const [activeId, setActiveId] = useState(TABS[0].id);

    if (!aiAllowed && !mcpAllowed) {
        return html`
            <${PageHeader} title="${t('ai.title')}" subtitle="${t('ai.subtitle')}" />
            <${FeatureAccessPrompt} title=${t('ai.upgrade.title')} description=${t('ai.upgrade.subtitle')} />
        `;
    }

    const ActiveComponent = TABS.find(t => t.id === activeId)?.component || TABS[0].component;
    const activeLocked = activeId === 'connections' ? !mcpAllowed : !aiAllowed;

    return html`
        <${PageHeader} title="${t('ai.title')}" subtitle="${t('ai.subtitle')}" />

        <div class="mb-5 border-b border-border">
            <div class="flex gap-1">
                ${TABS.map(tab => html`
                    <button key=${tab.id}
                        onclick=${() => setActiveId(tab.id)}
                        class="px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${activeId === tab.id
                            ? 'border-accent-dark text-text'
                            : 'border-transparent text-text-muted hover:text-text'}">
                        ${t(tab.label)}
                    </button>
                `)}
            </div>
        </div>

        ${activeLocked
            ? html`<${FeatureAccessPrompt} title=${t('ai.upgrade.title')} description=${t('ai.upgrade.subtitle')} />`
            : html`<${ActiveComponent} />`}
    `;
}
