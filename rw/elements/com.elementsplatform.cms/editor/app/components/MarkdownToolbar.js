import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { Bold, Italic, Strikethrough, Heading1, Heading2, Heading3, ListIcon, ListOrdered, Quote, Code, Link, Eye, Edit, Image } from '../icons.js?v=20260538';
import { t } from '../i18n.js?v=20260538';

const html = htm.bind(h);

function ToolButton({ icon, label, isActive, onClick }) {
    return html`
        <button type="button" onclick=${onClick} title=${label}
            class=${`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                isActive
                    ? 'bg-accent-light text-accent-dark'
                    : 'text-text-secondary hover:bg-bg hover:text-text'
            }`}>
            <${icon} size=${15} />
        </button>
    `;
}

function Separator() {
    return html`<div class="w-px h-5 bg-border mx-1"></div>`;
}

export function MarkdownToolbar({ editor, showPreview, onTogglePreview, previewUrl, onAddResource }) {
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        if (!editor) return;
        const handler = () => forceUpdate(n => n + 1);
        editor.on('transaction', handler);
        return () => editor.off('transaction', handler);
    }, [editor]);

    if (!editor) return null;

    const btn = (icon, label, action, activeName, activeAttrs) => html`
        <${ToolButton}
            icon=${icon}
            label=${label}
            isActive=${activeAttrs ? editor.isActive(activeName, activeAttrs) : editor.isActive(activeName)}
            onClick=${() => action()} />
    `;

    return html`
        <div class="flex items-center gap-0.5 mb-3 pb-3 border-b border-border">
            ${btn(Bold, t('markdown_toolbar.bold'), () => editor.chain().focus().toggleBold().run(), 'bold')}
            ${btn(Italic, t('markdown_toolbar.italic'), () => editor.chain().focus().toggleItalic().run(), 'italic')}
            ${btn(Strikethrough, t('markdown_toolbar.strikethrough'), () => editor.chain().focus().toggleStrike().run(), 'strike')}
            <${Separator} />
            ${btn(Heading1, t('markdown_toolbar.heading1'), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), 'heading', { level: 1 })}
            ${btn(Heading2, t('markdown_toolbar.heading2'), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'heading', { level: 2 })}
            ${btn(Heading3, t('markdown_toolbar.heading3'), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), 'heading', { level: 3 })}
            <${Separator} />
            ${btn(ListIcon, t('markdown_toolbar.bullet_list'), () => editor.chain().focus().toggleBulletList().run(), 'bulletList')}
            ${btn(ListOrdered, t('markdown_toolbar.ordered_list'), () => editor.chain().focus().toggleOrderedList().run(), 'orderedList')}
            <${Separator} />
            ${btn(Quote, t('markdown_toolbar.blockquote'), () => editor.chain().focus().toggleBlockquote().run(), 'blockquote')}
            ${btn(Code, t('markdown_toolbar.code_block'), () => editor.chain().focus().toggleCodeBlock().run(), 'codeBlock')}
            ${btn(Link, t('markdown_toolbar.link'), () => {
                editor.chain().focus().insertContentAt(editor.state.selection, '[text](url)').run();
            }, 'link')}

            <div class="flex-1"></div>

            ${onAddResource && html`
                <${ToolButton} icon=${Image} label=${t('markdown_toolbar.add_resource')} onClick=${onAddResource} />
            `}

            ${previewUrl && html`
                <${Separator} />
                <button type="button" onclick=${onTogglePreview} title=${showPreview ? t('markdown_toolbar.back_to_editor') : t('markdown_toolbar.preview')}
                    class=${`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium transition-colors ${
                        showPreview
                            ? 'bg-accent-light text-accent-dark'
                            : 'text-text-secondary hover:bg-bg hover:text-text'
                    }`}>
                    <${showPreview ? Edit : Eye} size=${14} />
                    ${showPreview ? t('markdown_toolbar.editor') : t('markdown_toolbar.preview')}
                </button>
            `}
        </div>
    `;
}
