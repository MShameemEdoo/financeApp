import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { radius, useTheme, createStyles } from '../theme';
import { useApp } from '../context/AppContext';
import {
  formatCurrency, formatShortMonth, todayISO,
  getLast6Months, getPeriodTransactions,
  shiftMonthKey, monthKeyToDate, daysInPeriod, daysBetweenISO,
} from '../utils/formatters';
import MonthSwitcher from '../components/MonthSwitcher';
import Overlays from '../components/Overlays';
import BarChart from '../components/BarChart';

export default function AnalyticsScreen() {
  const styles = useStyles();
  const { colors, isDark, readable } = useTheme();
  const {
    data, currency,
    totalIncome, totalExpenses, netBalance,
    catSpending, monthlyTxs, filteredTxs,
    selectedAccountId, setSelectedAccountId, getCategory,
    selectedMonthKey, isCurrentMonth, setSelectedMonth,
    monthStartDay, periodStart, periodLabel, periodWord,
  } = useApp();
  const periodWordCap = periodWord.charAt(0).toUpperCase() + periodWord.slice(1);
  const insets = useSafeAreaInsets();

  // 6-month bar chart — respects account filter
  const chartMonths = useMemo(() => {
    return getLast6Months(selectedMonthKey).map(m => {
      const base = selectedAccountId
        ? data.transactions.filter(t => t.accountId === selectedAccountId)
        : data.transactions;
      const txs = getPeriodTransactions(base, m.key, monthStartDay);
      const income  = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      return { key: m.key, label: m.label, income, expense };
    });
  }, [data.transactions, selectedAccountId, selectedMonthKey, monthStartDay]);

  const topCats = useMemo(() => {
    return Object.entries(catSpending)
      .map(([catId, amount]) => {
        const cat = getCategory(catId);
        return { catId, amount, cat };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [catSpending, getCategory]);

  const maxCatSpend = topCats[0]?.amount || 1;
  const daysElapsed = isCurrentMonth
    ? Math.max(daysBetweenISO(periodStart, todayISO()) + 1, 1)   // days since the period began, incl. today
    : daysInPeriod(selectedMonthKey, monthStartDay);
  const avgDaily    = totalExpenses / daysElapsed;

  const savingsRate = totalIncome > 0
    ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100)
    : 0;

  const prevMonthKey = shiftMonthKey(selectedMonthKey, -1);
  const prevLabel    = monthStartDay > 1
    ? (isCurrentMonth ? 'last period' : 'previous period')
    : (isCurrentMonth ? 'last month' : formatShortMonth(monthKeyToDate(prevMonthKey)));

  const lastMonth = useMemo(() => {
    const base = selectedAccountId
      ? data.transactions.filter(t => t.accountId === selectedAccountId)
      : data.transactions;
    const txs = getPeriodTransactions(base, prevMonthKey, monthStartDay);
    return {
      expense: txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    };
  }, [data.transactions, selectedAccountId, prevMonthKey, monthStartDay]);

  const expenseTrend = lastMonth.expense > 0
    ? Math.round(((totalExpenses - lastMonth.expense) / lastMonth.expense) * 100)
    : 0;

  const selectedAccount = selectedAccountId ? data.accounts.find(a => a.id === selectedAccountId) : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Analytics</Text>

        </View>

        {/* Month switcher — shared by all tabs */}
        <MonthSwitcher />

        {/* Account selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipBar}>
          <TouchableOpacity
            style={[styles.chip, !selectedAccountId && styles.chipOn]}
            onPress={() => setSelectedAccountId(null)}
          >
            <Text style={[styles.chipTxt, !selectedAccountId && styles.chipTxtOn]}>All accounts</Text>
          </TouchableOpacity>
          {data.accounts.map(a => (
            <TouchableOpacity
              key={a.id}
              style={[styles.chip, selectedAccountId === a.id && styles.chipOn]}
              onPress={() => setSelectedAccountId(selectedAccountId === a.id ? null : a.id)}
            >
              <Text style={{ fontSize: 12 }}>{a.icon}</Text>
              <Text style={[styles.chipTxt, selectedAccountId === a.id && styles.chipTxtOn]}>{a.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {selectedAccount && (
          <View style={[styles.acctBadge, { borderColor: selectedAccount.color + '50', backgroundColor: selectedAccount.color + '12' }]}>
            <Text style={{ fontSize: 14 }}>{selectedAccount.icon}</Text>
            <Text style={[styles.acctBadgeTxt, { color: readable(selectedAccount.color) }]}>
              Showing data for {selectedAccount.name}
            </Text>
          </View>
        )}

        {/* Stat cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Avg daily spend</Text>
            <Text style={styles.statVal}>{formatCurrency(Math.round(avgDaily), currency)}</Text>
            <Text style={[styles.statChg, expenseTrend <= 0 ? styles.pos : styles.neg]}>
              {expenseTrend <= 0 ? '↓' : '↑'} {Math.abs(expenseTrend)}% vs {prevLabel}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Savings rate</Text>
            <Text style={styles.statVal}>{savingsRate}%</Text>
            <Text style={[styles.statChg, savingsRate >= 20 ? styles.pos : styles.neg]}>
              {formatCurrency(Math.max(netBalance, 0), currency)} saved
            </Text>
          </View>
        </View>

        {/* Bar chart */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View>
              <Text style={styles.cardTitle}>Income vs Expenses</Text>
              <Text style={styles.cardSub}>
                {isCurrentMonth ? `Last 6 ${periodWord}s` : `6 ${periodWord}s to ${periodLabel}`} · tap one to view it
              </Text>
            </View>
          </View>
          <BarChart months={chartMonths} width={320} height={140} onBarPress={i => setSelectedMonth(chartMonths[i].key)} />
          <View style={styles.legend}>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.income }]} /><Text style={styles.legendLabel}>Income</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.expense }]} /><Text style={styles.legendLabel}>Expenses</Text></View>
          </View>
        </View>

        {/* This month summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{isCurrentMonth ? `This ${periodWordCap}` : `${periodWordCap} Summary`}</Text>
          <Text style={styles.cardSub}>{periodLabel}</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryDot, { backgroundColor: colors.income }]} />
              <Text style={styles.summaryLabel}>Income</Text>
              <Text style={[styles.summaryAmt, { color: colors.income }]}>{formatCurrency(totalIncome, currency)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryDot, { backgroundColor: colors.expense }]} />
              <Text style={styles.summaryLabel}>Expenses</Text>
              <Text style={[styles.summaryAmt, { color: colors.expense }]}>{formatCurrency(totalExpenses, currency)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryDot, { backgroundColor: colors.accent }]} />
              <Text style={styles.summaryLabel}>Net</Text>
              <Text style={[styles.summaryAmt, { color: netBalance >= 0 ? colors.income : colors.expense }]}>
                {formatCurrency(Math.abs(netBalance), currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* Top categories */}
        {topCats.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Top Categories</Text>
            <Text style={styles.cardSub}>{periodLabel}</Text>
            <View style={styles.catList}>
              {topCats.map(({ catId, amount, cat }) => (
                <View key={catId} style={styles.catRow}>
                  <Text style={styles.catEmoji}>{cat.icon}</Text>
                  <View style={styles.catInfo}>
                    <View style={styles.catRowTop}>
                      <Text style={styles.catName}>{cat.name}</Text>
                      <Text style={styles.catAmt}>{formatCurrency(amount, currency)}</Text>
                    </View>
                    <View style={styles.catBar}>
                      <View style={[styles.catBarFill, { width: `${(amount / maxCatSpend) * 100}%`, backgroundColor: cat.color }]} />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      <Overlays fab />
    </View>
  );
}

const useStyles = createStyles((colors, typography) => ({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 96 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  title: { ...typography.h2 },
  syncBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },

  chipBar: { paddingBottom: 14, gap: 7, flexDirection: 'row', alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  chipTxt: { fontSize: 12, fontWeight: '600', color: colors.muted },
  chipTxtOn: { color: colors.accent },

  acctBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.md, borderWidth: 1, marginBottom: 14 },
  acctBadgeTxt: { fontSize: 13, fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 15 },
  statLabel: { ...typography.tiny, marginBottom: 4 },
  statVal: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 },
  statChg: { fontSize: 11, fontWeight: '600' },
  pos: { color: colors.income },
  neg: { color: colors.expense },

  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 16, marginBottom: 14 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  cardTitle: { ...typography.h4, marginBottom: 2 },
  cardSub: { ...typography.caption, marginBottom: 14 },

  legend: { flexDirection: 'row', gap: 16, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { ...typography.tiny },

  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryItem: { flex: 1, alignItems: 'center', gap: 5 },
  summaryDot: { width: 8, height: 8, borderRadius: 4 },
  summaryLabel: { ...typography.tiny },
  summaryAmt: { fontSize: 13, fontWeight: '700', textAlign: 'center' },

  catList: { gap: 12 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catEmoji: { fontSize: 16, width: 24 },
  catInfo: { flex: 1 },
  catRowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  catName: { ...typography.bodyMed, fontSize: 13 },
  catAmt: { fontSize: 13, fontWeight: '700', color: colors.text },
  catBar: { backgroundColor: colors.track, borderRadius: 3, height: 4, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 3 },

  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  profileAvi: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.accentDim, alignItems: 'center', justifyContent: 'center' },
  profileName: { ...typography.bodyMed },
  profileEmail: { ...typography.caption, marginTop: 1 },
  syncNote: { ...typography.caption, lineHeight: 18, color: colors.muted, marginBottom: 12 },
  pushBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 11, marginTop: 4,
  },
  pushBtnTxt: { fontSize: 13, fontWeight: '700', color: colors.bg },

}));
