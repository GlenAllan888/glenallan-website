// Signal-based hash router
import { signal } from '@preact/signals';

function parseHash(hash) {
    const raw = hash.startsWith('#') ? hash.slice(1) : hash;
    const qIdx = raw.indexOf('?');
    const path = (qIdx === -1 ? raw : raw.slice(0, qIdx)) || '/';
    const query = {};
    if (qIdx !== -1) {
        const params = new URLSearchParams(raw.slice(qIdx + 1));
        for (const [k, v] of params) query[k] = v;
    }
    return { path, query };
}

const initial = parseHash(location.hash);
export const currentPath = signal(initial.path);
export const currentQuery = signal(initial.query);

// Optional navigation guard. Returns true to allow navigation, false to block.
// Used to warn about unsaved changes before leaving a page.
let navGuard = null;
let prevHash = location.hash;
let reverting = false;
let programmatic = false;

export function setNavGuard(fn) {
    navGuard = fn;
}

export function clearNavGuard(fn) {
    // Only clear if this is still the active guard, so a stale unmount
    // doesn't clobber a guard registered by a newer component.
    if (navGuard === fn) navGuard = null;
}

window.addEventListener('hashchange', () => {
    if (reverting) {
        reverting = false;
        prevHash = location.hash;
        return;
    }
    if (programmatic) {
        // route() already ran the guard; don't prompt again.
        programmatic = false;
    } else if (navGuard && !navGuard()) {
        // Raw anchor navigation (e.g. <a href="#/...">) — guard declined,
        // revert the hash without touching the route signals.
        reverting = true;
        location.hash = prevHash;
        return;
    }
    prevHash = location.hash;
    const { path, query } = parseHash(location.hash);
    currentPath.value = path;
    currentQuery.value = query;
});

export function route(path) {
    if (navGuard && !navGuard()) return;
    const nextHash = '#' + path;
    // Only flag as programmatic if the hash will actually change (and thus
    // fire hashchange); otherwise the flag would linger and wrongly skip the
    // guard on a later raw-anchor navigation.
    if (location.hash !== nextHash) programmatic = true;
    currentPath.value = path;
    currentQuery.value = {};
    location.hash = nextHash;
}

// Replace the current hash query params without changing the path or
// pushing a history entry. Pass an object; keys with null/undefined are removed.
export function setQuery(updates) {
    const next = { ...currentQuery.value, ...updates };
    for (const k of Object.keys(next)) {
        if (next[k] === null || next[k] === undefined) delete next[k];
    }
    const params = new URLSearchParams(next).toString();
    const hash = '#' + currentPath.value + (params ? '?' + params : '');
    history.replaceState(null, '', location.pathname + location.search + hash);
    currentQuery.value = next;
}

// Match a route pattern like /files/:folder/edit/:file against the current path
export function match(pattern) {
    const path = currentPath.value;
    const pp = pattern.split('/');
    const parts = path.split('/');
    if (pp.length !== parts.length) return null;
    const params = {};
    for (let i = 0; i < pp.length; i++) {
        if (pp[i].startsWith(':')) {
            params[pp[i].slice(1)] = decodeURIComponent(parts[i]);
        } else if (pp[i] !== parts[i]) {
            return null;
        }
    }
    return params;
}
