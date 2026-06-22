import { signal, computed } from '@preact/signals';

// Auth state
export const user = signal(null);       // { email, role }
export const csrf = signal('');
export const config = signal(null);     // { folders, resource_folders, theme, max_upload_bytes }
export const configured = signal(false); // Whether config.php exists on server
export const license = signal(null);    // { valid, status, domain, message, ... }
export const aiSettings = signal(null);  // { master_enabled, features, defaults, providers } — lazy-loaded on first AI surface

// UI state
export const flash = signal(null);      // { type: 'success'|'error', message }
export const loading = signal(true);    // Initial app load
export const sidebarOpen = signal(false);
export const sidebarCollapsed = signal(false); // Collapsed to icon-only mode
export const contentSubpath = signal(''); // Current subfolder path within content folder
export const sidebarTree = signal({}); // { [folderIndex]: { expanded, dirs, children: { [subpath]: { expanded, dirs } } } }
export const resourceSubpath = signal(''); // Current subfolder path within resource folder
export const resourceSidebarTree = signal({}); // Same structure as sidebarTree, for resource folders
export const resourcesActiveTab = signal('content'); // 'content' | 'settings' — which tab to show on the Resources page

// Computed
export const isAdmin = computed(() => user.value?.role === 'admin' || user.value?.role === 'owner');
export const isOwner = computed(() => user.value?.role === 'owner');
export const isLoggedIn = computed(() => user.value !== null);
export const isLicensed = computed(() => license.value?.valid === true);
export const tier = computed(() => license.value?.tier ?? 'free');

// Per-tier limits, sourced from the signed `/api/check` payload via
// client_config(). Falls back to free-tier defaults when no signed payload is
// present. Server-side enforcement lives inline in each gated PHP handler;
// this signal exists so the SPA can render tier-aware UX (greyed buttons,
// upsell copy, cap tooltips).
export const limits = computed(() => config.value?.limits ?? null);
export const featureEnabled = (flag) => Boolean(limits.value?.[flag]);
export const limitValue = (key, fallback = null) => {
    const v = limits.value?.[key];
    return v === undefined ? fallback : v;
};
export const siteName = computed(() => config.value?.theme?.site_name || 'Elements CMS');
export const siteLogo = computed(() => config.value?.theme?.logo || null);
export const siteLogoDark = computed(() => config.value?.theme?.logo_dark || null);
export const accentColor = computed(() => config.value?.theme?.accent_color || 'purple');
export const themePreset = computed(() => config.value?.theme?.preset || 'light');
export const fontHeading = computed(() => config.value?.theme?.font_heading || 'system');
export const fontBody = computed(() => config.value?.theme?.font_body || 'system');
export const customPalette = computed(() => config.value?.theme?.custom_palette || null);

// Flash message helper
let flashTimer = null;
export function showFlash(type, message, duration) {
    flash.value = { type, message };
    clearTimeout(flashTimer);
    const ms = duration ?? (type === 'warning' ? 8000 : 4000);
    flashTimer = setTimeout(() => { flash.value = null; }, ms);
}
