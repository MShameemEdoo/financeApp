import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, StatusBar,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { radius, layout, useTheme, createStyles, useLayout } from '../theme';
import { useApp } from '../context/AppContext';
import { IconButton, Chip, Segmented, PrimaryButton } from '../components/ui';
import { DatePickerModal } from '../components/DatePickerModal';
import CurrencyPicker from '../components/CurrencyPicker';
import { formatCurrency, todayISO, yesterdayISO, relativeDateLabel } from '../utils/formatters';
import { currencyLabel } from '../utils/currencies';
import { getRate, convertAmount, formatRate } from '../services/ExchangeRateService';

const NOTE_MAX = 255;
const NO_ERRORS = { amount: false, cat: false, acct: false, to: false, rate: false };
const KEYS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['.', '0', '⌫']];

// "1250.5" → "1,250.5" (formats as you type, keeps a trailing "." or "0")
function typedFormat(str) {
  if (!str) return '0';
  const [int, frac] = str.split('.');
  const withCommas = (int || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return str.includes('.') ? `${withCommas}.${frac}` : withCommas;
}

function rateSourceText(fx) {
  const when = fx.date ? ` from ${relativeDateLabel(fx.date)}` : '';
  const base = fx.source === 'stale' ? `offline, last known rate${when}`
    : fx.source === 'cache' ? `saved rate${when}`
    : `live rate${when}`;
  return fx.approximate ? `${base} (closest available)` : base;
}

export default function AddTransactionScreen({ route, navigation }) {
  const s = useStyles();
  const { colors, isDark } = useTheme();
  const TYPE_OPTIONS = [
    { key: 'expense',  label: 'Expense',  color: colors.expense },
    { key: 'income',   label: 'Income',   color: colors.income },
    { key: 'transfer', label: 'Transfer', color: colors.blue },
  ];
  const {
    addTransaction, addTransfer, deleteTransaction, showToast,
    currency, currencyCode, data, categories, categoryUsage, lastUsedAccountId,
    selectedAccountId, defaultEntryDate, getAccountBalance,
  } = useApp();
  const insets = useSafeAreaInsets();

  const accounts = data.accounts;
  const firstAcct = selectedAccountId || lastUsedAccountId || accounts[0]?.id || null;
  const otherThan = id => accounts.find(a => a.id !== id)?.id || null;

  const [type, setType]           = useState('expense');
  const [amount, setAmount]       = useState('');
  const { isWide } = useLayout();
  const [selCat, setSelCat]       = useState(null);
  const [note, setNote]           = useState('');
  const [noteFocused, setNoteFocused] = useState(false);
  const [selAcctId, setSelAcctId] = useState(firstAcct);
  const [toAcctId, setToAcctId]   = useState(otherThan(firstAcct));
  const [date, setDate]           = useState(defaultEntryDate);
  const [dateOpen, setDateOpen]   = useState(false);
  const [fxCode, setFxCode]       = useState(null);          // null = your own currency
  const [pickerOpen, setPickerOpen] = useState(false);
  const [manualRate, setManualRate] = useState('');
  const [fx, setFx]               = useState({ status: 'idle' });
  const [retry, setRetry]         = useState(0);
  const [saving, setSaving]       = useState(false);
  const [errors, setErrors]       = useState(NO_ERRORS);

  // Fresh defaults are read at focus time through a ref so the effect below doesn't re-run
  // (and wipe what you're typing) whenever those values change.
  const defaultsRef = useRef({});
  defaultsRef.current = { acct: firstAcct, to: otherThan(firstAcct), date: defaultEntryDate };

  // Every time the screen opens: a clean form with smart defaults
  useFocusEffect(
    useCallback(() => {
      const d = defaultsRef.current;
      setType(route?.params?.defaultType || 'expense');
      setAmount(''); setSelCat(null); setNote(''); setNoteFocused(false);
      setSelAcctId(d.acct); setToAcctId(d.to); setDate(d.date);
      setFxCode(null); setManualRate(''); setErrors(NO_ERRORS); setSaving(false);
    }, [route?.params?.defaultType])
  );

  const isTransfer = type === 'transfer';
  const tint = type === 'expense' ? colors.expense : type === 'income' ? colors.income : colors.blue;
  const isForeign = !isTransfer && !!fxCode && !!currencyCode && fxCode !== currencyCode;

  // Exchange rate for the chosen foreign currency on the chosen date
  useEffect(() => {
    if (!isForeign) { setFx({ status: 'idle' }); return undefined; }
    let cancelled = false;
    setFx({ status: 'loading' });
    getRate({ from: fxCode, to: currencyCode, date })
      .then(r => { if (!cancelled) setFx({ status: 'ready', ...r }); })
      .catch(() => { if (!cancelled) setFx({ status: 'error' }); });
    return () => { cancelled = true; };
  }, [isForeign, fxCode, currencyCode, date, retry]);

  const manual    = parseFloat(manualRate);
  const rate      = fx.status === 'ready' ? fx.rate : (fx.status === 'error' && manual > 0 ? manual : null);
  const amountVal = parseFloat(amount) || 0;
  const baseAmount = !isForeign ? amountVal : (rate ? convertAmount(amountVal, rate) : null);

  // Categories you use most come first
  const displayCats = useMemo(() => (
    categories
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.type === type || c.type === 'both')
      .sort((a, b) => (categoryUsage[b.c.id] || 0) - (categoryUsage[a.c.id] || 0) || a.i - b.i)
      .map(x => x.c)
  ), [categories, type, categoryUsage]);

  const fromAcct = accounts.find(a => a.id === selAcctId);
  const fromBalance = fromAcct ? getAccountBalance(fromAcct.id) : 0;
  const notEnough = isTransfer && amountVal > 0 && amountVal > fromBalance;

  const handleKey = useCallback((key) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setErrors(e => (e.amount ? { ...e, amount: false } : e));
    setAmount(prev => {
      if (key === '⌫') return prev.slice(0, -1);
      if (key === '.') return prev.includes('.') ? prev : (prev === '' ? '0.' : `${prev}.`);
      if (prev.includes('.')) return prev.split('.')[1].length >= 2 ? prev : prev + key;   // 2 decimals max
      if (prev.length >= 9) return prev;
      return prev === '0' ? key : prev + key;
    });
  }, []);

  // ── Keyboard entry (web) ─────────────────────────────────────────
  // Type the amount (digits, ".", Backspace), Enter saves, Esc closes. Ignored while a
  // text box (note, manual rate) has focus or a pop-up is open.
  const saveRef  = useRef(null);
  const blockRef = useRef(false);
  saveRef.current  = handleSave;
  blockRef.current = dateOpen || pickerOpen;
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    let tabbing = false;   // true once the person has used Tab since they last used the mouse
    const onPointer = () => { tabbing = false; };
    const onKey = (e) => {
      if (e.key === 'Tab') { tabbing = true; return; }
      if (e.metaKey || e.ctrlKey || e.altKey || blockRef.current) return;
      const el = e.target;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
      if (e.key === 'Enter') {
        // Tabbing through the controls keeps the normal Enter-to-activate behaviour.
        // Otherwise (e.g. they just clicked a category with the mouse) Enter means Save.
        if (tabbing && !typing) return;
        e.preventDefault(); e.stopPropagation(); saveRef.current?.(); return;
      }
      if (typing) return;
      if (e.key === 'Escape') { navigation.goBack(); return; }
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); handleKey(e.key); }
      else if (e.key === '.' || e.key === ',') { e.preventDefault(); handleKey('.'); }
      else if (e.key === 'Backspace') { e.preventDefault(); handleKey('⌫'); }
    };
    window.addEventListener('keydown', onKey, true);       // capture: runs before a focused button handles the key
    window.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer, true);
    };
  }, [navigation, handleKey]));

  function changeType(next) {
    setType(next);
    setSelCat(null);
    setErrors(NO_ERRORS);
    if (next === 'transfer') {
      setFxCode(null);
      if (!toAcctId || toAcctId === selAcctId) setToAcctId(otherThan(selAcctId));
    }
  }

  function pickFrom(id) {
    setSelAcctId(id);
    setErrors(e => ({ ...e, acct: false }));
    if (toAcctId === id) setToAcctId(otherThan(id));
  }

  async function handleSave() {
    const val = parseFloat(amount);
    const errs = {
      amount: !(val > 0),
      cat:    !isTransfer && !selCat,
      acct:   !selAcctId,
      to:     isTransfer && (!toAcctId || toAcctId === selAcctId),
      rate:   isForeign && baseAmount == null,
    };
    if (Object.values(errs).some(Boolean)) {
      setErrors(errs);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setSaving(true);
    try {
      let saved;
      let text;
      if (isTransfer) {
        const to = accounts.find(a => a.id === toAcctId);
        saved = await addTransfer({
          fromAccountId: selAcctId, fromAccountName: fromAcct?.name || '',
          toAccountId: toAcctId, toAccountName: to?.name || '',
          amount: val, note: note.trim().slice(0, NOTE_MAX), date,
        });
        text = `Transferred ${formatCurrency(val, currency)}`;
      } else {
        const cat = categories.find(c => c.id === selCat);
        const payload = {
          type,
          amount: baseAmount,
          category: selCat,
          categoryName: cat?.name || selCat,
          icon: cat?.icon || '💸',
          note: note.trim().slice(0, NOTE_MAX),
          accountId: selAcctId,
          accountName: fromAcct?.name || '',
          date,
        };
        if (isForeign) {
          Object.assign(payload, {
            originalAmount: val, originalCurrency: fxCode, exchangeRate: rate,
            rateDate: fx.status === 'ready' ? fx.date : null,
            rateSource: fx.status === 'ready' ? fx.source : 'manual',
          });
        }
        saved = await addTransaction(payload);
        text = `${type === 'expense' ? 'Expense' : 'Income'} added · ${formatCurrency(baseAmount, currency)}`;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({ text, actionLabel: 'Undo', onAction: () => deleteTransaction(saved.id) });
      navigation.goBack();
    } catch (e) {
      showToast({ text: 'Could not save. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  // Button text says exactly what will happen
  const shownBase = baseAmount != null ? formatCurrency(baseAmount, currency) : formatCurrency(amountVal, currencyLabel(fxCode || currencyCode));
  const saveLabel = amountVal <= 0 ? 'Enter an amount'
    : isTransfer ? `Transfer ${formatCurrency(amountVal, currency)}`
    : `Save ${type} · ${shownBase}`;

  const today = todayISO();
  const customDate = date !== today && date !== yesterdayISO();
  const prefix = isForeign ? currencyLabel(fxCode) : currency;
  const noAccounts = accounts.length === 0;

  const AccountTile = ({ a, selected, onPress, tintColor }) => (
    <TouchableOpacity
      style={[s.tile, selected && { borderColor: tintColor, backgroundColor: tintColor + '1F' }]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${a.name}, balance ${formatCurrency(getAccountBalance(a.id), currency)}`}
    >
      <Text style={s.tileIcon}>{a.icon}</Text>
      <Text style={[s.tileName, selected && { color: tintColor }]} numberOfLines={1}>{a.name}</Text>
      <Text style={s.tileBal} numberOfLines={1}>{formatCurrency(getAccountBalance(a.id), currency)}</Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={[s.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />

      {/* Top bar: close · type */}
      <View style={s.top}>
        <IconButton name="close" onPress={() => navigation.goBack()} label="Close" bg="transparent" tint={colors.text} />
        <Segmented options={TYPE_OPTIONS} value={type} onChange={changeType} style={{ flex: 1 }} />
        <View style={{ width: layout.touch }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── Amount ── */}
        <View style={s.amountWrap}>
          {!isTransfer && !!currencyCode && (
            <TouchableOpacity
              style={s.curChip}
              onPress={() => setPickerOpen(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Currency ${fxCode || currencyCode}. Tap to change`}
            >
              <Text style={s.curChipTxt}>{fxCode || currencyCode}</Text>
              <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          <Text
            style={[s.amount, { color: errors.amount ? colors.expense : tint }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            accessibilityLabel={`Amount ${typedFormat(amount)} ${fxCode || currencyCode || ''}`}
          >
            <Text style={s.amountCurr}>{prefix} </Text>{typedFormat(amount)}
          </Text>
          {errors.amount && <Text style={s.errHint}>Enter an amount</Text>}

          {isForeign && (
            <View style={s.fxBox}>
              {fx.status === 'loading' && (
                <View style={s.fxRow}>
                  <ActivityIndicator size="small" color={colors.accent} />
                  <Text style={s.fxNote}>Getting the exchange rate…</Text>
                </View>
              )}
              {fx.status === 'ready' && (
                <>
                  <Text style={s.fxBase}>≈ {formatCurrency(baseAmount || 0, currency)}</Text>
                  <Text style={s.fxNote}>{formatRate(fxCode, currencyCode, fx.rate)} · {rateSourceText(fx)}</Text>
                </>
              )}
              {fx.status === 'error' && (
                <>
                  <Text style={s.fxWarn}>Couldn’t get a rate. You may be offline. Enter one to continue:</Text>
                  <View style={s.fxRow}>
                    <Text style={s.fxNote}>1 {fxCode} =</Text>
                    <TextInput
                      style={[s.rateInput, errors.rate && { borderColor: colors.expense }]}
                      value={manualRate}
                      onChangeText={t => { setManualRate(t.replace(/[^0-9.]/g, '')); setErrors(e => ({ ...e, rate: false })); }}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={colors.muted}
                      accessibilityLabel={`Exchange rate: 1 ${fxCode} in ${currencyCode}`}
                    />
                    <Text style={s.fxNote}>{currencyCode}</Text>
                    <TouchableOpacity onPress={() => setRetry(n => n + 1)} style={s.retry} accessibilityRole="button">
                      <Text style={s.retryTxt}>Try again</Text>
                    </TouchableOpacity>
                  </View>
                  {errors.rate && <Text style={s.errHint}>Enter an exchange rate to continue</Text>}
                  {baseAmount != null && <Text style={s.fxBase}>≈ {formatCurrency(baseAmount, currency)}</Text>}
                </>
              )}
            </View>
          )}
        </View>

        {noAccounts && (
          <View style={s.warnBox}>
            <Text style={s.warnTxt}>You need an account first.</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Accounts')}><Text style={s.warnLink}>Add an account</Text></TouchableOpacity>
          </View>
        )}

        {/* ── Category (expense / income) ── */}
        {!isTransfer && (
          <>
            <Text style={[s.label, errors.cat && { color: colors.expense }]}>Category{errors.cat ? ' · choose one' : ''}</Text>
            <View style={s.wrap}>
              {displayCats.map(c => (
                <Chip
                  key={c.id}
                  label={c.name}
                  icon={c.icon}
                  tint={c.color}
                  selected={selCat === c.id}
                  onPress={() => { setSelCat(c.id); setErrors(e => ({ ...e, cat: false })); }}
                />
              ))}
            </View>
          </>
        )}

        {/* ── Accounts ── */}
        {isTransfer ? (
          accounts.length < 2 ? (
            <View style={s.warnBox}>
              <Text style={s.warnTxt}>Transfers need at least two accounts.</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Accounts')}><Text style={s.warnLink}>Add an account</Text></TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={s.label}>From</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tileRow}>
                {accounts.map(a => <AccountTile key={a.id} a={a} selected={selAcctId === a.id} tintColor={colors.blue} onPress={() => pickFrom(a.id)} />)}
              </ScrollView>
              <Text style={[s.label, errors.to && { color: colors.expense }]}>To{errors.to ? ' · choose another account' : ''}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tileRow}>
                {accounts.filter(a => a.id !== selAcctId).map(a => (
                  <AccountTile key={a.id} a={a} selected={toAcctId === a.id} tintColor={colors.blue}
                    onPress={() => { setToAcctId(a.id); setErrors(e => ({ ...e, to: false })); }} />
                ))}
              </ScrollView>
              {notEnough && (
                <Text style={s.notEnough}>
                  {fromAcct?.name} only has {formatCurrency(fromBalance, currency)}. You can still continue.
                </Text>
              )}
            </>
          )
        ) : (
          accounts.length > 1 && (
            <>
              <Text style={s.label}>Account</Text>
              <View style={s.wrap}>
                {accounts.map(a => (
                  <Chip key={a.id} label={a.name} icon={a.icon} selected={selAcctId === a.id} onPress={() => pickFrom(a.id)} />
                ))}
              </View>
            </>
          )
        )}

        {/* ── Date ── */}
        <Text style={s.label}>Date</Text>
        <View style={s.wrap}>
          <Chip label="Today" selected={date === today} onPress={() => setDate(today)} />
          <Chip label="Yesterday" selected={date === yesterdayISO()} onPress={() => setDate(yesterdayISO())} />
          <Chip
            label={customDate ? relativeDateLabel(date) : 'Pick a date'}
            icon="calendar-outline"
            selected={customDate}
            onPress={() => setDateOpen(true)}
          />
        </View>

        {/* ── Note ── */}
        <Text style={s.label}>Note</Text>
        <TextInput
          style={s.note}
          value={note}
          onChangeText={t => setNote(t.slice(0, NOTE_MAX))}
          onFocus={() => setNoteFocused(true)}
          onBlur={() => setNoteFocused(false)}
          placeholder="Add a note (optional)"
          placeholderTextColor={colors.muted}
          maxLength={NOTE_MAX}
          returnKeyType="done"
          accessibilityLabel="Note"
        />
        <View style={{ height: 12 }} />
      </ScrollView>

      {/* ── Docked: numpad + Save (always visible, no scrolling to reach them) ── */}
      {/* the tab bar below already handles the bottom inset */}
      <View style={s.dock}>
        {!noteFocused && (
          <View style={[s.numpad, isWide && { alignSelf: 'center', width: '100%', maxWidth: 380 }]}>
            {isWide && <Text style={s.kbHint}>Type the amount with your keyboard · Enter to save · Esc to close</Text>}
            {KEYS.map((row, ri) => (
              <View key={ri} style={s.numRow}>
                {row.map(k => (
                  <TouchableOpacity
                    key={k}
                    style={s.key}
                    onPress={() => handleKey(k)}
                    onLongPress={k === '⌫' ? () => setAmount('') : undefined}
                    activeOpacity={0.6}
                    accessibilityRole="button"
                    accessibilityLabel={k === '⌫' ? 'Delete digit. Hold to clear' : k === '.' ? 'Decimal point' : k}
                  >
                    {k === '⌫'
                      ? <Ionicons name="backspace-outline" size={24} color={colors.text} />
                      : <Text style={s.keyTxt}>{k}</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        )}
        <PrimaryButton
          label={saving ? 'Saving…' : saveLabel}
          onPress={handleSave}
          color={tint}
          dim={amountVal <= 0}
          disabled={saving}
          icon={amountVal > 0 ? 'checkmark' : undefined}
          style={{ marginHorizontal: layout.screenPad }}
        />
      </View>

      <DatePickerModal visible={dateOpen} value={date} onChange={setDate} onClose={() => setDateOpen(false)} />
      <CurrencyPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selected={fxCode || currencyCode}
        pinned={currencyCode ? [currencyCode] : []}
        title="Currency of this amount"
        onSelect={code => {
          setFxCode(code === currencyCode ? null : code);
          setManualRate('');
          setPickerOpen(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const useStyles = createStyles((colors, typography) => ({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6 },
  scroll: { paddingHorizontal: layout.screenPad, paddingBottom: 8 },

  amountWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 18 },
  curChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 14, marginBottom: 6,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18,
  },
  curChipTxt: { fontSize: 13, fontWeight: '800', color: colors.text, letterSpacing: 0.5 },
  amount: { fontSize: 54, fontWeight: '800', letterSpacing: -1.5, maxWidth: '100%' },
  amountCurr: { fontSize: 24, fontWeight: '700', opacity: 0.75, letterSpacing: 0 },
  errHint: { fontSize: 12.5, fontWeight: '700', color: colors.expense, marginTop: 4 },

  fxBox: {
    alignSelf: 'stretch', alignItems: 'center', gap: 6, marginTop: 10, padding: 12,
    backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
  },
  fxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  fxBase: { fontSize: 20, fontWeight: '800', color: colors.text },
  fxNote: { fontSize: 12.5, color: colors.textSecondary, textAlign: 'center' },
  fxWarn: { fontSize: 13, color: colors.orange, textAlign: 'center', fontWeight: '600' },
  rateInput: {
    minWidth: 84, minHeight: 40, paddingHorizontal: 10, fontSize: 15, fontWeight: '700', color: colors.text,
    backgroundColor: colors.card2, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, textAlign: 'center',
  },
  retry: { paddingHorizontal: 8, minHeight: 40, justifyContent: 'center' },
  retryTxt: { fontSize: 13, fontWeight: '800', color: colors.accent },

  label: { ...typography.label, marginTop: 20, marginBottom: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  tileRow: { gap: 8, paddingRight: 8 },
  tile: {
    width: 132, padding: 12, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card,
  },
  tileIcon: { fontSize: 20, marginBottom: 6 },
  tileName: { fontSize: 14, fontWeight: '700', color: colors.text },
  tileBal: { fontSize: 12, color: colors.muted, marginTop: 2 },
  notEnough: { fontSize: 12.5, fontWeight: '600', color: colors.orange, marginTop: 10 },

  warnBox: { backgroundColor: colors.orangeDim, borderRadius: radius.lg, padding: 14, marginTop: 14, gap: 4 },
  warnTxt: { fontSize: 13.5, color: colors.text, fontWeight: '600' },
  warnLink: { fontSize: 13.5, color: colors.accent, fontWeight: '800' },

  note: {
    minHeight: 50, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 14, fontSize: 15, color: colors.text,
  },

  dock: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, paddingBottom: 10 },
  numpad: { paddingHorizontal: 12, marginBottom: 8 },
  kbHint: { fontSize: 11.5, color: colors.muted, textAlign: 'center', marginBottom: 8 },
  numRow: { flexDirection: 'row' },
  key: { flex: 1, height: 50, alignItems: 'center', justifyContent: 'center', margin: 2, borderRadius: 14 },
  keyTxt: { fontSize: 26, fontWeight: '600', color: colors.text },
}));
