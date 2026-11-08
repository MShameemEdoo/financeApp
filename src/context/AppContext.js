import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { GoogleSignin, statusCodes, isSuccessResponse, googleAvailable } from '../services/GoogleAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DriveService from '../services/GoogleDriveService';
import { stampChanges, mergeData, isPristine, fingerprint } from '../utils/syncMerge';
import { showAlert } from '../utils/alert';
import { GOOGLE_WEB_CLIENT_ID, GOOGLE_SCOPES, SYNC_POLL_MS } from '../config';
import { DEFAULT_CATEGORIES, GENERAL_CATEGORY_ID } from '../theme';
import { codeForLabel, currencyLabel } from '../utils/currencies';
import {
  genId, todayISO, spendingByCategory, sortTransactions, isNameTaken,
  shiftMonthKey, txDateISO,
  clampStartDay, periodKeyOfDate, periodStartISO, periodEndISO,
  formatPeriod, formatPeriodParts,
} from '../utils/formatters';

// ── Google Sign-In config ────────────────────────────────────────────────────
// webClientId = your Web OAuth 2.0 client ID from Google Cloud Console
// (APIs & Services → Credentials → Web client). See src/config.js.
if (googleAvailable) GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  scopes: GOOGLE_SCOPES,
  offlineAccess: true,
});

const KEYS = {
  TOKEN: 'gd_access_token',
  USER:  'gd_user_info',
  DATA:  'local_finance_data',
  SKIPPED: 'auth_skipped',   // user chose to use the app without signing in
};

const INITIAL_DATA = {
  version: 5,
  transactions: [],
  categories: DEFAULT_CATEGORIES,
  budgets: [
    { id: 'b1', category: 'food',      icon: '🍔', limit: 6000,  color: '#FF5C5C' },
    { id: 'b2', category: 'transport', icon: '🚗', limit: 4000,  color: '#B5FF4D' },
    { id: 'b3', category: 'shopping',  icon: '🛍️', limit: 5000,  color: '#4FE3A0' },
    { id: 'b4', category: 'bills',     icon: '📱', limit: 3500,  color: '#9370DB' },
    { id: 'b5', category: 'health',    icon: '💊', limit: 3500,  color: '#FFA500' },
  ],
  accounts: [
    { id: 'a1', name: 'Bank MCB', type: 'bank', icon: '🏦', color: '#5B8DEF' },
    { id: 'a2', name: 'Cash',     type: 'cash', icon: '💵', color: '#4FE3A0' },
  ],
  goals: [],
  settings: { currency: 'Rs', currencyCode: 'MUR', userName: 'User', monthStartDay: 1 },
};

// ── Data migration ────────────────────────────────────────────────────────────
// Idempotent. Brings older data (v4 and earlier) up to the current shape:
//  • seeds data.categories from the defaults
//  • renames the old 'other' category to 'general' (the permanent fallback)
//  • guarantees 'general' always exists
function migrateData(d) {
  if (!d) return d;
  const defaultGeneral = DEFAULT_CATEGORIES.find(c => c.id === GENERAL_CATEGORY_ID);

  let cats = Array.isArray(d.categories) && d.categories.length ? d.categories : DEFAULT_CATEGORIES;
  cats = cats.map(c => c.id === 'other'
    ? { ...c, id: GENERAL_CATEGORY_ID, name: c.name === 'Other' ? 'General' : c.name, type: 'both' }
    : c);
  if (!cats.some(c => c.id === GENERAL_CATEGORY_ID)) cats = [...cats, defaultGeneral];
  const general = cats.find(c => c.id === GENERAL_CATEGORY_ID);

  const transactions = (d.transactions || []).map(t => (
    t.category === 'other'
      ? { ...t, category: GENERAL_CATEGORY_ID, categoryName: general.name, icon: general.icon }
      : t
  ));
  const budgets = (d.budgets || []).map(b => (
    b.category === 'other' ? { ...b, category: GENERAL_CATEGORY_ID, icon: general.icon, color: general.color } : b
  ));

  // monthStartDay: which day of the month a tracking period starts on (1 = calendar months)
  const settings = { monthStartDay: 1, ...(d.settings || {}) };
  // currencyCode: needed for foreign-currency entries. Old data only has a label such as "Rs".
  if (!settings.currencyCode) settings.currencyCode = codeForLabel(settings.currency);

  return { ...d, version: 5, categories: cats, transactions, budgets, settings };
}

// Thrown when an account / category / budget name is already in use.
// Screens check first and show an inline message; this is the safety net.
function duplicateNameError(kind) {
  const e = new Error(`A ${kind} with this name already exists`);
  e.code = 'DUPLICATE_NAME';
  return e;
}

// Budget name = its custom name, falling back to its category's name
function budgetNameOf(b, categories = []) {
  return b.customName || categories.find(c => c.id === b.category)?.name || '';
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [data, setData]         = useState(INITIAL_DATA);
  const [user, setUser]         = useState(null);
  const [accessToken, setToken] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [syncing, setSyncing]   = useState(false);
  const [syncError, setSyncErr] = useState(null);
  // Signed in, but Google needs a click to renew access (web tokens last ~1 hour).
  // Data keeps saving on this device meanwhile and uploads after reconnecting.
  const [needsReconnect, setNeedsReconnect] = useState(false);
  // Signed in, but no Monei file was found in this Google account's Drive
  const [driveEmpty, setDriveEmpty] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [authSkipped, setAuthSkipped] = useState(false);
  // Month being viewed on Home / Budgets / Analytics / Transactions.
  // null = "follow today" (rolls over automatically on the 1st). Not persisted.
  const [pickedMonth, setPickedMonth] = useState(null);

  // One small message at the bottom of the screen ("Expense added · Undo")
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const toastSeq   = useRef(0);
  // The transaction currently open in the shared edit / delete sheet
  const [sheetTx, setSheetTx] = useState(null);

  // Always-current copies for async callbacks that would otherwise see a stale closure
  const dataRef = useRef(data);
  dataRef.current = data;
  const userRef  = useRef(null);
  const tokenRef = useRef(null);

  const applyUser  = useCallback((u) => { userRef.current = u; setUser(u); }, []);
  const applyToken = useCallback((t) => { tokenRef.current = t; setToken(t); }, []);

  // ── Sync engine ──────────────────────────────────────────────────
  // One loop does everything that touches Drive: download → merge with this device →
  // upload (only if something changed). Edits, sign-in, the timer, "Sync now" and coming
  // back to the app all just call syncNow(); calls made while a sync runs are coalesced
  // into one more pass. Nothing here ever blocks the UI: saves hit local storage first.

  // A valid access token, or throws. On the web an expired token needs a click to renew
  // (NEEDS_RECONNECT); on the phone the native module renews it silently.
  const getToken = useCallback(async () => {
    try {
      const tokens = await GoogleSignin.getTokens();
      if (tokens.accessToken) {
        if (tokens.accessToken !== tokenRef.current) {
          applyToken(tokens.accessToken);
          AsyncStorage.setItem(KEYS.TOKEN, tokens.accessToken).catch(() => {});
        }
        return tokens.accessToken;
      }
    } catch (e) {
      if (e?.code === 'NEEDS_RECONNECT') throw e;
      console.warn('getTokens failed, using stored token:', e.message);
    }
    if (tokenRef.current) return tokenRef.current;
    throw Object.assign(new Error('Not signed in'), { code: 'NEEDS_RECONNECT' });
  }, [applyToken]);

  const syncOnce = useCallback(async () => {
    const token = await getToken();
    // Throws if the read fails. That is deliberate: a failed read must never look like
    // "Drive is empty", or we could overwrite good data with this device's copy.
    const remoteRaw = await DriveService.loadData(token);
    const remote = remoteRaw ? migrateData(remoteRaw) : null;

    // Merge against the LATEST local data: it may have changed while we were downloading.
    const local = dataRef.current;
    const pristine = isPristine(local, INITIAL_DATA);
    let merged;
    if (!remote)        merged = local;
    else if (pristine)  merged = remote;                        // fresh install: adopt Drive's data as-is
    else                merged = migrateData(mergeData(local, remote));

    if (fingerprint(merged) !== fingerprint(local)) {
      dataRef.current = merged;                                 // synchronous, same tick as setData
      setData(merged);
      await AsyncStorage.setItem(KEYS.DATA, JSON.stringify(merged));
    }

    if (!remote && pristine) { setDriveEmpty(true); return; }   // nothing real to upload yet
    setDriveEmpty(false);
    if (!remote || fingerprint(merged) !== fingerprint(remote)) {
      await DriveService.saveData(token, merged);
    }
  }, [getToken]);

  const syncBusy  = useRef(false);
  const syncAgain = useRef(false);
  const syncNow = useCallback(async () => {
    if (!userRef.current) return;                               // guests: nothing to sync
    syncAgain.current = true;
    if (syncBusy.current) return;                               // the running loop will do another pass
    syncBusy.current = true;
    setSyncing(true);
    try {
      while (syncAgain.current) {
        syncAgain.current = false;
        try {
          await syncOnce();
          setSyncErr(null);
          setNeedsReconnect(false);
          setLastSyncedAt(Date.now());
        } catch (e) {
          if (e?.code === 'NEEDS_RECONNECT' || e?.status === 401) {
            GoogleSignin.clearToken?.();                        // drop the rejected token so the next try renews it
            setNeedsReconnect(true);
          } else {
            console.warn('Sync failed:', e.message);
            setSyncErr(e.message);
          }
        }
      }
    } finally {
      syncBusy.current = false;
      setSyncing(false);
    }
  }, [syncOnce]);

  // ── Bootstrap: restore session on app start ──────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedUser, storedData, storedSkipped] = await Promise.all([
          AsyncStorage.getItem(KEYS.TOKEN),
          AsyncStorage.getItem(KEYS.USER),
          AsyncStorage.getItem(KEYS.DATA),
          AsyncStorage.getItem(KEYS.SKIPPED),
        ]);
        if (storedData) {
          const loaded = migrateData(JSON.parse(storedData));
          dataRef.current = loaded;            // before any sync runs, so it merges THIS data, not the empty default
          setData(loaded);
        }
        if (storedSkipped === '1') setAuthSkipped(true);

        if (Platform.OS === 'web') {
          // Web: stay signed in and open instantly on the saved data. Google's token
          // is renewed in the background; if the browser needs a click, a Reconnect
          // button appears instead of kicking you back to the sign-in screen.
          if (storedUser) {
            applyUser(JSON.parse(storedUser));
            if (storedToken) applyToken(storedToken);
            syncNow();
          }
        } else if (storedToken && storedUser && googleAvailable) {
          // Phone: silently refresh the token via GoogleSignin
          try {
            const response = await GoogleSignin.signInSilently();
            if (isSuccessResponse(response)) {
              const tokens = await GoogleSignin.getTokens();
              const profile = response.data.user;
              const userObj = { name: profile.name, email: profile.email, picture: profile.photo };
              applyToken(tokens.accessToken);
              applyUser(userObj);
              await AsyncStorage.setItem(KEYS.TOKEN, tokens.accessToken);
              await AsyncStorage.setItem(KEYS.USER, JSON.stringify(userObj));
              syncNow();                       // background
            } else {
              // Credential not found — fall back to stored data, stay on auth screen
              applyToken(null);
              applyUser(null);
            }
          } catch (silentError) {
            // Silent sign-in failed — clear stale token, show auth screen
            console.warn('Silent sign-in failed:', silentError.message);
            await AsyncStorage.multiRemove([KEYS.TOKEN, KEYS.USER]);
            applyToken(null);
            applyUser(null);
          }
        }
        // No stored user = stay on auth screen (user stays null)
      } catch (e) {
        console.warn('Bootstrap error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Keep devices in step ─────────────────────────────────────────
  // Pull changes made elsewhere: when you come back to the app / tab, when the network
  // returns, and once a minute while it is open.
  useEffect(() => {
    if (!user) return undefined;
    const pull = () => syncNow();
    const timer = setInterval(() => {
      if (Platform.OS !== 'web' || document.visibilityState === 'visible') pull();
    }, SYNC_POLL_MS);

    let removeListeners = () => {};
    if (Platform.OS === 'web') {
      const onVisible = () => { if (document.visibilityState === 'visible') pull(); };
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('online', pull);
      removeListeners = () => {
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('online', pull);
      };
    } else {
      const sub = AppState.addEventListener('change', st => { if (st === 'active') pull(); });
      removeListeners = () => sub.remove();
    }
    return () => { clearInterval(timer); removeListeners(); };
  }, [user, syncNow]);

  // ── Skip sign-in (use the app locally without a Google account) ──
  const skipAuth = useCallback(async () => {
    setAuthSkipped(true);
    try { await AsyncStorage.setItem(KEYS.SKIPPED, '1'); } catch (e) { /* non-fatal */ }
  }, []);

  // ── Sign in (also used by the "Reconnect" button) ────────────────
  const signIn = useCallback(async () => {
    if (!googleAvailable) {
      showAlert(
        'Sign-in unavailable',
        "Google sign-in isn't supported in Expo Go. Use a development build (npx expo run:android or an EAS dev build) to sign in. Your data is still saved on this device."
      );
      return;
    }
    setSigningIn(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (isSuccessResponse(response)) {
        const tokens = await GoogleSignin.getTokens();
        const profile = response.data.user;
        const userObj = {
          name:    profile.name,
          email:   profile.email,
          picture: profile.photo,
        };
        applyToken(tokens.accessToken);
        applyUser(userObj);
        await AsyncStorage.setItem(KEYS.TOKEN, tokens.accessToken);
        await AsyncStorage.setItem(KEYS.USER, JSON.stringify(userObj));
        await AsyncStorage.removeItem(KEYS.SKIPPED);
        setAuthSkipped(false);
        setNeedsReconnect(false);
        syncNow();                                              // merges anything entered as a guest with Drive
      }
    } catch (error) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('Sign in cancelled');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log('Sign in already in progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        showAlert('Google Play Services missing', 'Google Play Services is not available or needs updating on this device/emulator. Use a device or an emulator image that includes Google Play.');
      } else {
        console.error('Sign-in error:', error);
        // Surface the real reason instead of failing silently
        const code = String(error?.code ?? '');
        const msg  = String(error?.message ?? '');
        const isDeveloperError = code === '10' || /DEVELOPER_ERROR|\b10\b/.test(msg);
        showAlert(
          isDeveloperError ? 'Sign-in setup error (DEVELOPER_ERROR)' : 'Sign-in failed',
          isDeveloperError
            ? 'Google rejected this build. In Google Cloud Console, create an Android OAuth client for package com.shameem.financetracker with the SHA-1 of the keystore that signed this build.'
            : `${msg || 'Unknown error'}${code ? `\n\nCode: ${code}` : ''}`
        );
      }
    } finally {
      setSigningIn(false);
    }
  }, [applyToken, applyUser, syncNow]);

  // ── Sign out ─────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    try {
      await GoogleSignin.signOut();
    } catch (e) {
      console.warn('GoogleSignin.signOut error:', e.message);
    }
    await AsyncStorage.multiRemove([KEYS.TOKEN, KEYS.USER, KEYS.DATA, KEYS.SKIPPED]);
    DriveService.reset();
    setAuthSkipped(false);
    applyUser(null);
    applyToken(null);
    dataRef.current = INITIAL_DATA;
    setData(INITIAL_DATA);
    setSelectedAccountId(null);
    setNeedsReconnect(false);
    setDriveEmpty(false);
    setSyncErr(null);
  }, [applyToken, applyUser]);

  // ── Persist ──────────────────────────────────────────────────────
  // Offline-first: stamp what changed (so devices can merge record by record), update the
  // screen + local storage immediately, then ask the sync loop to upload in the background.
  // Callers (and so modals) never wait on the network.
  const _persist = useCallback(async (newData) => {
    const stamped = stampChanges(dataRef.current, newData);
    dataRef.current = stamped;   // synchronous: the next action (e.g. Undo) must see this change
    setData(stamped);
    await AsyncStorage.setItem(KEYS.DATA, JSON.stringify(stamped));
    if (userRef.current) syncNow();   // intentionally not awaited
  }, [syncNow]);

  // ── Transaction actions ──────────────────────────────────────────
  // These actions read dataRef (not a render-time copy) so they stay correct when called
  // later — for example from a toast's Undo button after other changes were made.
  const addTransaction = useCallback(async (tx) => {
    const cur = dataRef.current;
    const newTx = { ...tx, id: genId('tx'), createdAt: new Date().toISOString() };
    await _persist({ ...cur, transactions: [newTx, ...cur.transactions] });
    return newTx;
  }, [_persist]);

  // Returns the removed transaction so the caller can offer Undo
  const deleteTransaction = useCallback(async (id) => {
    const cur = dataRef.current;
    const removed = cur.transactions.find(t => t.id === id);
    if (!removed) return null;
    await _persist({ ...cur, transactions: cur.transactions.filter(t => t.id !== id) });
    return removed;
  }, [_persist]);

  // Undo of a delete: puts the exact same transaction back
  const restoreTransaction = useCallback(async (tx) => {
    const cur = dataRef.current;
    if (!tx || cur.transactions.some(t => t.id === tx.id)) return;
    await _persist({ ...cur, transactions: [tx, ...cur.transactions] });
  }, [_persist]);

  const editTransaction = useCallback(async (id, updates) => {
    const cur = dataRef.current;
    await _persist({
      ...cur,
      transactions: cur.transactions.map(t => t.id === id ? { ...t, ...updates } : t),
    });
  }, [_persist]);

  // ── Transfer action ──────────────────────────────────────────────
  const addTransfer = useCallback(async ({ fromAccountId, fromAccountName, toAccountId, toAccountName, amount, note, date }) => {
    const newTx = {
      id:           genId('tr'),
      type:         'transfer',
      amount,
      fromAccountId,
      fromAccountName,
      toAccountId,
      toAccountName,
      accountId:    fromAccountId,
      accountName:  fromAccountName,
      icon:         '↔️',
      category:     'transfer',
      categoryName: 'Transfer',
      note:         note || '',
      date:         date || todayISO(),
      createdAt:    new Date().toISOString(),
    };
    const cur = dataRef.current;
    await _persist({ ...cur, transactions: [newTx, ...cur.transactions] });
    return newTx;
  }, [_persist]);

  // ── Currency ──────────────────────────────────────────────────────
  // Changes the label used for every amount. Existing amounts are NOT converted.
  const setCurrency = useCallback(async (code) => {
    const cur = dataRef.current;
    await _persist({
      ...cur,
      settings: { ...cur.settings, currencyCode: code, currency: currencyLabel(code) },
    });
  }, [_persist]);

  // ── Toast + shared transaction sheet ──────────────────────────────
  const dismissToast = useCallback(() => {
    clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  const showToast = useCallback(({ text, actionLabel, onAction, duration } = {}) => {
    clearTimeout(toastTimer.current);
    const id = ++toastSeq.current;
    setToast({ id, text, actionLabel, onAction });
    toastTimer.current = setTimeout(
      () => setToast(t => (t && t.id === id ? null : t)),
      duration || (actionLabel ? 5500 : 2800),
    );
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const openTransaction  = useCallback((tx) => setSheetTx(tx), []);
  const closeTransaction = useCallback(() => setSheetTx(null), []);

  // ── Category actions ─────────────────────────────────────────────
  const getCategory = useCallback((id) => {
    return data.categories.find(c => c.id === id)
      || data.categories.find(c => c.id === GENERAL_CATEGORY_ID);
  }, [data.categories]);

  const addCategory = useCallback(async ({ name, icon, color, type }) => {
    if (isNameTaken(data.categories, name)) throw duplicateNameError('category');
    const cat = { id: genId('c'), name: name.trim(), icon, color, type };
    await _persist({ ...data, categories: [...data.categories, cat] });
    return cat;
  }, [data, _persist]);

  // Edit name / icon / color. Type is fixed after creation so existing
  // transactions never end up under a category of the wrong kind.
  // Transactions and budgets keep a copy of the name/icon/color, so refresh those too.
  const updateCategory = useCallback(async (id, { name, icon, color }) => {
    const nextName = name.trim();
    if (isNameTaken(data.categories, nextName, id)) throw duplicateNameError('category');
    await _persist({
      ...data,
      categories: data.categories.map(c => c.id === id ? { ...c, name: nextName, icon, color } : c),
      transactions: data.transactions.map(t =>
        t.type !== 'transfer' && t.category === id ? { ...t, categoryName: nextName, icon } : t),
      budgets: data.budgets.map(b => b.category === id ? { ...b, icon, color } : b),
    });
  }, [data, _persist]);

  // Delete a category. Everything assigned to it moves to General.
  // 'general' itself can never be deleted.
  const deleteCategory = useCallback(async (id) => {
    if (id === GENERAL_CATEGORY_ID) return;
    const general = data.categories.find(c => c.id === GENERAL_CATEGORY_ID);
    const hasGeneralBudget = data.budgets.some(b => b.category === GENERAL_CATEGORY_ID);

    const transactions = data.transactions.map(t =>
      t.type !== 'transfer' && t.category === id
        ? { ...t, category: GENERAL_CATEGORY_ID, categoryName: general.name, icon: general.icon }
        : t);

    // A budget for the deleted category moves to General. If General already has
    // a budget, the orphaned one is dropped instead of creating a duplicate.
    let budgets = data.budgets;
    if (hasGeneralBudget) {
      budgets = budgets.filter(b => b.category !== id);
    } else {
      budgets = budgets.map(b => b.category === id
        ? { ...b, category: GENERAL_CATEGORY_ID, icon: general.icon, color: general.color }
        : b);
    }

    await _persist({
      ...data,
      categories: data.categories.filter(c => c.id !== id),
      transactions,
      budgets,
    });
  }, [data, _persist]);

  // ── Account actions ──────────────────────────────────────────────
  const addAccount = useCallback(async (account) => {
    if (isNameTaken(data.accounts, account.name)) throw duplicateNameError('account');
    await _persist({ ...data, accounts: [...data.accounts, { ...account, id: genId('a') }] });
  }, [data, _persist]);

  const deleteAccount = useCallback(async (accountId) => {
    await _persist({ ...data, accounts: data.accounts.filter(a => a.id !== accountId) });
    if (selectedAccountId === accountId) setSelectedAccountId(null);
  }, [data, _persist, selectedAccountId]);

  const updateAccount = useCallback(async (accountId, updates) => {
    if (updates.name !== undefined) {
      const current = data.accounts.find(a => a.id === accountId);
      const changed = !current || current.name.trim().toLowerCase() !== updates.name.trim().toLowerCase();
      // Only check when the name actually changed, so older data that already
      // contains duplicates can still be edited (e.g. color / starting amount)
      if (changed && isNameTaken(data.accounts, updates.name, accountId)) throw duplicateNameError('account');
    }
    await _persist({
      ...data,
      accounts: data.accounts.map(a => a.id === accountId ? { ...a, ...updates } : a),
    });
  }, [data, _persist]);

  // ── Budget actions ───────────────────────────────────────────────
  const updateBudget = useCallback(async (budgetId, limit, customName) => {
    if (customName !== undefined) {
      const current = data.budgets.find(b => b.id === budgetId);
      const changed = !current || budgetNameOf(current, data.categories).trim().toLowerCase() !== customName.trim().toLowerCase();
      if (changed && isNameTaken(data.budgets, customName, budgetId, b => budgetNameOf(b, data.categories))) {
        throw duplicateNameError('budget');
      }
    }
    await _persist({
      ...data,
      budgets: data.budgets.map(b => b.id === budgetId
        ? { ...b, limit, ...(customName !== undefined ? { customName } : {}) }
        : b),
    });
  }, [data, _persist]);

  const addBudget = useCallback(async (budget) => {
    const name = budget.customName || data.categories.find(c => c.id === budget.category)?.name || '';
    if (isNameTaken(data.budgets, name, null, b => budgetNameOf(b, data.categories))) throw duplicateNameError('budget');
    await _persist({ ...data, budgets: [...data.budgets, { ...budget, id: genId('b') }] });
  }, [data, _persist]);

  const deleteBudget = useCallback(async (budgetId) => {
    await _persist({ ...data, budgets: data.budgets.filter(b => b.id !== budgetId) });
  }, [data, _persist]);

  // ── Goal actions ─────────────────────────────────────────────────
  const addGoal = useCallback(async (goal) => {
    await _persist({ ...data, goals: [...data.goals, { ...goal, id: genId('g'), saved: 0 }] });
  }, [data, _persist]);

  const contributeToGoal = useCallback(async (goalId, amount) => {
    await _persist({
      ...data,
      goals: data.goals.map(g => g.id === goalId ? { ...g, saved: (g.saved || 0) + amount } : g),
    });
  }, [data, _persist]);

  // ── Computed values ──────────────────────────────────────────────
  // asOfISO (optional 'YYYY-MM-DD'): only count transactions on or before that date.
  // Omit it for the live balance (everything).
  const getAccountBalance = useCallback((accountId, asOfISO = null) => {
    const start = data.accounts.find(a => a.id === accountId)?.startingBalance || 0;
    return data.transactions.reduce((bal, t) => {
      if (asOfISO && txDateISO(t) > asOfISO) return bal;
      if (t.type === 'transfer') {
        if (t.fromAccountId === accountId) return bal - t.amount;
        if (t.toAccountId   === accountId) return bal + t.amount;
        return bal;
      }
      if (t.accountId !== accountId) return bal;
      return t.type === 'income' ? bal + t.amount : bal - t.amount;
    }, start);
  }, [data.transactions, data.accounts]);

  // ── Tracking periods / month navigation ──────────────────────────
  // monthStartDay (1–28) decides where each "month" begins. With 25, one period
  // runs from the 25th to the 24th of the next month. Day 1 = calendar months.
  // A period is identified by the 'YYYY-MM' of the month it STARTS in.
  const monthStartDay    = clampStartDay(data.settings?.monthStartDay ?? 1);
  const todayKey         = periodKeyOfDate(new Date(), monthStartDay);
  const selectedMonthKey = pickedMonth || todayKey;
  const isCurrentMonth   = selectedMonthKey === todayKey;

  const periodStart = periodStartISO(selectedMonthKey, monthStartDay);
  const periodEnd   = periodEndISO(selectedMonthKey, monthStartDay);

  const formatPeriodLabel = useCallback((key) => formatPeriod(key, monthStartDay), [monthStartDay]);
  const formatPeriodPartsOf = useCallback((key) => formatPeriodParts(key, monthStartDay), [monthStartDay]);
  const periodLabel = formatPeriod(selectedMonthKey, monthStartDay);
  const periodWord  = monthStartDay === 1 ? 'month' : 'period';

  // Balances are shown "as at the end of" the viewed period. The current period
  // has no cut-off, so it always matches the live balance on the Accounts screen.
  const balanceCutoff = isCurrentMonth ? null : periodEnd;

  // Which periods have transactions (for the picker dots) and how far you can navigate:
  // from the earliest period with data to the latest (or the current one, whichever is later).
  const monthsWithData = useMemo(() => {
    const set = new Set();
    data.transactions.forEach(t => set.add(periodKeyOfDate(txDateISO(t), monthStartDay)));
    return set;
  }, [data.transactions, monthStartDay]);

  const { minMonthKey, maxMonthKey } = useMemo(() => {
    const keys = [...monthsWithData, todayKey, selectedMonthKey].sort();
    return { minMonthKey: keys[0], maxMonthKey: keys[keys.length - 1] };
  }, [monthsWithData, todayKey, selectedMonthKey]);

  const canGoPrev = selectedMonthKey > minMonthKey;
  const canGoNext = selectedMonthKey < maxMonthKey;

  const setSelectedMonth = useCallback((key) => {
    setPickedMonth(!key || key === periodKeyOfDate(new Date(), monthStartDay) ? null : key);
  }, [monthStartDay]);
  const goPrevMonth = useCallback(() => {
    setPickedMonth(prev => {
      const cur = periodKeyOfDate(new Date(), monthStartDay);
      const k = shiftMonthKey(prev || cur, -1);
      return k === cur ? null : k;
    });
  }, [monthStartDay]);
  const goNextMonth = useCallback(() => {
    setPickedMonth(prev => {
      const cur = periodKeyOfDate(new Date(), monthStartDay);
      const k = shiftMonthKey(prev || cur, 1);
      return k === cur ? null : k;
    });
  }, [monthStartDay]);
  const goToCurrentMonth = useCallback(() => setPickedMonth(null), []);

  // Change which day of the month tracking starts on. Transactions are not touched —
  // only how they are grouped. Resets the view to the current period.
  const setMonthStartDay = useCallback(async (day) => {
    const d = clampStartDay(day);
    setPickedMonth(null);
    await _persist({ ...data, settings: { ...data.settings, monthStartDay: d } });
  }, [data, _persist]);

  // Default date for new entries: today for the current period; otherwise a date
  // inside the viewed period, so what you add doesn't vanish into another one.
  const defaultEntryDate = isCurrentMonth ? todayISO()
    : selectedMonthKey < todayKey ? periodEnd
    : periodStart;

  const totalBalance = useMemo(() => {
    if (selectedAccountId) return getAccountBalance(selectedAccountId, balanceCutoff);
    return data.accounts.reduce((s, a) => s + getAccountBalance(a.id, balanceCutoff), 0);
  }, [data.accounts, data.transactions, selectedAccountId, getAccountBalance, balanceCutoff]);

  const filteredTxs = useMemo(() => {
    // Sorted by transaction date (not insertion order) so back-dated entries land in the right place
    const sorted = sortTransactions(data.transactions);
    if (!selectedAccountId) return sorted;
    return sorted.filter(t => {
      if (t.type === 'transfer') return t.fromAccountId === selectedAccountId || t.toAccountId === selectedAccountId;
      return t.accountId === selectedAccountId;
    });
  }, [data.transactions, selectedAccountId]);

  const monthlyTxs = useMemo(
    () => filteredTxs.filter(t => { const d = txDateISO(t); return d >= periodStart && d <= periodEnd; }),
    [filteredTxs, periodStart, periodEnd],
  );
  // How often each category is used + the account used last → smart defaults in the Add screen
  const categoryUsage = useMemo(() => {
    const counts = {};
    data.transactions.forEach(t => { if (t.type !== 'transfer') counts[t.category] = (counts[t.category] || 0) + 1; });
    return counts;
  }, [data.transactions]);

  const lastUsedAccountId = useMemo(() => {
    let best = null;
    data.transactions.forEach(t => {
      if (t.type === 'transfer' || !t.accountId) return;
      if (!best || (t.createdAt || '') > (best.createdAt || '')) best = t;
    });
    return best && data.accounts.some(a => a.id === best.accountId) ? best.accountId : null;
  }, [data.transactions, data.accounts]);

  const monthlyNonTransfer = useMemo(() => monthlyTxs.filter(t => t.type !== 'transfer'), [monthlyTxs]);

  const totalIncome   = useMemo(() => monthlyNonTransfer.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), [monthlyNonTransfer]);
  const totalExpenses = useMemo(() => monthlyNonTransfer.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [monthlyNonTransfer]);
  const netBalance    = totalIncome - totalExpenses;
  const catSpending   = useMemo(() => spendingByCategory(monthlyNonTransfer), [monthlyNonTransfer]);

  return (
    <AppContext.Provider value={{
      data, user, accessToken, loading, signingIn, syncing, syncError,
      needsReconnect, driveEmpty, lastSyncedAt,
      authSkipped, skipAuth, googleAvailable,
      selectedAccountId, setSelectedAccountId,
      selectedMonthKey, isCurrentMonth, balanceCutoff, defaultEntryDate,
      monthStartDay, setMonthStartDay, periodStart, periodEnd, periodLabel, periodWord,
      formatPeriodLabel, formatPeriodParts: formatPeriodPartsOf,
      monthsWithData, minMonthKey, maxMonthKey, canGoPrev, canGoNext,
      setSelectedMonth, goPrevMonth, goNextMonth, goToCurrentMonth,
      signIn, reconnect: signIn, signOut, manualSync: syncNow,
      addTransaction, deleteTransaction, editTransaction, restoreTransaction,
      toast, showToast, dismissToast, sheetTx, openTransaction, closeTransaction,
      setCurrency, currencyCode: data.settings.currencyCode || null,
      categoryUsage, lastUsedAccountId,
      addTransfer,
      categories: data.categories, getCategory, addCategory, updateCategory, deleteCategory,
      addAccount, deleteAccount, updateAccount, getAccountBalance,
      updateBudget, addBudget, deleteBudget,
      addGoal, contributeToGoal,
      filteredTxs, monthlyTxs, totalIncome, totalExpenses,
      netBalance, catSpending, totalBalance,
      currency: data.settings.currency,
      userName: user?.name || data.settings.userName,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
};
