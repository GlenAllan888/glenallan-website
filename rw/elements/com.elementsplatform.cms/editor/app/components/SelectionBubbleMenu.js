import { h } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import htm from 'htm';
import { Bold, Underline, Link, Sparkles } from '../icons.js?v=20260538';
import { t } from '../i18n.js?v=20260538';
import { AiAssistPopover } from './AiAssistPopover.js?v=20260538';

const html = htm.bind(h);

const BUBBLE_H = 32;
const GAP = 8;
const FLIP_AT = 44;

function BubbleButton({ icon, onClick, active, title }) {
    return html`
        <button type="button"
            title=${title}
            onMouseDown=${(e) => e.preventDefault()}
            onClick=${onClick}
            class="w-[28px] h-[26px] rounded flex items-center justify-center transition-colors
                ${active ? 'bg-accent-light text-accent' : 'text-text-secondary hover:bg-border-light hover:text-text'}">
            <${icon} size=${14} />
        </button>
    `;
}

export function SelectionBubbleMenu({ editor, aiAvailable }) {
    const [pos, setPos] = useState(null);
    const [aiOpen, setAiOpen] = useState(false);
    const wrapRef = useRef(null);
    const aiAnchorRef = useRef(null);
    const debounceRef = useRef(null);
    const [, forceUpdate] = useState(0);

    const compute = useCallback(() => {
        if (!editor) return null;
        const { from, to, empty } = editor.state.selection;
        if (empty) return null;
        if (editor.isActive('codeBlock')) return null;
        try {
            const s = editor.view.coordsAtPos(from);
            const e = editor.view.coordsAtPos(Math.max(from, to - 1), -1);
            const top = Math.min(s.top, e.top);
            const bottom = Math.max(s.bottom, e.bottom);
            const centerX = (s.left + e.right) / 2;
            const flipped = top < FLIP_AT;
            return {
                top: flipped ? bottom + GAP : top - BUBBLE_H - GAP,
                centerX,
                flipped,
            };
        } catch {
            return null;
        }
    }, [editor]);

    useEffect(() => {
        if (!editor) return;
        const onSel = () => {
            forceUpdate(n => n + 1);
            if (aiOpen) return;
            clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => setPos(compute()), 80);
        };
        const onTxn = () => forceUpdate(n => n + 1);
        const onBlur = () => {
            if (aiOpen) return;
            setTimeout(() => { if (!aiOpen) setPos(null); }, 100);
        };
        editor.on('selectionUpdate', onSel);
        editor.on('transaction', onTxn);
        editor.on('blur', onBlur);
        return () => {
            editor.off('selectionUpdate', onSel);
            editor.off('transaction', onTxn);
            editor.off('blur', onBlur);
            clearTimeout(debounceRef.current);
        };
    }, [editor, aiOpen, compute]);

    useEffect(() => {
        if (!pos || aiOpen) return;
        const reflow = () => setPos(compute());
        window.addEventListener('scroll', reflow, true);
        window.addEventListener('resize', reflow);
        return () => {
            window.removeEventListener('scroll', reflow, true);
            window.removeEventListener('resize', reflow);
        };
    }, [pos, aiOpen, compute]);

    function handleLink() {
        if (!editor) return;
        const prev = editor.getAttributes('link').href || '';
        const url = prompt('Enter URL:', prev);
        if (url === null) return;
        if (url === '') {
            editor.chain().focus().unsetLink().run();
        } else {
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        }
    }

    if (!pos && !aiOpen) return null;

    const bubbleWidth = aiAvailable ? 164 : 110;
    const leftPx = (pos?.centerX ?? 0) - bubbleWidth / 2;

    return html`
        <div ref=${wrapRef}
            style=${`position:fixed;top:${pos?.top ?? 0}px;left:${leftPx}px;z-index:60;`}
            onMouseDown=${(e) => e.preventDefault()}
            class="flex items-center gap-[2px] p-[3px] bg-surface border border-border rounded-lg shadow-lg">
            <${BubbleButton} icon=${Bold}
                title=${t('toolbar.bold')}
                active=${editor?.isActive('bold')}
                onClick=${() => editor?.chain().focus().toggleBold().run()} />
            <${BubbleButton} icon=${Underline}
                title=${t('toolbar.underline')}
                active=${editor?.isActive('underline')}
                onClick=${() => editor?.chain().focus().toggleUnderline().run()} />
            <${BubbleButton} icon=${Link}
                title=${t('toolbar.link')}
                active=${editor?.isActive('link')}
                onClick=${handleLink} />
            ${aiAvailable && html`
                <div class="w-px h-[18px] bg-border mx-[2px]"></div>
                <div ref=${aiAnchorRef} class="relative">
                    <${BubbleButton} icon=${Sparkles}
                        title=${t('toolbar.ai_assist')}
                        active=${aiOpen}
                        onClick=${() => setAiOpen(o => !o)} />
                    ${aiOpen && html`
                        <${AiAssistPopover}
                            editor=${editor}
                            anchorRef=${aiAnchorRef}
                            placement=${'below-center'}
                            onClose=${() => { setAiOpen(false); setPos(compute()); }} />
                    `}
                </div>
            `}
        </div>
    `;
}
