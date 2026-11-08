import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, createStyles } from '../theme';
import { Sheet, Chip, PrimaryButton } from './ui';

export const TYPE_FILTERS = [
  { key: 'all',      label: 'All' },
  { key: 'income',   label: 'Income' },
  { key: 'expense',  label: 'Expenses' },
  { key: 'transfer', label: 'Transfers' },
];

/**
 * All transaction filters in one place, instead of ~20 chips in a single scrolling row.
 * Changes apply immediately; the button shows how many results they produce.
 */
export default function FilterSheet({
  visible, onClose, accounts, categories,
  accountId, onAccount, typeFilter, onType, catFilter, onCat,
  resultCount, onClear, hasFilters,
}) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Filters"
      footer={
        <View style={s.footer}>
          {hasFilters && (
            <Text style={s.clear} onPress={onClear} accessibilityRole="button">Clear all</Text>
          )}
          <PrimaryButton
            label={`Show ${resultCount} ${resultCount === 1 ? 'result' : 'results'}`}
            onPress={onClose}
            style={{ flex: 1 }}
          />
        </View>
      }
    >
      <Text style={s.label}>Type</Text>
      <View style={s.wrap}>
        {TYPE_FILTERS.map(t => (
          <Chip
            key={t.key}
            label={t.label}
            selected={typeFilter === t.key}
            tint={t.key === 'transfer' ? colors.blue : t.key === 'expense' ? colors.expense : t.key === 'income' ? colors.income : colors.accent}
            onPress={() => onType(t.key)}
          />
        ))}
      </View>

      <Text style={[s.label, { marginTop: 20 }]}>Account</Text>
      <View style={s.wrap}>
        <Chip label="All accounts" selected={!accountId} onPress={() => onAccount(null)} />
        {accounts.map(a => (
          <Chip key={a.id} label={a.name} icon={a.icon} selected={accountId === a.id} onPress={() => onAccount(accountId === a.id ? null : a.id)} />
        ))}
      </View>

      <Text style={[s.label, { marginTop: 20 }]}>Category</Text>
      <View style={s.wrap}>
        <Chip label="All categories" selected={!catFilter} onPress={() => onCat(null)} />
        {categories.map(c => (
          <Chip key={c.id} label={c.name} icon={c.icon} tint={c.color} selected={catFilter === c.id} onPress={() => onCat(catFilter === c.id ? null : c.id)} />
        ))}
      </View>
      <View style={{ height: 8 }} />
    </Sheet>
  );
}

const useStyles = createStyles((colors, typography) => ({
  label: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  clear: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, paddingHorizontal: 6, paddingVertical: 14 },
}));
