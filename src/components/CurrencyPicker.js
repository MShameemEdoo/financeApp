import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, useTheme, createStyles } from '../theme';
import { Sheet } from './ui';
import { CURRENCIES } from '../utils/currencies';

/**
 * Searchable currency list (code, name or symbol). Used for the app currency in Settings
 * and for choosing a foreign currency when adding a transaction.
 */
export default function CurrencyPicker({ visible, onClose, onSelect, selected, title = 'Choose currency', pinned = [] }) {
  const s = useStyles();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');

  useEffect(() => { if (visible) setQuery(''); }, [visible]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let items = CURRENCIES;
    if (q) {
      items = CURRENCIES.filter(c =>
        c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q));
    } else if (pinned.length) {
      // keep chosen/home currencies on top when not searching
      const top = pinned.map(code => CURRENCIES.find(c => c.code === code)).filter(Boolean);
      items = [...top, ...CURRENCIES.filter(c => !pinned.includes(c.code))];
    }
    return items;
  }, [query, pinned.join()]);

  return (
    <Sheet visible={visible} onClose={onClose} title={title} scroll={false} tall>
      <View style={s.search}>
        <Ionicons name="search-outline" size={18} color={colors.muted} />
        <TextInput
          style={s.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search currency, e.g. euro or USD"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search currency"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={list}
        keyExtractor={c => c.code}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<Text style={s.none}>No currency matches “{query}”</Text>}
        renderItem={({ item: c }) => {
          const on = c.code === selected;
          return (
            <TouchableOpacity
              style={[s.row, on && s.rowOn]}
              onPress={() => onSelect(c.code)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${c.name}, ${c.code}`}
            >
              <View style={s.badge}><Text style={s.badgeTxt} numberOfLines={1} adjustsFontSizeToFit>{c.symbol}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{c.name}</Text>
                <Text style={s.code}>{c.code}</Text>
              </View>
              {on && <Ionicons name="checkmark-circle" size={22} color={colors.accent} />}
            </TouchableOpacity>
          );
        }}
      />
    </Sheet>
  );
}

const useStyles = createStyles((colors, typography) => ({
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, marginBottom: 8,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 14,
  },
  input: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 8, paddingHorizontal: 8, borderRadius: radius.md },
  rowOn: { backgroundColor: colors.accentDim },
  badge: { width: 44, height: 36, borderRadius: 10, backgroundColor: colors.card2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeTxt: { fontSize: 13, fontWeight: '800', color: colors.text },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  code: { fontSize: 12.5, color: colors.muted, marginTop: 1 },
  none: { textAlign: 'center', color: colors.muted, marginTop: 40, fontSize: 14 },
}));
