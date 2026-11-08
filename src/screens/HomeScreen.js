import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { radius, layout, useTheme, createStyles, useLayout } from '../theme';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatShortDate } from '../utils/formatters';
import MonthSwitcher from '../components/MonthSwitcher';
import DonutChart from '../components/DonutChart';
import TransactionItem from '../components/TransactionItem';
import Overlays from '../components/Overlays';
import { IconButton, SectionHeader, Card, EmptyState } from '../components/ui';

const MASK = '••••••';

// Account cards: a swipeable row on a phone, a wrapping grid on a wide screen (so none are cut off)
function AcctRow({ isWide, style, children }) {
  if (isWide) return <View style={[style, { flexDirection: 'row', flexWrap: 'wrap' }]}>{children}</View>;
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={style}>{children}</ScrollView>;
}

export default function HomeScreen({ navigation }) {
  const styles = useStyles();
  const { colors, isDark } = useTheme();
  const {
    data, userName, currency, syncing,
    totalIncome, totalExpenses, netBalance, totalBalance,
    monthlyTxs, catSpending,
    selectedAccountId, setSelectedAccountId,
    getAccountBalance, getCategory,
    isCurrentMonth, balanceCutoff, periodLabel, periodWord,
  } = useApp();
  const insets = useSafeAreaInsets();
  const { isWide } = useLayout();
  const [hidden, setHidden] = useState(false);   // hide amounts when someone is looking over your shoulder

  const hasAnyTransaction = data.transactions.length > 0;

  const donutData = useMemo(() => {
    const cats = Object.entries(catSpending)
      .map(([catId, value]) => {
        const cat = getCategory(catId);
        return { value, color: cat.color, label: cat.name };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    return cats.length ? cats : [{ value: 1, color: colors.card2, label: 'No data' }];
  }, [catSpending, getCategory]);

  const hasSpending = Object.keys(catSpending).length > 0;
  const totalSpend  = donutData.reduce((s, d) => s + d.value, 0);
  const recent      = monthlyTxs.slice(0, isWide ? 8 : 5);

  // Budgets that need attention this period (75% or more used) — most urgent first
  const budgetAlerts = useMemo(() => {
    if (!isCurrentMonth) return [];
    return data.budgets
      .map(b => {
        const spent = catSpending[b.category] || 0;
        return { b, spent, ratio: b.limit > 0 ? spent / b.limit : 0 };
      })
      .filter(x => x.ratio >= 0.75)
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 2)
      .map(x => ({ ...x, name: x.b.customName || getCategory(x.b.category)?.name || 'Budget' }));
  }, [data.budgets, catSpending, isCurrentMonth, getCategory]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (userName || '').split(' ')[0];
  const showName = firstName && firstName !== 'User';

  const selectedAccount = selectedAccountId ? data.accounts.find(a => a.id === selectedAccountId) : null;
  const balBase  = selectedAccount ? selectedAccount.name : 'Total balance';
  const balLabel = isCurrentMonth ? balBase : `${balBase} · as at ${formatShortDate(balanceCutoff)}`;
  const negative = totalBalance < 0;
  const netUp    = netBalance >= 0;

  const money = (n, opts) => (hidden ? MASK : formatCurrency(n, currency, opts));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetSub}>{greeting}</Text>
            {showName && <Text style={styles.greetName} numberOfLines={1}>{firstName}</Text>}
            {!showName && <Text style={styles.greetName}>Monei</Text>}
          </View>
          {syncing && <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 8 }} />}
          <IconButton name="settings-outline" label="Settings" onPress={() => navigation.navigate('Settings')} />
        </View>

        {/* One control row: which month */}
        <MonthSwitcher />

        {/* Balance */}
        <View style={styles.balCard}>
          <LinearGradient colors={[colors.accent + '1A', 'transparent']} style={StyleSheet.absoluteFill} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} />
          <View style={styles.balTop}>
            <Text style={styles.balLabel} numberOfLines={1}>{balLabel}</Text>
            <TouchableOpacity
              onPress={() => setHidden(h => !h)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={hidden ? 'Show amounts' : 'Hide amounts'}
            >
              <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text
            style={[styles.balAmt, negative && { color: colors.expense }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            accessibilityLabel={hidden ? 'Balance hidden' : `Balance ${formatCurrency(totalBalance, currency, { sign: true })}`}
          >
            {hidden ? MASK : formatCurrency(totalBalance, currency, { sign: negative })}
          </Text>

          {hasAnyTransaction && (
            <View style={[styles.netPill, { backgroundColor: netUp ? colors.incomeDim : colors.expenseDim }]}>
              <Ionicons name={netUp ? 'trending-up' : 'trending-down'} size={14} color={netUp ? colors.income : colors.expense} />
              <Text style={[styles.netTxt, { color: netUp ? colors.income : colors.expense }]}>
                {hidden ? MASK : formatCurrency(netBalance, currency, { sign: true })} {isCurrentMonth ? `this ${periodWord}` : 'net'}
              </Text>
            </View>
          )}

          <View style={styles.statRow}>
            <View style={styles.stat}>
              <View style={[styles.statDot, { backgroundColor: colors.income }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.statLabel}>Income</Text>
                <Text style={styles.statVal} numberOfLines={1}>{money(totalIncome)}</Text>
              </View>
            </View>
            <View style={styles.stat}>
              <View style={[styles.statDot, { backgroundColor: colors.expense }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.statLabel}>Expenses</Text>
                <Text style={styles.statVal} numberOfLines={1}>{money(totalExpenses)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* First run: a clear next step instead of empty charts */}
        {!hasAnyTransaction ? (
          <Card style={{ marginTop: 18 }}>
            <EmptyState
              emoji="👋"
              title="Welcome to Monei"
              message={'Add your first expense or income to see your balance, spending breakdown and budgets here.\nThe + button is always at the bottom right.'}
              actionLabel="Add your first transaction"
              onAction={() => navigation.navigate('Add', { defaultType: 'expense' })}
            />
          </Card>
        ) : (
          <>
            <View style={isWide ? styles.cols : null}>
            <View style={isWide ? styles.colLeft : null}>
            {/* Accounts — tapping one filters everything on this screen */}
            <SectionHeader title="Accounts" actionLabel="Manage" onAction={() => navigation.navigate('Accounts')} />
            <AcctRow isWide={isWide} style={styles.acctRow}>
              <TouchableOpacity
                style={[styles.acctCard, !selectedAccountId && styles.acctOn]}
                onPress={() => setSelectedAccountId(null)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: !selectedAccountId }}
                accessibilityLabel={`All accounts, ${formatCurrency(data.accounts.reduce((s, a) => s + getAccountBalance(a.id, balanceCutoff), 0), currency)}`}
              >
                <View style={[styles.acctIcon, { backgroundColor: colors.accentDim }]}><Text style={{ fontSize: 18 }}>🏠</Text></View>
                <Text style={styles.acctName} numberOfLines={1}>All accounts</Text>
                <Text style={styles.acctBal} numberOfLines={1}>
                  {money(data.accounts.reduce((s, a) => s + getAccountBalance(a.id, balanceCutoff), 0))}
                </Text>
              </TouchableOpacity>
              {data.accounts.map(a => {
                const bal = getAccountBalance(a.id, balanceCutoff);
                const on = selectedAccountId === a.id;
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.acctCard, on && styles.acctOn]}
                    onPress={() => setSelectedAccountId(on ? null : a.id)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${a.name}, ${formatCurrency(bal, currency)}`}
                  >
                    <View style={[styles.acctIcon, { backgroundColor: a.color + '22' }]}><Text style={{ fontSize: 18 }}>{a.icon}</Text></View>
                    <Text style={styles.acctName} numberOfLines={1}>{a.name}</Text>
                    <Text style={[styles.acctBal, bal < 0 && { color: colors.expense }]} numberOfLines={1}>{money(bal, { sign: bal < 0 })}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={[styles.acctCard, styles.acctAdd]} onPress={() => navigation.navigate('Accounts')} accessibilityRole="button" accessibilityLabel="Add account">
                <Ionicons name="add" size={26} color={colors.accent} />
                <Text style={[styles.acctName, { color: colors.accent, marginTop: 4 }]}>Add</Text>
              </TouchableOpacity>
            </AcctRow>

            {/* Budget heads-up (only when something needs attention) */}
            {budgetAlerts.length > 0 && (
              <View style={{ marginTop: 18, gap: 8 }}>
                {budgetAlerts.map(({ b, ratio, name }) => {
                  const over = ratio >= 1;
                  const tint = over ? colors.expense : colors.orange;
                  return (
                    <TouchableOpacity
                      key={b.id}
                      style={[styles.alert, { borderColor: tint + '55', backgroundColor: tint + '14' }]}
                      onPress={() => navigation.navigate('Budgets')}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                    >
                      <Text style={{ fontSize: 20 }}>{b.icon}</Text>
                      <Text style={styles.alertTxt} numberOfLines={2}>
                        <Text style={{ fontWeight: '800' }}>{name}</Text>
                        {over ? ` is over budget (${Math.round(ratio * 100)}%)` : ` is at ${Math.round(ratio * 100)}% of its budget`}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Spending */}
            <SectionHeader title="Spending" actionLabel="Analytics" onAction={() => navigation.navigate('Analytics')} />
            <Card>
              {hasSpending ? (
                <View style={styles.donutRow}>
                  <DonutChart data={donutData} size={116} strokeWidth={16} centerLabel={hidden ? MASK : formatCurrency(totalSpend, currency, { compact: true })} centerSub="spent" />
                  <View style={styles.legend}>
                    {donutData.slice(0, 4).map((d, i) => (
                      <View key={i} style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                        <Text style={styles.legendLabel} numberOfLines={1}>{d.label}</Text>
                        <Text style={styles.legendPct}>{totalSpend > 0 ? Math.round((d.value / totalSpend) * 100) : 0}%</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <EmptyState emoji="🌤️" title={`No spending in ${periodLabel}`} message={isCurrentMonth ? 'Nothing spent yet this ' + periodWord + '.' : `Use ‹ › above to look at other ${periodWord}s.`} />
              )}
            </Card>

            </View>
            <View style={isWide ? styles.colRight : null}>
            {/* Recent */}
            <SectionHeader title="Recent" actionLabel="See all" onAction={() => navigation.navigate('Transactions')} />
            <Card style={{ paddingVertical: 4 }}>
              {recent.length === 0 ? (
                <EmptyState
                  emoji="🧾"
                  title={`No transactions in ${periodLabel}`}
                  message={isCurrentMonth ? 'Tap + to add one.' : `Use ‹ › above to look at other ${periodWord}s.`}
                />
              ) : (
                recent.map(tx => <TransactionItem key={tx.id} tx={tx} showDate />)
              )}
            </Card>
            </View>
            </View>
          </>
        )}

        <View style={{ height: 8 }} />
      </ScrollView>

      <Overlays fab />
    </View>
  );
}

const useStyles = createStyles((colors, typography) => ({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: layout.screenPad, paddingBottom: layout.scrollBottom },
  cols: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
  colLeft: { flex: 1, minWidth: 0 },
  colRight: { flex: 1, minWidth: 0 },

  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 10, paddingBottom: 14, minHeight: 64 },
  greetSub: { ...typography.caption, fontSize: 13.5 },
  greetName: { ...typography.h2, marginTop: 1 },

  balCard: {
    backgroundColor: colors.card, borderRadius: 26, borderWidth: 1, borderColor: colors.border,
    padding: 20, overflow: 'hidden',
  },
  balTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balLabel: { ...typography.captionMed, fontSize: 13, flex: 1, marginRight: 12 },
  balAmt: { fontSize: 40, fontWeight: '800', color: colors.text, letterSpacing: -1.5, marginTop: 6 },
  netPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, marginTop: 10,
  },
  netTxt: { fontSize: 12.5, fontWeight: '700' },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  stat: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.subtle, borderRadius: radius.lg, padding: 12,
  },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statLabel: { ...typography.caption },
  statVal: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 1 },

  acctRow: { gap: 10, paddingRight: 4 },
  acctCard: {
    width: 138, padding: 14, borderRadius: radius.xl, backgroundColor: colors.card,
    borderWidth: 1.5, borderColor: colors.border,
  },
  acctOn: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  acctAdd: { width: 84, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderColor: colors.accent + '59' },
  acctIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  acctName: { fontSize: 13.5, fontWeight: '700', color: colors.text },
  acctBal: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, marginTop: 3 },

  alert: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56,
    borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10,
  },
  alertTxt: { flex: 1, fontSize: 13.5, color: colors.text, lineHeight: 19 },

  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  legend: { flex: 1, gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 13.5, color: colors.textSecondary },
  legendPct: { fontSize: 13.5, fontWeight: '700', color: colors.text },
}));
