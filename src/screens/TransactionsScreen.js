import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, SectionList, StyleSheet, StatusBar, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { radius, layout, useTheme, createStyles } from '../theme';
import { useApp } from '../context/AppContext';
import { groupByDate, formatCurrency, txDateISO } from '../utils/formatters';
import MonthSwitcher from '../components/MonthSwitcher';
import TransactionItem from '../components/TransactionItem';
import FilterSheet, { TYPE_FILTERS } from '../components/FilterSheet';
import Overlays from '../components/Overlays';
import { ScreenHeader, IconButton, Chip, EmptyState } from '../components/ui';

export default function TransactionsScreen({ navigation }) {
  const s = useStyles();
  const { colors, isDark } = useTheme();
  const {
    data, categories, currency,
    selectedAccountId, setSelectedAccountId,
    periodStart, periodEnd, periodLabel,
  } = useApp();
  const insets = useSafeAreaInsets();

  const [search, setSearch]         = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [catFilter, setCatFilter]   = useState(null);
  const [allTime, setAllTime]       = useState(false);   // true = ignore the month, show every transaction
  const [filterOpen, setFilterOpen] = useState(false);

  const filtered = useMemo(() => {
    let txs = [...data.transactions];

    // The shared month, unless "All time" is on
    if (!allTime) txs = txs.filter(t => { const d = txDateISO(t); return d >= periodStart && d <= periodEnd; });

    if (selectedAccountId) {
      txs = txs.filter(t => {
        if (t.type === 'transfer') return t.fromAccountId === selectedAccountId || t.toAccountId === selectedAccountId;
        return t.accountId === selectedAccountId;
      });
    }
    if (typeFilter !== 'all') txs = txs.filter(t => t.type === typeFilter);
    if (catFilter) txs = txs.filter(t => t.category === catFilter);

    const q = search.trim().toLowerCase();
    if (q) {
      txs = txs.filter(t =>
        (t.note || '').toLowerCase().includes(q) ||
        (t.categoryName || t.category || '').toLowerCase().includes(q) ||
        (t.accountName || '').toLowerCase().includes(q) ||
        (t.fromAccountName || '').toLowerCase().includes(q) ||
        (t.toAccountName || '').toLowerCase().includes(q)
      );
    }
    return txs;
  }, [data.transactions, selectedAccountId, typeFilter, catFilter, search, allTime, periodStart, periodEnd]);

  // Sections by day, each with that day's net so the list reads like a statement
  const sections = useMemo(
    () => groupByDate(filtered).map(g => ({ key: g.date, title: g.date, net: g.net, hasMoney: g.items.some(t => t.type !== 'transfer'), data: g.items })),
    [filtered],
  );

  const income  = useMemo(() => filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), [filtered]);
  const expense = useMemo(() => filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [filtered]);

  const account = selectedAccountId ? data.accounts.find(a => a.id === selectedAccountId) : null;
  const category = catFilter ? categories.find(c => c.id === catFilter) : null;
  const typeLabel = TYPE_FILTERS.find(t => t.key === typeFilter)?.label;
  const activeCount = (account ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0) + (category ? 1 : 0);
  const hasFilters = activeCount > 0 || search.trim().length > 0;

  function clearFilters() {
    setSelectedAccountId(null);
    setTypeFilter('all');
    setCatFilter(null);
    setSearch('');
  }

  const subtitle = `${filtered.length} ${filtered.length === 1 ? 'entry' : 'entries'} · ${allTime ? 'all time' : periodLabel}`;

  const header = (
    <View>
      {filtered.length > 0 && (income > 0 || expense > 0) && (
        <View style={s.summary}>
          <View style={s.sumItem}>
            <Text style={s.sumLabel}>Money in</Text>
            <Text style={[s.sumVal, { color: colors.income }]} numberOfLines={1}>{formatCurrency(income, currency)}</Text>
          </View>
          <View style={s.sumDivider} />
          <View style={s.sumItem}>
            <Text style={s.sumLabel}>Money out</Text>
            <Text style={[s.sumVal, { color: colors.expense }]} numberOfLines={1}>{formatCurrency(expense, currency)}</Text>
          </View>
        </View>
      )}
    </View>
  );

  const empty = filtered.length === 0 && (
    hasFilters && data.transactions.length > 0 ? (
      <EmptyState
        emoji="🔍"
        title="No matches"
        message={search.trim() ? `Nothing found for “${search.trim()}”${allTime ? '' : ' in ' + periodLabel}.` : 'No transactions match these filters.'}
        actionLabel="Clear filters"
        onAction={clearFilters}
        secondaryLabel={!allTime ? 'Search all time instead' : undefined}
        onSecondary={() => setAllTime(true)}
      />
    ) : (
      <EmptyState
        emoji="🧾"
        title={data.transactions.length === 0 ? 'No transactions yet' : `Nothing in ${allTime ? 'your history' : periodLabel}`}
        message={data.transactions.length === 0 ? 'Add your first one to start tracking.' : 'Use ‹ › above to browse other periods.'}
        actionLabel="Add transaction"
        onAction={() => navigation.navigate('Add', { defaultType: 'expense' })}
        secondaryLabel={!allTime && data.transactions.length > 0 ? 'Show all time' : undefined}
        onSecondary={() => setAllTime(true)}
      />
    )
  );

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />

      <ScreenHeader title="Transactions" subtitle={subtitle} />

      <MonthSwitcher allTime={allTime} onAllTimeChange={setAllTime} style={{ marginHorizontal: layout.screenPad }} />

      {/* Search + one Filters button (instead of ~20 chips in a row) */}
      <View style={s.searchRow}>
        <View style={s.search}>
          <Ionicons name="search-outline" size={18} color={colors.muted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search note, category, account"
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            accessibilityLabel="Search transactions"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
        <IconButton
          name="options-outline"
          label={activeCount ? `Filters, ${activeCount} active` : 'Filters'}
          onPress={() => setFilterOpen(true)}
          tint={activeCount ? colors.bg : colors.text}
          bg={activeCount ? colors.accent : colors.card}
          badge={activeCount ? String(activeCount) : undefined}
        />
      </View>

      {/* Active filters, each removable with one tap */}
      {activeCount > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.activeRow} style={{ flexGrow: 0 }}>
          {account && <Chip label={account.name} icon={account.icon} selected onPress={() => setFilterOpen(true)} onRemove={() => setSelectedAccountId(null)} />}
          {typeFilter !== 'all' && <Chip label={typeLabel} selected onPress={() => setFilterOpen(true)} onRemove={() => setTypeFilter('all')} />}
          {category && <Chip label={category.name} icon={category.icon} tint={category.color} selected onPress={() => setFilterOpen(true)} onRemove={() => setCatFilter(null)} />}
        </ScrollView>
      )}

      <SectionList
        sections={sections}
        keyExtractor={tx => tx.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty || null}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.list}
        renderSectionHeader={({ section }) => (
          <View style={s.dayHeader}>
            <Text style={s.dayTitle}>{section.title}</Text>
            {section.hasMoney && section.net !== 0 && (
              <Text style={[s.dayNet, { color: section.net > 0 ? colors.income : colors.textSecondary }]}>
                {formatCurrency(section.net, currency, { sign: true })}
              </Text>
            )}
          </View>
        )}
        renderItem={({ item }) => <TransactionItem tx={item} />}
      />

      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        accounts={data.accounts}
        categories={categories}
        accountId={selectedAccountId}
        onAccount={setSelectedAccountId}
        typeFilter={typeFilter}
        onType={setTypeFilter}
        catFilter={catFilter}
        onCat={setCatFilter}
        resultCount={filtered.length}
        hasFilters={activeCount > 0}
        onClear={() => { setSelectedAccountId(null); setTypeFilter('all'); setCatFilter(null); }}
      />

      <Overlays fab />
    </View>
  );
}

const useStyles = createStyles((colors, typography) => ({
  root: { flex: 1, backgroundColor: colors.bg },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: layout.screenPad, marginBottom: 10 },
  search: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: layout.touch,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 8 },
  activeRow: { gap: 8, paddingHorizontal: layout.screenPad, paddingBottom: 10 },

  list: { paddingHorizontal: layout.screenPad, paddingBottom: layout.scrollBottom, flexGrow: 1 },

  summary: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, paddingVertical: 12, marginBottom: 6,
  },
  sumItem: { flex: 1, alignItems: 'center' },
  sumLabel: { ...typography.caption },
  sumVal: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  sumDivider: { width: 1, height: 30, backgroundColor: colors.border },

  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, paddingBottom: 4 },
  dayTitle: { ...typography.label },
  dayNet: { fontSize: 12.5, fontWeight: '700' },
}));
