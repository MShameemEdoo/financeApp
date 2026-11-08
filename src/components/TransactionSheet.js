import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { radius, useTheme, createStyles } from '../theme';
import { useApp } from '../context/AppContext';
import { Sheet, Chip, PrimaryButton } from './ui';
import { DateField } from './DatePickerModal';
import { formatCurrency, toISODate, parseLocalDate, periodKeyOfDate } from '../utils/formatters';
import { currencyLabel } from '../utils/currencies';
import { formatRate } from '../services/ExchangeRateService';

const NOTE_MAX = 255;

/**
 * One place to look at, fix or remove a transaction — opened by tapping ANY transaction row
 * (Home, Transactions). Replaces the old hidden long-press delete:
 *   • change amount, category, date and note
 *   • Delete is a visible button and is undoable
 */
export default function TransactionSheet() {
  const s = useStyles();
  const { colors } = useTheme();
  const {
    sheetTx, closeTransaction, editTransaction, deleteTransaction, restoreTransaction,
    categories, currency, showToast, selectedMonthKey, monthStartDay, formatPeriodLabel, setSelectedMonth,
    currencyCode,
  } = useApp();
  const tx = sheetTx;

  const [amount, setAmount] = useState('');
  const [note, setNote]     = useState('');
  const [date, setDate]     = useState('');
  const [catId, setCatId]   = useState(null);
  const [error, setError]   = useState(false);

  // Fill the form each time a different transaction is opened
  useEffect(() => {
    if (!tx) return;
    setAmount(String(tx.amount));
    setNote(tx.note || '');
    setDate(toISODate(parseLocalDate(tx.date)));
    setCatId(tx.category);
    setError(false);
  }, [tx && tx.id]);

  const isTransfer = tx?.type === 'transfer';
  const tint = isTransfer ? colors.blue : tx?.type === 'income' ? colors.income : colors.expense;
  const cats = useMemo(
    () => (tx && !isTransfer ? categories.filter(c => c.type === tx.type || c.type === 'both') : []),
    [tx && tx.id, categories],
  );

  function onAmountChange(t) {
    const cleaned = t.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const next = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
    setAmount(parts[1] && parts[1].length > 2 ? `${parts[0]}.${parts[1].slice(0, 2)}` : next);
    if (error) setError(false);
  }

  async function save() {
    const val = parseFloat(amount);
    if (!(val > 0)) {
      setError(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    const updates = { amount: val, note: note.trim().slice(0, NOTE_MAX), date };
    if (!isTransfer && catId && catId !== tx.category) {
      const cat = categories.find(c => c.id === catId);
      if (cat) Object.assign(updates, { category: cat.id, categoryName: cat.name, icon: cat.icon });
    }
    await editTransaction(tx.id, updates);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    closeTransaction();

    // If the new date puts it in another period it leaves the current view — say where it went
    const newKey = periodKeyOfDate(date, monthStartDay);
    if (newKey !== selectedMonthKey) {
      showToast({
        text: `Moved to ${formatPeriodLabel(newKey)}`,
        actionLabel: 'Go there',
        onAction: () => setSelectedMonth(newKey),
        duration: 5500,
      });
    }
  }

  async function remove() {
    const removed = await deleteTransaction(tx.id);
    closeTransaction();
    if (removed) {
      showToast({
        text: isTransfer ? 'Transfer deleted' : 'Transaction deleted',
        actionLabel: 'Undo',
        onAction: () => restoreTransaction(removed),
      });
    }
  }

  const title = !tx ? '' : isTransfer ? 'Transfer' : tx.type === 'income' ? 'Income' : 'Expense';
  const foreign = tx && tx.originalCurrency && tx.originalAmount;

  return (
    <Sheet
      visible={!!tx}
      onClose={closeTransaction}
      title={title}
      footer={
        <View style={s.footer}>
          <TouchableOpacity style={s.delBtn} onPress={remove} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Delete transaction">
            <Ionicons name="trash-outline" size={20} color={colors.expense} />
          </TouchableOpacity>
          <PrimaryButton label="Save changes" onPress={save} style={{ flex: 1 }} />
        </View>
      }
    >
      {tx && (
        <View>
          {/* Amount */}
          <Text style={s.label}>Amount</Text>
          <View style={[s.amountBox, error && s.amountErr]}>
            <Text style={[s.curr, { color: tint }]}>{currency}</Text>
            <TextInput
              style={[s.amountInput, { color: tint }]}
              value={amount}
              onChangeText={onAmountChange}
              keyboardType="decimal-pad"
              selectTextOnFocus
              accessibilityLabel="Amount"
            />
          </View>
          {error && <Text style={s.errTxt}>Enter an amount greater than 0</Text>}
          {foreign && (
            <Text style={s.fx}>
              Paid {formatCurrency(tx.originalAmount, currencyLabel(tx.originalCurrency))}
              {tx.exchangeRate ? ` · ${formatRate(tx.originalCurrency, currencyCode || '', tx.exchangeRate)}` : ''}
            </Text>
          )}
          {isTransfer && (
            <Text style={s.fx}>{tx.fromAccountName} → {tx.toAccountName}</Text>
          )}

          {/* Category */}
          {!isTransfer && (
            <>
              <Text style={[s.label, { marginTop: 18 }]}>Category</Text>
              <View style={s.wrap}>
                {cats.map(c => (
                  <Chip key={c.id} label={c.name} icon={c.icon} tint={c.color} selected={catId === c.id} onPress={() => setCatId(c.id)} />
                ))}
              </View>
            </>
          )}

          {/* Date */}
          <DateField value={date} onChange={setDate} label="Date" style={{ marginTop: 18 }} />

          {/* Note */}
          <Text style={[s.label, { marginTop: 18 }]}>Note</Text>
          <TextInput
            style={s.note}
            value={note}
            onChangeText={t => setNote(t.slice(0, NOTE_MAX))}
            placeholder="Add a note (optional)"
            placeholderTextColor={colors.muted}
            maxLength={NOTE_MAX}
            accessibilityLabel="Note"
          />
          <View style={{ height: 6 }} />
        </View>
      )}
    </Sheet>
  );
}

const useStyles = createStyles((colors, typography) => ({
  label: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  amountBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 62,
    backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 16,
  },
  amountErr: { borderColor: colors.expense },
  curr: { fontSize: 18, fontWeight: '700' },
  amountInput: { flex: 1, fontSize: 28, fontWeight: '800', paddingVertical: 10 },
  errTxt: { fontSize: 12, fontWeight: '600', color: colors.expense, marginTop: 6 },
  fx: { fontSize: 12.5, color: colors.textSecondary, marginTop: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: {
    minHeight: 50, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 14, fontSize: 15, color: colors.text,
  },
  footer: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  delBtn: {
    width: 54, height: 54, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.expenseDim, borderWidth: 1, borderColor: colors.expense + '4D',
  },
}));
