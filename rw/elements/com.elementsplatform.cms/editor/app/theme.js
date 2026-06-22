// ---------------------------------------------------------------------------
// Theme: Color Palettes, Presets, Fonts, and Runtime Application
// ---------------------------------------------------------------------------

// Tailwind color palette RGB triplets (shade → 'R G B')
export const colorPalettes = {
    purple: {
        50: '250 245 255', 100: '243 232 255', 200: '233 213 255',
        300: '216 180 254', 400: '192 132 252', 500: '168 85 247',
        600: '147 51 234',  700: '126 34 206',  800: '107 33 168',
        900: '88 28 135',   950: '59 7 100',
    },
    blue: {
        50: '239 246 255', 100: '219 234 254', 200: '191 219 254',
        300: '147 197 253', 400: '96 165 250',  500: '59 130 246',
        600: '37 99 235',   700: '29 78 216',   800: '30 64 175',
        900: '30 58 138',   950: '23 37 84',
    },
    indigo: {
        50: '238 242 255', 100: '224 231 255', 200: '199 210 254',
        300: '165 180 252', 400: '129 140 248', 500: '99 102 241',
        600: '79 70 229',   700: '67 56 202',   800: '55 48 163',
        900: '49 46 129',   950: '30 27 75',
    },
    teal: {
        50: '240 253 250', 100: '204 251 241', 200: '153 246 228',
        300: '94 234 212',  400: '45 212 191',  500: '20 184 166',
        600: '13 148 136',  700: '15 118 110',  800: '17 94 89',
        900: '19 78 74',    950: '4 47 46',
    },
    emerald: {
        50: '236 253 245', 100: '209 250 229', 200: '167 243 208',
        300: '110 231 183', 400: '52 211 153',  500: '16 185 129',
        600: '5 150 105',   700: '4 120 87',    800: '6 95 70',
        900: '6 78 59',     950: '2 44 34',
    },
    rose: {
        50: '255 241 242', 100: '255 228 230', 200: '254 205 211',
        300: '253 164 175', 400: '251 113 133', 500: '244 63 94',
        600: '225 29 72',   700: '190 18 60',   800: '159 18 57',
        900: '136 19 55',   950: '76 5 25',
    },
    amber: {
        50: '255 251 235', 100: '254 243 199', 200: '253 230 138',
        300: '252 211 77',  400: '251 191 36',  500: '245 158 11',
        600: '217 119 6',   700: '180 83 9',    800: '146 64 14',
        900: '120 53 15',   950: '69 26 3',
    },
    red: {
        50: '254 242 242', 100: '254 226 226', 200: '254 202 202',
        300: '252 165 165', 400: '248 113 113', 500: '239 68 68',
        600: '220 38 38',   700: '185 28 28',   800: '153 27 27',
        900: '127 29 29',   950: '69 10 10',
    },
    slate: {
        50: '248 250 252', 100: '241 245 249', 200: '226 232 240',
        300: '203 213 225', 400: '148 163 184', 500: '100 116 139',
        600: '71 85 105',   700: '51 65 85',    800: '30 41 59',
        900: '15 23 42',    950: '2 6 23',
    },
};

export const paletteNames = Object.keys(colorPalettes);

// Display labels for palette names
export const paletteLabels = {
    purple: 'Purple', blue: 'Blue', indigo: 'Indigo', teal: 'Teal',
    emerald: 'Emerald', rose: 'Rose', amber: 'Amber', red: 'Red', slate: 'Slate',
    custom: 'Custom',
};

// ---------------------------------------------------------------------------
// Hex ↔ RGB Triplet Conversion
// ---------------------------------------------------------------------------

// 'R G B' → '#rrggbb'
export function rgbTripletToHex(triplet) {
    const [r, g, b] = triplet.split(' ').map(Number);
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

// '#rrggbb' → 'R G B'
export function hexToRgbTriplet(hex) {
    const h = hex.replace('#', '');
    return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
    ].join(' ');
}

// ---------------------------------------------------------------------------
// Neutral palettes (surface colors) — standard Tailwind 3.4 neutrals
// ---------------------------------------------------------------------------

export const neutralPalettes = {
    slate: {
        50: '248 250 252', 100: '241 245 249', 200: '226 232 240',
        300: '203 213 225', 400: '148 163 184', 500: '100 116 139',
        600: '71 85 105',   700: '51 65 85',    800: '30 41 59',
        900: '15 23 42',    950: '2 6 23',
    },
    gray: {
        50: '249 250 251', 100: '243 244 246', 200: '229 231 235',
        300: '209 213 219', 400: '156 163 175', 500: '107 114 128',
        600: '75 85 99',    700: '55 65 81',    800: '31 41 55',
        900: '17 24 39',    950: '3 7 18',
    },
    zinc: {
        50: '250 250 250', 100: '244 244 245', 200: '228 228 231',
        300: '212 212 216', 400: '161 161 170', 500: '113 113 122',
        600: '82 82 91',    700: '63 63 70',    800: '39 39 42',
        900: '24 24 27',    950: '9 9 11',
    },
    neutral: {
        50: '250 250 250', 100: '245 245 245', 200: '229 229 229',
        300: '212 212 212', 400: '163 163 163', 500: '115 115 115',
        600: '82 82 82',    700: '64 64 64',    800: '38 38 38',
        900: '23 23 23',    950: '10 10 10',
    },
    stone: {
        50: '250 250 249', 100: '245 245 244', 200: '231 229 228',
        300: '214 211 209', 400: '168 162 158', 500: '120 113 108',
        600: '87 83 78',    700: '68 64 60',    800: '41 37 36',
        900: '28 25 23',    950: '12 10 9',
    },
};

export const neutralNames = ['slate', 'gray', 'zinc', 'neutral', 'stone'];

export const neutralLabels = {
    slate: 'Slate', gray: 'Gray', zinc: 'Zinc', neutral: 'Neutral', stone: 'Stone',
};

function buildSurfacePreset(surfaceColor, mode) {
    const palette = neutralPalettes[surfaceColor] || neutralPalettes.stone;
    if (mode === 'dark') {
        return {
            '--bg':             palette[950],
            '--surface':        palette[900],
            '--border':         palette[700],
            '--border-light':   palette[800],
            '--text':           palette[100],
            '--text-secondary': palette[400],
            '--text-muted':     palette[500],
            '--sidebar-bg':     palette[950],
        };
    }
    return {
        '--bg':             palette[50],
        '--surface':        '255 255 255',
        '--border':         palette[200],
        '--border-light':   palette[100],
        '--text':           palette[900],
        '--text-secondary': palette[500],
        '--text-muted':     palette[400],
        '--sidebar-bg':     palette[50],
    };
}

// ---------------------------------------------------------------------------
// Google Fonts
// ---------------------------------------------------------------------------

const SYSTEM_FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif";

export const fontOptions = [
    { key: 'system',           name: 'System Default',   family: SYSTEM_FONT_STACK, googleName: null },
    { key: 'inter',            name: 'Inter',            family: '"Inter"',            googleName: 'Inter' },
    { key: 'plus-jakarta',     name: 'Plus Jakarta Sans',family: '"Plus Jakarta Sans"', googleName: 'Plus+Jakarta+Sans' },
    { key: 'dm-sans',          name: 'DM Sans',          family: '"DM Sans"',          googleName: 'DM+Sans' },
    { key: 'outfit',           name: 'Outfit',           family: '"Outfit"',           googleName: 'Outfit' },
    { key: 'nunito',           name: 'Nunito',           family: '"Nunito"',           googleName: 'Nunito' },
    { key: 'poppins',          name: 'Poppins',          family: '"Poppins"',          googleName: 'Poppins' },
    { key: 'raleway',          name: 'Raleway',          family: '"Raleway"',          googleName: 'Raleway' },
    { key: 'lato',             name: 'Lato',             family: '"Lato"',             googleName: 'Lato' },
    { key: 'open-sans',        name: 'Open Sans',        family: '"Open Sans"',        googleName: 'Open+Sans' },
    { key: 'roboto',           name: 'Roboto',           family: '"Roboto"',           googleName: 'Roboto' },
    { key: 'source-sans-3',    name: 'Source Sans 3',    family: '"Source Sans 3"',    googleName: 'Source+Sans+3' },
    { key: 'merriweather',     name: 'Merriweather',     family: '"Merriweather"',     googleName: 'Merriweather' },
    { key: 'playfair-display', name: 'Playfair Display', family: '"Playfair Display"', googleName: 'Playfair+Display' },
];

function getFontOption(key) {
    return fontOptions.find(f => f.key === key) || fontOptions[0];
}

// Load or update a Google Font <link> tag in <head>
function loadGoogleFont(slotId, fontKey) {
    const font = getFontOption(fontKey);
    const existing = document.getElementById(slotId);

    if (!font.googleName) {
        if (existing) existing.remove();
        return;
    }

    const href = `https://fonts.googleapis.com/css2?family=${font.googleName}:wght@400;500;600;700&display=swap`;

    if (existing) {
        if (existing.getAttribute('href') !== href) {
            existing.setAttribute('href', href);
        }
        return;
    }

    const link = document.createElement('link');
    link.id = slotId;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
}

// ---------------------------------------------------------------------------
// Auto (system) preset helpers
// ---------------------------------------------------------------------------

const darkMQ = window.matchMedia('(prefers-color-scheme: dark)');

export function resolvePreset(preset) {
    if (preset === 'auto') return darkMQ.matches ? 'dark' : 'light';
    return preset;
}

let autoCleanup = null;

export function setupAutoListener(preset, accentColor, fontHeading, fontBody, customPalette, surfaceColor) {
    if (autoCleanup) { autoCleanup(); autoCleanup = null; }
    if (preset !== 'auto') return;
    const handler = () => applyTheme(preset, accentColor, fontHeading, fontBody, customPalette, surfaceColor);
    darkMQ.addEventListener('change', handler);
    autoCleanup = () => darkMQ.removeEventListener('change', handler);
}

// ---------------------------------------------------------------------------
// Apply Theme (call after config is loaded or on settings change)
// ---------------------------------------------------------------------------

export function applyTheme(preset, accentColor, fontHeading, fontBody, customPalette, surfaceColor) {
    const root = document.documentElement.style;
    const resolved = resolvePreset(preset);

    // Accent colors — map from full palette to the 3 main tokens
    const palette = (accentColor === 'custom' && customPalette)
        ? customPalette
        : (colorPalettes[accentColor] || colorPalettes.indigo);

    root.setProperty('--accent', palette[500]);
    root.setProperty('--accent-light', palette[50]);
    root.setProperty('--accent-dark', palette[600]);

    // Surface / structural colors
    const surface = buildSurfacePreset(surfaceColor || 'stone', resolved);
    for (const [prop, value] of Object.entries(surface)) {
        root.setProperty(prop, value);
    }

    // Dark mode class toggle
    if (resolved === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    // Fonts
    const headingFont = getFontOption(fontHeading || 'system');
    const bodyFont = getFontOption(fontBody || 'system');

    loadGoogleFont('gfont-heading', fontHeading || 'system');
    loadGoogleFont('gfont-body', fontBody || 'system');

    const fallback = ', ' + SYSTEM_FONT_STACK;
    root.setProperty('--font-heading', headingFont.family + (headingFont.googleName ? fallback : ''));
    root.setProperty('--font-body', bodyFont.family + (bodyFont.googleName ? fallback : ''));
}
