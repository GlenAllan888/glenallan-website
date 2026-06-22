import en from './locales/en.js?v=20260538';
import sv from './locales/sv.js?v=20260538';
import fr from './locales/fr.js?v=20260538';
import de from './locales/de.js?v=20260538';
import nl from './locales/nl.js?v=20260538';

const locales = { en, sv, fr, de, nl };

let currentLocale = 'en';

export const availableLocales = [
    { code: 'en', label: 'English' },
    { code: 'sv', label: 'Svenska' },
    { code: 'fr', label: 'Français' },
    { code: 'de', label: 'Deutsch' },
    { code: 'nl', label: 'Nederlands' },
];

export function setLocale(code) {
    if (locales[code]) currentLocale = code;
}

export function t(key, params) {
    const lang = currentLocale;
    const str = locales[lang]?.[key] ?? locales.en[key] ?? key;
    if (!params) return str;
    return str.replace(/\{(\w+)\}/g, (_, k) => params[k] != null ? params[k] : `{${k}}`);
}
