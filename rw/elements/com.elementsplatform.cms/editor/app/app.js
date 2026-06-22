import { h, render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { api } from './api.js?v=20260538';
import { user, csrf, config, configured, license, loading, isLoggedIn, isOwner } from './state.js?v=20260538';
import { applyTheme, setupAutoListener } from './theme.js?v=20260538';
import { setLocale } from './i18n.js?v=20260538';
import { route, currentPath, match } from './router.js?v=20260538';

// Components
import { Layout } from './components/Layout.js?v=20260538';
import { Flash } from './components/Flash.js?v=20260538';

// Pages
import { Login } from './pages/Login.js?v=20260538';
import { Setup } from './pages/Setup.js?v=20260538';
import { Welcome } from './pages/Welcome.js?v=20260538';
import { FileList } from './pages/FileList.js?v=20260538';
import { FileNew } from './pages/FileNew.js?v=20260538';
import { FileEdit } from './pages/FileEdit.js?v=20260538';
import { Resources } from './pages/Resources.js?v=20260538';
import { UsersList } from './pages/Users.js?v=20260538';
import { Account } from './pages/Account.js?v=20260538';
import { Theme } from './pages/Theme.js?v=20260538';
import { License } from './pages/License.js?v=20260538';
import { Webhooks } from './pages/Webhooks.js?v=20260538';
import { AI } from './pages/AI.js?v=20260538';
import { Api } from './pages/Api.js?v=20260538';

const html = htm.bind(h);

function App() {
    const [ready, setReady] = useState(false);

    useEffect(() => { checkSession(); }, []);

    async function checkSession() {
        // First check if the app is configured
        const status = await api('setup.status', { silent: true });
        if (status && !status.configured) {
            loading.value = false;
            route('/setup');
            setReady(true);
            return;
        }
        configured.value = true;

        // Check existing session
        const data = await api('session', { silent: true });
        if (data && !data.authenticated && data.default_language) {
            setLocale(data.default_language);
        }

        if (data && data.authenticated) {
            user.value = data.user;
            csrf.value = data.csrf;
            config.value = data.config;
            if (data.license) {
                license.value = data.license;
            }
            setLocale(data.user?.language || data.config?.language || 'en');
            const t = data.config?.theme;
            applyTheme(t?.preset, t?.accent_color, t?.font_heading, t?.font_body, t?.custom_palette, t?.surface_color);
            setupAutoListener(t?.preset, t?.accent_color, t?.font_heading, t?.font_body, t?.custom_palette, t?.surface_color);

            if (isOwner.value) {
                api('config.setAdminUrl', {
                    method: 'POST',
                    body: { url: window.location.origin + window.location.pathname },
                    silent: true,
                });
            }
        }

        loading.value = false;
        setReady(true);

        // Default redirect
        const path = currentPath.value;
        if (!isLoggedIn.value && path !== '/setup') {
            route('/login');
        } else if (isLoggedIn.value && (path === '/' || path === '/login')) {
            const folders = config.value?.folders;
            if (folders?.length > 0) {
                route(`/files/${folders[0].index}`);
            }
        }
    }

    if (!ready) {
        return html`<div class="flex items-center justify-center min-h-screen">
            <div class="text-text-secondary">Loading...</div>
        </div>`;
    }

    const path = currentPath.value;
    let m;

    // Public routes
    if (path === '/login') return html`<${Flash} /><${Login} />`;
    if (path === '/setup') {
        if (configured.value) { route('/login'); return null; }
        return html`<${Flash} /><${Setup} />`;
    }

    // Auth guard for all remaining routes
    if (!isLoggedIn.value) {
        route('/login');
        return null;
    }

    // Protected routes (more specific patterns first)
    if (m = match('/files/:folder/edit/:file')) return html`<${Flash} /><${Layout} fullBleed><${FileEdit} folder=${m.folder} file=${m.file} /><//>`;
    if (m = match('/files/:folder/new')) return html`<${Flash} /><${Layout} fullBleed><${FileNew} folder=${m.folder} /><//>`;
    if (m = match('/files/:folder')) return html`<${Flash} /><${Layout}><${FileList} folder=${m.folder} /><//>`;
    if (m = match('/resources/:folder')) return html`<${Flash} /><${Layout}><${Resources} folder=${m.folder} /><//>`;
    if (path === '/welcome') return html`<${Flash} /><${Welcome} />`;
    if (path === '/users') return html`<${Flash} /><${Layout}><${UsersList} /><//>`;
    if (path === '/account') return html`<${Flash} /><${Layout}><${Account} /><//>`;
    if (path === '/settings') {
        if (!isOwner.value) { route(`/files/${config.value?.folders?.[0]?.index || 0}`); return null; }
        return html`<${Flash} /><${Layout}><${Theme} /><//>`;
    }
    if (path === '/webhooks') {
        if (!isOwner.value) { route(`/files/${config.value?.folders?.[0]?.index || 0}`); return null; }
        return html`<${Flash} /><${Layout}><${Webhooks} /><//>`;
    }
    if (path === '/license') {
        if (!isOwner.value) { route(`/files/${config.value?.folders?.[0]?.index || 0}`); return null; }
        return html`<${Flash} /><${Layout}><${License} /><//>`;
    }
    if (path === '/ai') {
        if (!isOwner.value) { route(`/files/${config.value?.folders?.[0]?.index || 0}`); return null; }
        return html`<${Flash} /><${Layout}><${AI} /><//>`;
    }
    if (path === '/api') {
        if (!isOwner.value) { route(`/files/${config.value?.folders?.[0]?.index || 0}`); return null; }
        return html`<${Flash} /><${Layout}><${Api} /><//>`;
    }

    // Default fallback
    return html`<${Flash} /><${Login} />`;
}

const mountId = window.__ELEMENTS_CMS_CONFIG?.mountId || 'app';
render(html`<${App} />`, document.getElementById(mountId));
