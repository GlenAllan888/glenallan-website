import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import htm from 'htm';
import { api } from '../api.js?v=20260538';
import { Loader, Sparkles, Check, X, ChevronRight, ChevronLeft } from '../icons.js?v=20260538';
import { t } from '../i18n.js?v=20260538';

const html = htm.bind(h);

const TONES = [
    { id: 'rewrite_professional', label: 'ai.assist.tone_professional' },
    { id: 'rewrite_friendly',     label: 'ai.assist.tone_friendly' },
    { id: 'rewrite_concise',      label: 'ai.assist.tone_concise' },
    { id: 'rewrite_expand',       label: 'ai.assist.tone_expand' },
];

const LANGS = [
    { code: 'English',    label: 'English' },
    { code: 'Spanish',    label: 'Español' },
    { code: 'French',     label: 'Français' },
    { code: 'German',     label: 'Deutsch' },
    { code: 'Italian',    label: 'Italiano' },
    { code: 'Dutch',      label: 'Nederlands' },
    { code: 'Swedish',    label: 'Svenska' },
    { code: 'Portuguese', label: 'Português' },
    { code: 'Japanese',   label: '日本語' },
    { code: 'Chinese',    label: '中文' },
];

const CONTEXT_RADIUS = 500;

export function AiAssistPopover({ editor, anchorRef, onClose, placement = 'below-right' }) {
    const [view, setView] = useState('menu'); // 'menu' | 'tones' | 'langs' | 'custom' | 'pending' | 'result' | 'error'
    const [pendingAction, setPendingAction] = useState(null);
    const [pendingParams, setPendingParams] = useState({});
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [customPrompt, setCustomPrompt] = useState('');
    const popoverRef = useRef(null);

    // Snapshot the editor selection at popover-open time. Clicking inside the
    // popover blurs the editor and collapses its selection, so we can't rely
    // on editor.state.selection after the user starts interacting.
    const snapshotRef = useRef(null);
    if (snapshotRef.current === null && editor) {
        const { from, to } = editor.state.selection;
        snapshotRef.current = {
            from, to,
            selection: editor.state.doc.textBetween(from, to, '\n'),
        };
    }

    useEffect(() => {
        function handleClickOutside(e) {
            if (popoverRef.current && !popoverRef.current.contains(e.target)
                && (!anchorRef?.current || !anchorRef.current.contains(e.target))) {
                onClose();
            }
        }
        function handleKey(e) { if (e.key === 'Escape') onClose(); }
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKey);
        };
    }, []);

    function getSelection() {
        if (!editor || !snapshotRef.current) return { selection: '', context: '', from: 0, to: 0 };
        const { from, to, selection } = snapshotRef.current;
        const docSize = editor.state.doc.content.size;
        const ctxFrom = Math.max(0, from - CONTEXT_RADIUS);
        const ctxTo = Math.min(docSize, to + CONTEXT_RADIUS);
        const context = editor.state.doc.textBetween(ctxFrom, ctxTo, '\n');
        return { selection, context, from, to };
    }

    async function runAction(actionId, params = {}) {
        const { selection, context } = getSelection();
        setPendingAction(actionId);
        setPendingParams(params);
        setView('pending');
        setError(null);

        const res = await api('ai.assist.run', {
            method: 'POST',
            silent: true,
            body: {
                action: actionId,
                selection,
                context,
                customPrompt: params.custom || '',
                targetLang: params.target_lang || '',
            },
        });

        if (!res || res._error) {
            setError(res?._error || t('ai.assist.error_generic'));
            setView('error');
            return;
        }
        setResult(res);
        setView('result');
    }

    function accept() {
        if (!editor || !result || !snapshotRef.current) return;
        const { from, to } = snapshotRef.current;
        const text = result.text || '';
        if (result.mode === 'replace' && from !== to) {
            editor.chain().focus().insertContentAt({ from, to }, text).run();
        } else {
            editor.chain().focus().insertContentAt(to, text).run();
        }
        onClose();
    }

    function tryAgain() {
        if (pendingAction) runAction(pendingAction, pendingParams);
    }

    const hasSelection = !!(snapshotRef.current && snapshotRef.current.from !== snapshotRef.current.to);

    const placementClass = placement === 'below-center'
        ? 'absolute left-1/2 -translate-x-1/2 top-full mt-1'
        : 'absolute right-0 top-full mt-1';

    return html`
        <div ref=${popoverRef}
            class="${placementClass} z-50 w-[320px] bg-surface border border-border rounded-lg shadow-xl overflow-hidden"
            onMouseDown=${e => e.stopPropagation()}
            onclick=${e => e.stopPropagation()}>

            ${view === 'menu' && html`
                <${MenuView}
                    hasSelection=${hasSelection}
                    onPick=${(id, sub) => {
                        if (sub) setView(sub);
                        else runAction(id);
                    }}
                    onClose=${onClose} />
            `}

            ${view === 'tones' && html`
                <${SubmenuView} title=${t('ai.assist.rewrite')} onBack=${() => setView('menu')}>
                    ${TONES.map(tone => html`
                        <${MenuItem} key=${tone.id} label=${t(tone.label)}
                            disabled=${!hasSelection}
                            onClick=${() => runAction(tone.id)} />
                    `)}
                <//>
            `}

            ${view === 'langs' && html`
                <${SubmenuView} title=${t('ai.assist.translate')} onBack=${() => setView('menu')}>
                    <div class="max-h-64 overflow-y-auto">
                        ${LANGS.map(lang => html`
                            <${MenuItem} key=${lang.code} label=${lang.label}
                                disabled=${!hasSelection}
                                onClick=${() => runAction('translate', { target_lang: lang.code })} />
                        `)}
                    </div>
                <//>
            `}

            ${view === 'custom' && html`
                <${SubmenuView} title=${t('ai.assist.custom')} onBack=${() => setView('menu')}>
                    <div class="p-3 flex flex-col gap-2">
                        <textarea
                            value=${customPrompt}
                            onInput=${e => setCustomPrompt(e.target.value)}
                            placeholder="${t('ai.assist.custom_placeholder')}"
                            rows=${3}
                            class="w-full text-[13px] rounded-md border border-border bg-bg px-2 py-1.5 text-text placeholder:text-text-muted focus:border-accent focus:outline-none resize-none" />
                        <button
                            onclick=${() => customPrompt.trim() && runAction('custom', { custom: customPrompt.trim() })}
                            disabled=${!customPrompt.trim()}
                            class="self-end px-3 py-1.5 bg-accent hover:bg-accent-dark text-white text-[12px] font-medium rounded-md disabled:opacity-50 transition-colors">
                            ${t('ai.assist.run')}
                        </button>
                    </div>
                <//>
            `}

            ${view === 'pending' && html`
                <div class="p-6 flex flex-col items-center gap-3 text-text-muted">
                    <${Loader} size=${20} className="text-accent-dark" />
                    <div class="text-[12px]">${t('ai.assist.thinking')}</div>
                </div>
            `}

            ${view === 'error' && html`
                <div class="p-4 flex flex-col gap-3">
                    <div class="text-[12px] text-red-600 leading-relaxed">${error}</div>
                    <div class="flex justify-end gap-2">
                        <button onclick=${onClose}
                            class="px-3 py-1.5 text-[12px] text-text-secondary hover:text-text rounded-md transition-colors">
                            ${t('common.cancel')}
                        </button>
                        <button onclick=${tryAgain}
                            class="px-3 py-1.5 bg-accent hover:bg-accent-dark text-white text-[12px] font-medium rounded-md transition-colors">
                            ${t('ai.assist.try_again')}
                        </button>
                    </div>
                </div>
            `}

            ${view === 'result' && html`
                <div class="flex flex-col">
                    <div class="px-3 py-2 border-b border-border-light text-[11px] font-semibold text-text-muted uppercase tracking-wide">
                        ${t('ai.assist.suggestion')}
                    </div>
                    <div class="p-3 max-h-72 overflow-y-auto text-[13px] text-text whitespace-pre-wrap leading-relaxed">${result?.text}</div>
                    <div class="flex justify-end gap-1 px-3 py-2 border-t border-border-light bg-bg">
                        <button onclick=${tryAgain}
                            class="px-3 py-1.5 text-[12px] text-text-secondary hover:text-text rounded-md transition-colors">
                            ${t('ai.assist.try_again')}
                        </button>
                        <button onclick=${onClose}
                            class="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] text-text-secondary hover:text-text rounded-md transition-colors">
                            <${X} size=${12} /> ${t('ai.assist.reject')}
                        </button>
                        <button onclick=${accept}
                            class="inline-flex items-center gap-1 px-3 py-1.5 bg-accent hover:bg-accent-dark text-white text-[12px] font-medium rounded-md transition-colors">
                            <${Check} size=${12} /> ${t('ai.assist.accept')}
                        </button>
                    </div>
                </div>
            `}
        </div>
    `;
}

function MenuView({ hasSelection, onPick }) {
    return html`
        <div class="py-1">
            <${MenuItem} label=${t('ai.assist.rewrite')} disabled=${!hasSelection}
                trailing=${html`<${ChevronRight} size=${12} />`}
                onClick=${() => onPick(null, 'tones')} />
            <${MenuItem} label=${t('ai.assist.continue')}
                onClick=${() => onPick('continue')} />
            <${MenuItem} label=${t('ai.assist.summarize')} disabled=${!hasSelection}
                onClick=${() => onPick('summarize')} />
            <${MenuItem} label=${t('ai.assist.translate')} disabled=${!hasSelection}
                trailing=${html`<${ChevronRight} size=${12} />`}
                onClick=${() => onPick(null, 'langs')} />
            <${MenuItem} label=${t('ai.assist.fix_grammar')} disabled=${!hasSelection}
                onClick=${() => onPick('fix_grammar')} />
            <div class="my-1 border-t border-border-light"></div>
            <${MenuItem} label=${t('ai.assist.custom')}
                onClick=${() => onPick(null, 'custom')} />
            ${!hasSelection && html`
                <div class="px-3 py-2 text-[11px] text-text-muted italic">${t('ai.assist.select_hint')}</div>
            `}
        </div>
    `;
}

function SubmenuView({ title, onBack, children }) {
    return html`
        <${Fragment}>
            <div class="flex items-center gap-1 px-2 py-1.5 border-b border-border-light bg-bg">
                <button onclick=${onBack}
                    class="p-1 rounded hover:bg-border-light text-text-muted hover:text-text">
                    <${ChevronLeft} size=${14} />
                </button>
                <div class="text-[12px] font-semibold text-text">${title}</div>
            </div>
            <div class="py-1">${children}</div>
        <//>
    `;
}

function MenuItem({ label, onClick, disabled, trailing }) {
    return html`
        <button type="button"
            onclick=${onClick}
            disabled=${disabled}
            class="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-[13px] ${disabled
                ? 'text-text-muted/50 cursor-not-allowed'
                : 'text-text hover:bg-border-light/60'} transition-colors">
            <span>${label}</span>
            ${trailing}
        </button>
    `;
}
