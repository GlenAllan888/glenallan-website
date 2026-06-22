import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { api } from '../api.js?v=20260538';
import { config, showFlash, featureEnabled } from '../state.js?v=20260538';
import { Loader, FolderOpen } from '../icons.js?v=20260538';
import { ResourceBrowserModal } from '../components/ResourceBrowserModal.js?v=20260538';
import { colorPalettes, paletteNames, paletteLabels, neutralPalettes, neutralNames, neutralLabels, fontOptions, applyTheme, setupAutoListener, rgbTripletToHex, hexToRgbTriplet } from '../theme.js?v=20260538';
import { SectionLayout } from '../components/SectionLayout.js?v=20260538';
import { PageHeader } from '../components/PageHeader.js?v=20260538';
import { CardSelector } from '../components/CardSelector.js?v=20260538';
import { FeatureAccessPrompt } from '../components/FeatureAccessPrompt.js?v=20260538';
import { t, availableLocales } from '../i18n.js?v=20260538';

const html = htm.bind(h);

const inputClass = 'w-full h-9 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/5 transition-shadow placeholder:text-text-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50';
const labelClass = 'block text-sm font-medium leading-none mb-2';

export function Theme() {
    const themeAllowed = featureEnabled('theme_customization');
    const [siteName, setSiteName] = useState('');
    const [logo, setLogo] = useState('');
    const [logoDark, setLogoDark] = useState('');
    const [preset, setPreset] = useState('light');
    const [accentColor, setAccentColor] = useState('purple');
    const [surfaceColor, setSurfaceColor] = useState('stone');
    const [headingFont, setHeadingFont] = useState('system');
    const [bodyFont, setBodyFont] = useState('system');
    const [customPalette, setCustomPalette] = useState(null);
    const [language, setLanguage] = useState('en');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [browseOpen, setBrowseOpen] = useState(false);
    const [browseOpenDark, setBrowseOpenDark] = useState(false);

    async function load() {
        if (!themeAllowed) {
            setLoading(false);
            return;
        }
        setLoading(true);
        const res = await api('theme.get');
        if (res && !res._error) {
            const th = res.theme || {};
            setSiteName(th.site_name || '');
            setLogo(th.logo || '');
            setLogoDark(th.logo_dark || '');
            setPreset(th.preset || 'light');
            setAccentColor(th.accent_color || 'purple');
            setSurfaceColor(th.surface_color || 'stone');
            setHeadingFont(th.font_heading || 'system');
            setBodyFont(th.font_body || 'system');
            setCustomPalette(th.custom_palette || { ...colorPalettes.purple });
            setLanguage(config.value?.language || 'en');
        }
        setLoading(false);
    }

    useEffect(() => { load(); }, [themeAllowed]);

    function preview(p, a, fh, fb, cp, sc) {
        const ac = a || accentColor;
        const pal = cp || (ac === 'custom' ? customPalette : undefined);
        applyTheme(p || preset, ac, fh || headingFont, fb || bodyFont, pal, sc || surfaceColor);
    }

    function handlePresetChange(p) {
        setPreset(p);
        preview(p);
        setupAutoListener(p, accentColor, headingFont, bodyFont, accentColor === 'custom' ? customPalette : undefined, surfaceColor);
    }

    function handleAccentChange(a) {
        setAccentColor(a);
        preview(null, a, null, null, a === 'custom' ? customPalette : undefined);
    }

    function handleSurfaceChange(s) {
        setSurfaceColor(s);
        preview(null, null, null, null, null, s);
    }

    function handleShadeChange(shade, hexValue) {
        const updated = { ...customPalette, [shade]: hexToRgbTriplet(hexValue) };
        setCustomPalette(updated);
        if (accentColor === 'custom') {
            preview(null, 'custom', null, null, updated);
        }
    }

    function handleHeadingFontChange(f) {
        setHeadingFont(f);
        preview(null, null, f);
    }

    function handleBodyFontChange(f) {
        setBodyFont(f);
        preview(null, null, null, f);
    }

    async function handleSave(e) {
        if (e) e.preventDefault();
        if (!themeAllowed) {
            showFlash('error', t('theme.license_required_desc'));
            return;
        }
        setSubmitting(true);
        const res = await api('theme.update', {
            method: 'POST',
            body: {
                site_name: siteName,
                logo,
                logo_dark: logoDark,
                preset,
                accent_color: accentColor,
                surface_color: surfaceColor,
                font_heading: headingFont,
                font_body: bodyFont,
                custom_palette: accentColor === 'custom' ? customPalette : null,
                language,
            },
        });
        setSubmitting(false);
        if (res && !res._error) {
            showFlash('success', t('theme.saved'));
            if (config.value) {
                config.value = {
                    ...config.value,
                    theme: {
                        ...config.value.theme,
                        site_name: siteName,
                        logo,
                        logo_dark: logoDark,
                        preset,
                        accent_color: accentColor,
                        surface_color: surfaceColor,
                        font_heading: headingFont,
                        font_body: bodyFont,
                        custom_palette: accentColor === 'custom' ? customPalette : null,
                    },
                };
            }
        }
    }

    if (loading) {
        return html`<div class="flex items-center justify-center py-20">
            <${Loader} className="text-accent-dark" />
        </div>`;
    }

    const themeSwatch = (mode) => html`
        <div class="w-10 h-8 rounded border flex overflow-hidden shrink-0 ${
            mode === 'light' ? 'border-slate-200 bg-white' : 'border-slate-600 bg-slate-900'
        }">
            <div class="w-3 h-full ${mode === 'light' ? 'bg-slate-100 border-r border-slate-200' : 'bg-slate-950 border-r border-slate-700'}"></div>
            <div class="flex-1"></div>
        </div>
    `;

    const autoSwatch = html`
        <div class="w-10 h-8 rounded border border-slate-300 flex overflow-hidden shrink-0">
            <div class="w-1/2 bg-white flex"><div class="w-3 h-full bg-slate-100 border-r border-slate-200"></div><div class="flex-1"></div></div>
            <div class="w-1/2 bg-slate-900 flex"><div class="w-3 h-full bg-slate-950 border-r border-slate-700"></div><div class="flex-1"></div></div>
        </div>
    `;

    const themeOptions = [
        { value: 'light', title: t('theme.light'), description: t('theme.light_desc'), swatch: themeSwatch('light') },
        { value: 'dark', title: t('theme.dark'), description: t('theme.dark_desc'), swatch: themeSwatch('dark') },
        { value: 'auto', title: t('theme.auto'), description: t('theme.auto_desc'), swatch: autoSwatch },
    ];

    return html`
        <${PageHeader} title=${t('theme.title')} subtitle=${t('theme.subtitle')} />

        ${!themeAllowed && html`
            <${FeatureAccessPrompt} description=${t('theme.license_required_desc')} />
        `}

        <div class="max-w-3xl mb-0">
            <${SectionLayout} title=${t('theme.default_language')} description=${t('theme.default_language_desc')}>
                <div>
                    <select
                        value=${language}
                        onChange=${e => setLanguage(e.target.value)}
                        class="${inputClass}"
                    >
                        ${availableLocales.map(l => html`<option value=${l.code}>${l.label}</option>`)}
                    </select>
                </div>
            <//>
        </div>

        <div class="max-w-3xl ${!themeAllowed ? 'opacity-50 pointer-events-none' : ''}">

            <!-- Site Identity -->
            <${SectionLayout} title=${t('theme.site_identity')} description=${t('theme.site_identity_desc')}>
                <div>
                    <label class="${labelClass}">${t('theme.site_name')}</label>
                    <input
                        type="text"
                        value=${siteName}
                        onInput=${e => setSiteName(e.target.value)}
                        class="${inputClass}"
                        placeholder=${t('theme.site_name_placeholder')}
                    />
                </div>
                <div>
                    <label class="${labelClass}">${t('theme.logo_url_light')}</label>
                    <div class="flex gap-1.5 min-w-0">
                        <input
                            type="text"
                            value=${logo}
                            onInput=${e => setLogo(e.target.value)}
                            class="${inputClass} flex-1 min-w-0 font-mono"
                            placeholder=${t('theme.logo_placeholder')}
                        />
                        <button type="button" onclick=${() => setBrowseOpen(true)}
                            class="shrink-0 px-2.5 h-9 rounded-lg border border-border bg-surface text-text-secondary shadow-sm shadow-black/5 hover:text-accent-dark transition-colors"
                            title=${t('theme.browse_resources')}>
                            <${FolderOpen} size=${14} />
                        </button>
                    </div>
                    ${logo && html`
                        <div class="mt-2 p-3 bg-bg rounded-lg">
                            <p class="text-[11px] text-text-muted mb-2">${t('theme.preview')}</p>
                            <img src=${logo} alt="Logo preview" class="h-8" onError=${e => { e.target.style.display = 'none'; }} />
                        </div>
                    `}
                    <${ResourceBrowserModal}
                        open=${browseOpen}
                        onClose=${() => setBrowseOpen(false)}
                        onSelect=${url => setLogo(url)}
                    />
                </div>
                <div>
                    <label class="${labelClass}">${t('theme.logo_url_dark')}</label>
                    <div class="flex gap-1.5 min-w-0">
                        <input
                            type="text"
                            value=${logoDark}
                            onInput=${e => setLogoDark(e.target.value)}
                            class="${inputClass} flex-1 min-w-0 font-mono"
                            placeholder=${t('theme.logo_placeholder')}
                        />
                        <button type="button" onclick=${() => setBrowseOpenDark(true)}
                            class="shrink-0 px-2.5 h-9 rounded-lg border border-border bg-surface text-text-secondary shadow-sm shadow-black/5 hover:text-accent-dark transition-colors"
                            title=${t('theme.browse_resources')}>
                            <${FolderOpen} size=${14} />
                        </button>
                    </div>
                    ${logoDark && html`
                        <div class="mt-2 p-3 bg-slate-900 rounded-lg">
                            <p class="text-[11px] text-slate-400 mb-2">${t('theme.preview')}</p>
                            <img src=${logoDark} alt="Dark logo preview" class="h-8" onError=${e => { e.target.style.display = 'none'; }} />
                        </div>
                    `}
                    <${ResourceBrowserModal}
                        open=${browseOpenDark}
                        onClose=${() => setBrowseOpenDark(false)}
                        onSelect=${url => setLogoDark(url)}
                    />
                </div>
            <//>

            <!-- Appearance -->
            <${SectionLayout} title=${t('theme.appearance')} description=${t('theme.appearance_desc')}>
                <div>
                    <label class="${labelClass}">${t('theme.mode')}</label>
                    <${CardSelector}
                        options=${themeOptions}
                        value=${preset}
                        onChange=${handlePresetChange}
                        columns=${3}
                    />
                </div>
                <div>
                    <label class="${labelClass}">${t('theme.brand_color')}</label>
                    <div class="flex flex-wrap gap-3">
                        ${paletteNames.map(name => {
                            const rgb = colorPalettes[name][600];
                            const isSelected = accentColor === name;
                            return html`
                                <button type="button" key=${name}
                                    onclick=${() => handleAccentChange(name)}
                                    class="w-8 h-8 rounded-full transition-shadow ${isSelected ? 'ring-2 ring-offset-2 ring-text' : 'hover:ring-2 hover:ring-offset-1 hover:ring-border'}"
                                    style="background-color: rgb(${rgb})"
                                    title=${paletteLabels[name]}
                                />
                            `;
                        })}
                        <button type="button"
                            onclick=${() => handleAccentChange('custom')}
                            class="w-8 h-8 rounded-full border-2 border-dashed flex items-center justify-center transition-shadow ${
                                accentColor === 'custom'
                                    ? 'border-accent-dark ring-2 ring-offset-2 ring-text'
                                    : 'border-border hover:ring-2 hover:ring-offset-1 hover:ring-border'
                            }"
                            style=${accentColor === 'custom' && customPalette ? `background-color: rgb(${customPalette[600]})` : ''}
                            title=${t('theme.custom')}
                        >
                            ${accentColor !== 'custom' && html`
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                            `}
                        </button>
                    </div>
                    ${accentColor === 'custom' && customPalette && html`
                        <div class="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
                            ${['50','100','200','300','400','500','600','700','800','900','950'].map(shade => html`
                                <label key=${shade} class="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value=${rgbTripletToHex(customPalette[shade])}
                                        onInput=${e => handleShadeChange(shade, e.target.value)}
                                        class="w-8 h-8 rounded cursor-pointer border border-border"
                                    />
                                    <span class="text-xs font-mono text-text-secondary">${shade}</span>
                                </label>
                            `)}
                        </div>
                    `}
                </div>
                <div>
                    <label class="${labelClass}">${t('theme.surface_color')}</label>
                    <div class="flex flex-wrap gap-3">
                        ${neutralNames.map(name => {
                            const rgb = neutralPalettes[name][500];
                            const isSelected = surfaceColor === name;
                            return html`
                                <button type="button" key=${name}
                                    onclick=${() => handleSurfaceChange(name)}
                                    class="w-8 h-8 rounded-full transition-shadow ${isSelected ? 'ring-2 ring-offset-2 ring-text' : 'hover:ring-2 hover:ring-offset-1 hover:ring-border'}"
                                    style="background-color: rgb(${rgb})"
                                    title=${neutralLabels[name]}
                                />
                            `;
                        })}
                    </div>
                </div>
            <//>

            <!-- Typography -->
            <${SectionLayout} title=${t('theme.typography')} description=${t('theme.typography_desc')} last=${true}>
                <div>
                    <label class="${labelClass}">${t('theme.heading_font')}</label>
                    <select
                        value=${headingFont}
                        onChange=${e => handleHeadingFontChange(e.target.value)}
                        class="${inputClass}"
                    >
                        ${fontOptions.map(f => html`
                            <option key=${f.key} value=${f.key}>${f.name}</option>
                        `)}
                    </select>
                    <div class="mt-3 bg-black/[0.03] rounded-lg px-4 py-3">
                        <p class="text-[15px] font-semibold text-text" style="font-family: var(--font-heading)">
                            ${t('theme.font_preview')}
                        </p>
                    </div>
                </div>
                <div class="pt-3">
                    <label class="${labelClass}">${t('theme.body_font')}</label>
                    <select
                        value=${bodyFont}
                        onChange=${e => handleBodyFontChange(e.target.value)}
                        class="${inputClass}"
                    >
                        ${fontOptions.map(f => html`
                            <option key=${f.key} value=${f.key}>${f.name}</option>
                        `)}
                    </select>
                    <div class="mt-3 bg-black/[0.03] rounded-lg px-4 py-3">
                        <p class="text-[13px] text-text-secondary" style="font-family: var(--font-body)">
                            ${t('theme.font_preview_long')}
                        </p>
                    </div>
                </div>
            <//>

            <div class="flex justify-end pt-6 mt-8 border-t border-border-light">
                <button
                    type="button"
                    onclick=${handleSave}
                    disabled=${submitting}
                    class="px-3 py-1.5 bg-accent hover:bg-accent-dark text-white rounded-btn text-[12px] font-medium disabled:opacity-50 transition-colors"
                >
                    ${submitting ? t('common.saving') : t('common.save')}
                </button>
            </div>

        </div>
    `;
}
