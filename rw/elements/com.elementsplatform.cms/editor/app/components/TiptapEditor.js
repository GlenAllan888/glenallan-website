import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import htm from 'htm';
import { Editor, StarterKit, Markdown, Image } from 'tiptap';

const html = htm.bind(h);

const ABS_URL_RE = /^(https?:\/\/|data:)/i;

function prefixImageUrls(md, basePath) {
    if (!basePath) return md;
    const base = basePath.replace(/\/$/, '');
    return md.replace(
        /!\[([^\]]*)\]\(([^)\s"]+)([^)]*)\)/g,
        (match, alt, url, rest) => {
            if (ABS_URL_RE.test(url)) return match;
            return `![${alt}](${base}/${url.replace(/^\//, '')}${rest})`;
        }
    );
}

function stripImageUrls(md, basePath) {
    if (!basePath) return md;
    const base = basePath.replace(/\/$/, '') + '/';
    return md.replace(
        /!\[([^\]]*)\]\(([^)\s"]+)([^)]*)\)/g,
        (match, alt, url, rest) => {
            if (ABS_URL_RE.test(url)) return match;
            if (!url.startsWith(base)) return match;
            return `![${alt}](${url.slice(base.length)}${rest})`;
        }
    );
}

export function TiptapEditor({ content, onChange, onEditorReady, onTextareaReady, placeholder, resourcesPath, rawMode }) {
    const containerRef = useRef(null);
    const textareaRef = useRef(null);
    const editorRef = useRef(null);
    const onChangeRef = useRef(onChange);
    const resourcesPathRef = useRef(resourcesPath);
    const contentRef = useRef(content);
    const skipNextUpdate = useRef(false);
    onChangeRef.current = onChange;
    resourcesPathRef.current = resourcesPath;
    contentRef.current = content;

    useEffect(() => {
        if (!containerRef.current) return;

        const editor = new Editor({
            element: containerRef.current,
            extensions: [
                StarterKit,
                Image,
                Markdown.configure({
                    html: false,
                    transformCopiedText: true,
                    transformPastedText: true,
                }),
            ],
            content: prefixImageUrls(content || '', resourcesPath),
            editorProps: {
                attributes: {
                    class: 'tiptap',
                    'data-placeholder': placeholder || 'Start writing...',
                },
            },
            onUpdate: ({ editor: ed }) => {
                if (skipNextUpdate.current) {
                    skipNextUpdate.current = false;
                    return;
                }
                if (onChangeRef.current) {
                    let md = ed.storage.markdown.getMarkdown();
                    md = stripImageUrls(md, resourcesPathRef.current);
                    onChangeRef.current(md);
                }
            },
        });

        editorRef.current = editor;
        if (onEditorReady) onEditorReady(editor);

        return () => {
            editor.destroy();
            editorRef.current = null;
        };
    }, []);

    // Sync TipTap content when switching back from raw mode
    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;

        if (rawMode) {
            // Switching to raw: sync latest from TipTap to parent
            let md = editor.storage.markdown.getMarkdown();
            md = stripImageUrls(md, resourcesPathRef.current);
            if (onChangeRef.current) onChangeRef.current(md);
        } else {
            // Switching to WYSIWYG: load current content into TipTap
            const prefixed = prefixImageUrls(contentRef.current || '', resourcesPathRef.current);
            skipNextUpdate.current = true;
            editor.commands.setContent(prefixed);
        }
    }, [rawMode]);

    // Expose textarea ref to parent
    useEffect(() => {
        if (onTextareaReady) onTextareaReady(textareaRef.current);
    }, [rawMode]);

    function handleTextareaInput(e) {
        if (onChangeRef.current) onChangeRef.current(e.target.value);
    }

    return html`
        <div ref=${containerRef} class="tiptap-editor" style=${rawMode ? 'display:none' : ''}></div>
        ${rawMode && html`
            <textarea
                ref=${textareaRef}
                class="raw-markdown-textarea"
                value=${content}
                oninput=${handleTextareaInput}
                placeholder=${placeholder || 'Start writing...'}
            />
        `}
    `;
}
