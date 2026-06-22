import { csrf, user, showFlash } from './state.js?v=20260538';
import { t } from './i18n.js?v=20260538';

const BASE = window.__ELEMENTS_CMS_CONFIG?.apiBase || 'api.php';

export async function api(action, opts = {}) {
    const params = opts.params ? '&' + new URLSearchParams(opts.params) : '';
    const url = `${BASE}?action=${action}${params}`;

    const fetchOpts = {
        credentials: 'same-origin',
    };

    if (opts.method === 'POST') {
        fetchOpts.method = 'POST';
        fetchOpts.headers = {};

        if (opts.body instanceof FormData) {
            // FormData for file uploads — add CSRF as header
            fetchOpts.headers['X-CSRF-Token'] = csrf.value;
            fetchOpts.body = opts.body;
        } else {
            fetchOpts.headers = {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrf.value,
            };
            fetchOpts.body = opts.body ? JSON.stringify(opts.body) : '{}';
        }
    }

    try {
        const res = await fetch(url, fetchOpts);
        const data = await res.json();

        if (res.status === 401) {
            user.value = null;
            location.hash = '#/login';
            return null;
        }

        if (data.error) {
            if (!opts.silent) {
                showFlash('error', data.error);
            }
            return { _error: data.error };
        }

        return data;
    } catch (e) {
        if (!opts.silent) {
            showFlash('error', t('common.network_error'));
        }
        return null;
    }
}
