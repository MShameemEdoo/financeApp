// Google sign-in for the WEB build (Metro picks this file instead of GoogleAuth.js on web).
//
// It exposes the same small surface as @react-native-google-signin/google-signin, so the
// rest of the app does not need to know which platform it is on.
//
// How it works: Google Identity Services "token" flow. A popup asks Google for an access
// token (valid ~1 hour) for the Drive scope. There is no backend, and no refresh token:
//   • while the token is valid, everything works silently
//   • when it expires, we try to renew it silently; if the browser blocks that (it usually
//     needs a click), getTokens() throws NEEDS_RECONNECT and the app shows a "Reconnect"
//     button. Nothing is lost meanwhile: data is saved locally and uploaded afterwards.

import { GOOGLE_WEB_CLIENT_ID, GOOGLE_SCOPES } from '../config';

export const googleAvailable = true;

export const statusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
};
export const isSuccessResponse = (r) => !!r && r.type === 'success';

const TOKEN_KEY = 'monei_web_token';   // { token, expiresAt }
const HINT_KEY  = 'monei_web_hint';    // email of the last signed-in account
const GIS_SRC   = 'https://accounts.google.com/gsi/client';

const store = {
  get(k)    { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  del(k)    { try { window.localStorage.removeItem(k); } catch (e) { /* ignore */ } },
};

const err = (code, message) => Object.assign(new Error(message || code), { code });

let scriptPromise = null;
function loadGis() {
  if (typeof window === 'undefined') return Promise.reject(err('NO_WINDOW'));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = GIS_SRC; el.async = true; el.defer = true;
    el.onload = () => resolve();
    el.onerror = () => { scriptPromise = null; reject(err('GIS_LOAD_FAILED', 'Could not load Google sign-in (are you offline?)')); };
    document.head.appendChild(el);
  });
  return scriptPromise;
}

let config = { webClientId: GOOGLE_WEB_CLIENT_ID, scopes: GOOGLE_SCOPES };
let client = null;
let pending = null;       // the one in-flight token request
let profile = null;       // { name, email, photo }

function cachedToken() {
  try {
    const raw = store.get(TOKEN_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw);
    return t?.token && t.expiresAt - 60_000 > Date.now() ? t : null;
  } catch (e) { return null; }
}

function ensureClient() {
  if (client) return client;
  client = window.google.accounts.oauth2.initTokenClient({
    client_id: config.webClientId,
    scope: config.scopes.join(' '),
    callback: (resp) => {
      const p = pending; pending = null;
      if (!p) return;
      if (resp.error || !resp.access_token) {
        p.reject(err(resp.error === 'access_denied' ? 'SIGN_IN_CANCELLED' : 'NEEDS_RECONNECT', resp.error_description || resp.error));
        return;
      }
      const expiresAt = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
      store.set(TOKEN_KEY, JSON.stringify({ token: resp.access_token, expiresAt }));
      p.resolve({ accessToken: resp.access_token });
    },
    error_callback: (e) => {
      const p = pending; pending = null;
      if (!p) return;
      // popup_closed = the person closed the window; popup_failed_to_open = blocked (silent attempts)
      p.reject(err(e?.type === 'popup_closed' ? 'SIGN_IN_CANCELLED' : 'NEEDS_RECONNECT', e?.message || e?.type));
    },
  });
  return client;
}

// One request at a time (a second popup while one is open would just be blocked)
async function requestToken({ prompt = '', silent = false } = {}) {
  await loadGis();
  if (pending) throw err('IN_PROGRESS', 'Sign-in already in progress');
  const c = ensureClient();
  const hint = store.get(HINT_KEY) || undefined;
  return new Promise((resolve, reject) => {
    let timer = null;
    pending = {
      resolve: (v) => { clearTimeout(timer); resolve(v); },
      reject:  (e) => { clearTimeout(timer); reject(e); },
    };
    if (silent) {
      // A silent attempt that the browser swallows never calls back: give up after a few seconds
      timer = setTimeout(() => { if (pending) { pending = null; reject(err('NEEDS_RECONNECT', 'Silent sign-in timed out')); } }, 6000);
    }
    try {
      c.requestAccessToken({ prompt, ...(hint ? { hint } : {}) });
    } catch (e) {
      pending = null; clearTimeout(timer);
      reject(err('NEEDS_RECONNECT', e?.message));
    }
  });
}

async function fetchProfile(token) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw err('PROFILE_FAILED', `Profile request failed (${res.status})`);
  const j = await res.json();
  profile = { name: j.name || j.email, email: j.email, photo: j.picture };
  store.set(HINT_KEY, j.email || '');
  return profile;
}

export const GoogleSignin = {
  configure(opts = {}) {
    config = { ...config, ...(opts.webClientId ? { webClientId: opts.webClientId } : {}), ...(opts.scopes ? { scopes: opts.scopes } : {}) };
    client = null;
    loadGis().catch(() => {});          // preload, so the sign-in click is instant
  },
  hasPlayServices: () => Promise.resolve(true),

  // Must be called from a click (it opens a popup)
  async signIn() {
    const { accessToken } = await requestToken({ prompt: '' });
    const user = await fetchProfile(accessToken);
    return { type: 'success', data: { user } };
  },

  // Re-use a still-valid token, else try to renew quietly. Throws NEEDS_RECONNECT if the browser wants a click.
  async signInSilently() {
    const { accessToken } = await this.getTokens();
    const user = profile || await fetchProfile(accessToken);
    return { type: 'success', data: { user } };
  },

  async getTokens() {
    const t = cachedToken();
    if (t) return { accessToken: t.token };
    if (!store.get(HINT_KEY)) throw err('NEEDS_RECONNECT', 'Not signed in');
    return requestToken({ prompt: '', silent: true });
  },

  // Forget the cached token (e.g. Drive said 401) so the next request renews it
  clearToken() { store.del(TOKEN_KEY); },

  async signOut() {
    store.del(TOKEN_KEY);
    store.del(HINT_KEY);
    profile = null;
  },
};
