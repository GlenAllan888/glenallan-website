import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import htm from 'htm';
import {
    Bold, Italic, Underline, Strikethrough,
    Heading1, Heading2, Heading3,
    Quote, ListIcon, ListOrdered,
    Link, ImageIcon, Code, Minus, CodeXml, Sparkles
} from '../icons.js?v=20260538';
import { t } from '../i18n.js?v=20260538';
import { api } from '../api.js?v=20260538';
import { featureEnabled, aiSettings } from '../state.js?v=20260538';
import { AiAssistPopover } from './AiAssistPopover.js?v=20260538';
import { SelectionBubbleMenu } from './SelectionBubbleMenu.js?v=20260538';

const html = htm.bind(h);

function ToolbarButton({ icon, active, onClick, title, disabled }) {
    return html`
        <button
            type="button"
            onClick=${onClick}
            title=${title}
            disabled=${disabled}
            class="w-[30px] h-[28px] rounded-[5px] flex items-center justify-center transition-colors
                ${disabled ? 'text-text-muted/40 cursor-not-allowed' :
                  active ? 'bg-accent-light text-accent' : 'text-text-secondary hover:bg-surface hover:text-text'}"
        >
            <${icon} size=${15} />
        </button>
    `;
}

function ToolbarDivider() {
    return html`<div class="w-px h-[20px] bg-border self-center mx-[4px]"></div>`;
}

export function EditorToolbar({ editor, rawMode, onToggleRaw, onAddResource }) {
    const [, forceUpdate] = useState(0);
    const [aiOpen, setAiOpen] = useState(false);
    const aiButtonRef = useRef(null);

    useEffect(() => {
        if (!editor) return;
        const handler = () => forceUpdate(n => n + 1);
        editor.on('transaction', handler);
        return () => editor.off('transaction', handler);
    }, [editor]);

    // Lazy-load AI settings only when the current plan includes AI, so the
    // Sparkles button can decide whether to show itself.
    useEffect(() => {
        if (!featureEnabled('ai') || aiSettings.value !== null) return;
        let cancelled = false;
        api('ai.settings.get', { silent: true }).then(res => {
            if (!cancelled && res && !res._error) aiSettings.value = res;
        });
        return () => { cancelled = true; };
    }, []);

    const ai = aiSettings.value;
    const aiAvailable = !rawMode
        && featureEnabled('ai')
        && !!ai?.master_enabled
        && !!ai?.features?.writing_assistant?.enabled;

    function handleLink() {
        if (!editor || rawMode) return;
        const prev = editor.getAttributes('link').href || '';
        const url = prompt('Enter URL:', prev);
        if (url === null) return;
        if (url === '') {
            editor.chain().focus().unsetLink().run();
        } else {
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        }
    }

    const disabled = !editor;
    const off = disabled || rawMode;

    return html`
        <div class="sticky top-0 z-10 flex items-center gap-[2px] px-4 py-[5px] bg-bg border-b border-border-light">
            <!-- Text formatting -->
            <${ToolbarButton} icon=${Bold} title=${t('toolbar.bold')}
                active=${!off && editor?.isActive('bold')}
                disabled=${off}
                onClick=${() => !off && editor?.chain().focus().toggleBold().run()} />
            <${ToolbarButton} icon=${Italic} title=${t('toolbar.italic')}
                active=${!off && editor?.isActive('italic')}
                disabled=${off}
                onClick=${() => !off && editor?.chain().focus().toggleItalic().run()} />
            <${ToolbarButton} icon=${Underline} title=${t('toolbar.underline')}
                active=${!off && editor?.isActive('underline')}
                disabled=${off}
                onClick=${() => !off && editor?.chain().focus().toggleUnderline().run()} />
            <${ToolbarButton} icon=${Strikethrough} title=${t('toolbar.strikethrough')}
                active=${!off && editor?.isActive('strike')}
                disabled=${off}
                onClick=${() => !off && editor?.chain().focus().toggleStrike().run()} />

            <${ToolbarDivider} />

            <!-- Headings -->
            <${ToolbarButton} icon=${Heading1} title=${t('toolbar.heading1')}
                active=${!off && editor?.isActive('heading', { level: 1 })}
                disabled=${off}
                onClick=${() => !off && editor?.chain().focus().toggleHeading({ level: 1 }).run()} />
            <${ToolbarButton} icon=${Heading2} title=${t('toolbar.heading2')}
                active=${!off && editor?.isActive('heading', { level: 2 })}
                disabled=${off}
                onClick=${() => !off && editor?.chain().focus().toggleHeading({ level: 2 }).run()} />
            <${ToolbarButton} icon=${Heading3} title=${t('toolbar.heading3')}
                active=${!off && editor?.isActive('heading', { level: 3 })}
                disabled=${off}
                onClick=${() => !off && editor?.chain().focus().toggleHeading({ level: 3 }).run()} />

            <${ToolbarDivider} />

            <!-- Block formatting -->
            <${ToolbarButton} icon=${ListIcon} title=${t('toolbar.bullet_list')}
                active=${!off && editor?.isActive('bulletList')}
                disabled=${off}
                onClick=${() => !off && editor?.chain().focus().toggleBulletList().run()} />
            <${ToolbarButton} icon=${ListOrdered} title=${t('toolbar.ordered_list')}
                active=${!off && editor?.isActive('orderedList')}
                disabled=${off}
                onClick=${() => !off && editor?.chain().focus().toggleOrderedList().run()} />
            <${ToolbarButton} icon=${Quote} title=${t('toolbar.blockquote')}
                active=${!off && editor?.isActive('blockquote')}
                disabled=${off}
                onClick=${() => !off && editor?.chain().focus().toggleBlockquote().run()} />

            <${ToolbarDivider} />

            <!-- Insert -->
            <${ToolbarButton} icon=${Link} title=${t('toolbar.link')}
                active=${!off && editor?.isActive('link')}
                disabled=${off}
                onClick=${() => !off && handleLink()} />
            <${ToolbarButton} icon=${ImageIcon} title=${t('toolbar.image')}
                active=${false}
                disabled=${off || !onAddResource}
                onClick=${() => !off && onAddResource && onAddResource()} />
            <${ToolbarButton} icon=${Code} title=${t('toolbar.code_block')}
                active=${!off && editor?.isActive('codeBlock')}
                disabled=${off}
                onClick=${() => !off && editor?.chain().focus().toggleCodeBlock().run()} />
            <${ToolbarButton} icon=${Minus} title=${t('toolbar.horizontal_rule')}
                active=${false}
                disabled=${off}
                onClick=${() => !off && editor?.chain().focus().setHorizontalRule().run()} />

            ${aiAvailable && html`
                <${ToolbarDivider} />
                <div ref=${aiButtonRef} class="relative">
                    <${ToolbarButton} icon=${Sparkles} title=${t('toolbar.ai_assist')}
                        active=${aiOpen}
                        onClick=${() => setAiOpen(o => !o)} />
                    ${aiOpen && html`
                        <${AiAssistPopover}
                            editor=${editor}
                            anchorRef=${aiButtonRef}
                            onClose=${() => setAiOpen(false)} />
                    `}
                </div>
            `}

            <div class="flex-1" />

            <!-- Raw markdown toggle -->
            <${ToolbarButton} icon=${CodeXml} title=${t('toolbar.raw_markdown')}
                active=${rawMode}
                onClick=${onToggleRaw} />

            ${!rawMode && editor && html`
                <${SelectionBubbleMenu} editor=${editor} aiAvailable=${aiAvailable} />
            `}
        </div>
    `;
}
