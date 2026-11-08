import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { radius, useTheme, createStyles } from '../theme';
import { formatCurrency, relativeDateLabel } from '../utils/formatters';
import { currencyLabel } from '../utils/currencies';
import { useApp } from '../context/AppContext';

/**
 * One transaction row. Tap anywhere on it to open the edit / delete sheet.
 * showDate adds "Today" / "Yesterday" / "Oct 12" — used where rows aren't grouped by day.
 */
export default function TransactionItem({ tx, showDate = false }) {
  const s = useStyles();
  const { colors } = useTheme();
  const { openTransaction, currency } = useApp();

  const isTransfer = tx.type === 'transfer';
  const isIncome   = tx.type === 'income';

  const amtColor  = isTransfer ? colors.blue    : isIncome ? colors.income    : colors.expense;
  const iconBg    = isTransfer ? colors.blueDim : isIncome ? colors.incomeDim : colors.expenseDim;
  const category  = isTransfer ? 'Transfer' : (tx.categoryName || tx.category);
  const mainLabel = tx.note || (isTransfer ? `${tx.fromAccountName} → ${tx.toAccountName}` : category);
  const subParts  = [];
  if (isTransfer) subParts.push(`${tx.fromAccountName} → ${tx.toAccountName}`);
  else if (tx.note) subParts.push(category);
  else if (tx.accountName) subParts.push(tx.accountName);
  if (showDate) subParts.push(relativeDateLabel(tx.date));
  const subLabel  = subParts.join(' · ');
  const prefix    = isTransfer ? '' : isIncome ? '+' : '−';
  const amountTxt = `${prefix}${formatCurrency(tx.amount, currency)}`;
  const foreignTxt = tx.originalCurrency && tx.originalAmount
    ? formatCurrency(tx.originalAmount, currencyLabel(tx.originalCurrency))
    : null;

  return (
    <TouchableOpacity
      style={s.row}
      onPress={() => openTransaction(tx)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${mainLabel}, ${subLabel ? subLabel + ', ' : ''}${amountTxt}. Tap to edit or delete`}
    >
      <View style={[s.icon, { backgroundColor: iconBg }]}>
        <Text style={s.iconEmoji}>{tx.icon || (isTransfer ? '↔️' : '💸')}</Text>
      </View>
      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>{mainLabel}</Text>
        {!!subLabel && <Text style={s.sub} numberOfLines={1}>{subLabel}</Text>}
      </View>
      <View style={s.right}>
        <Text style={[s.amount, { color: amtColor }]} numberOfLines={1}>{amountTxt}</Text>
        {!!foreignTxt && <Text style={s.foreign} numberOfLines={1}>{foreignTxt}</Text>}
      </View>
    </TouchableOpacity>
  );
}

const useStyles = createStyles((colors, typography) => ({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  icon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  iconEmoji: { fontSize: 21 },
  info: { flex: 1 },
  name: { ...typography.bodyMed },
  sub: { ...typography.caption, marginTop: 2 },
  right: { alignItems: 'flex-end', maxWidth: '45%' },
  amount: { fontSize: 15, fontWeight: '700' },
  foreign: { ...typography.caption, marginTop: 2 },
}));
