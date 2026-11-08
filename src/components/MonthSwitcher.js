import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { radius, useTheme, createStyles } from '../theme';
import { useApp } from '../context/AppContext';
import { parseMonthKey, ordinal } from '../utils/formatters';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const keyOf = (year, monthIdx) => `${year}-${String(monthIdx + 1).padStart(2, '0')}`;

/**
 * Shared month control used on Home, Transactions, Budgets and Analytics.
 * The selected month lives in AppContext, so every tab follows the same month.
 *
 * Optional "All time" mode (Transactions only):
 *   allTime          – true while showing every month
 *   onAllTimeChange  – (bool) => void ; when provided, the picker offers an "All time" button
 */
export default function MonthSwitcher({ allTime = false, onAllTimeChange, style }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const {
    selectedMonthKey, isCurrentMonth, canGoPrev, canGoNext,
    goPrevMonth, goNextMonth, goToCurrentMonth, setSelectedMonth,
    monthsWithData, minMonthKey, maxMonthKey,
    monthStartDay, periodWord, formatPeriodLabel, formatPeriodParts,
  } = useApp();
  const parts = formatPeriodParts(selectedMonthKey);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(parseMonthKey(selectedMonthKey).year);

  // Open on the selected month's year each time
  useEffect(() => {
    if (pickerOpen) setPickerYear(parseMonthKey(selectedMonthKey).year);
  }, [pickerOpen]);

  const minYear = parseMonthKey(minMonthKey).year;
  const maxYear = parseMonthKey(maxMonthKey).year;

  const prevDisabled = allTime || !canGoPrev;
  const nextDisabled = allTime || !canGoNext;
  const showReset = allTime || !isCurrentMonth;

  function tap(fn) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fn();
  }

  function pickMonth(key) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMonth(key);
    onAllTimeChange?.(false);
    setPickerOpen(false);
  }

  function pickAllTime() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAllTimeChange?.(true);
    setPickerOpen(false);
  }

  function resetToToday() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    goToCurrentMonth();
    onAllTimeChange?.(false);
    setPickerOpen(false);
  }

  return (
    <View style={[styles.row, style]}>
      <View style={styles.bar}>
        <TouchableOpacity
          style={[styles.arrow, prevDisabled && styles.arrowOff]}
          onPress={() => tap(goPrevMonth)}
          disabled={prevDisabled}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
          accessibilityLabel="Previous month"
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.label}
          onPress={() => setPickerOpen(true)}
          activeOpacity={0.7}
          accessibilityLabel="Choose month"
        >
          <View style={styles.labelCol}>
            <Text style={styles.labelTxt} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {allTime ? 'All time' : parts.main}
            </Text>
            {!allTime && !!parts.sub && <Text style={styles.labelSub}>{parts.sub}</Text>}
          </View>
          <Ionicons name="chevron-down" size={14} color={colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.arrow, nextDisabled && styles.arrowOff]}
          onPress={() => tap(goNextMonth)}
          disabled={nextDisabled}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
          accessibilityLabel="Next month"
        >
          <Ionicons name="chevron-forward" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      {showReset && (
        <TouchableOpacity style={styles.resetPill} onPress={resetToToday} activeOpacity={0.8}>
          <Ionicons name="today-outline" size={14} color={colors.accent} />
          <Text style={styles.resetTxt}>This {periodWord}</Text>
        </TouchableOpacity>
      )}

      {/* Month / year picker */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setPickerOpen(false)}>
          <TouchableOpacity style={styles.card} activeOpacity={1} onPress={() => {}}>

            <View style={styles.yearRow}>
              <TouchableOpacity
                style={[styles.arrow, pickerYear <= minYear && styles.arrowOff]}
                onPress={() => setPickerYear(y => y - 1)}
                disabled={pickerYear <= minYear}
              >
                <Ionicons name="chevron-back" size={18} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.yearTxt}>{pickerYear}</Text>
              <TouchableOpacity
                style={[styles.arrow, pickerYear >= maxYear && styles.arrowOff]}
                onPress={() => setPickerYear(y => y + 1)}
                disabled={pickerYear >= maxYear}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.grid}>
              {MONTHS_SHORT.map((name, i) => {
                const key = keyOf(pickerYear, i);
                const inRange  = key >= minMonthKey && key <= maxMonthKey;
                const selected = !allTime && key === selectedMonthKey;
                const hasData  = monthsWithData.has(key);
                return (
                  <View key={key} style={styles.cellWrap}>
                    <TouchableOpacity
                      style={[styles.cell, selected && styles.cellSel, !inRange && styles.cellOff]}
                      onPress={() => pickMonth(key)}
                      disabled={!inRange}
                      activeOpacity={0.75}
                    >
                      <Text style={[
                        styles.cellTxt,
                        !hasData && inRange && { color: colors.muted },
                        selected && { color: colors.bg, fontWeight: '700' },
                      ]}>{name}</Text>
                      <View style={[
                        styles.dot,
                        hasData
                          ? { backgroundColor: selected ? colors.bg : colors.accent }
                          : { backgroundColor: 'transparent' },
                      ]} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            <Text style={styles.legend}>
              ● = has transactions
              {monthStartDay > 1 ? `\nEach ${periodWord} starts on the ${ordinal(monthStartDay)} · Oct = ${formatPeriodLabel(keyOf(pickerYear, 9))}` : ''}
            </Text>

            <View style={styles.btnRow}>
              {onAllTimeChange && (
                <TouchableOpacity style={[styles.btn, allTime && styles.btnOn]} onPress={pickAllTime}>
                  <Text style={[styles.btnTxt, allTime && { color: colors.bg }]}>All time</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.btn} onPress={resetToToday}>
                <Text style={styles.btnTxt}>This {periodWord}</Text>
              </TouchableOpacity>
            </View>

          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const useStyles = createStyles((colors, typography) => ({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  bar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: 4,
  },
  arrow: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: colors.card2 || colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  arrowOff: { opacity: 0.3 },
  label: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
  labelCol: { flexShrink: 1, alignItems: 'center' },
  labelTxt: { fontSize: 15, fontWeight: '700', color: colors.text },
  labelSub: { fontSize: 11, fontWeight: '600', color: colors.muted, marginTop: 1 },

  resetPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 8,
    paddingHorizontal: 12, height: 44, borderRadius: radius.lg,
    backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accent + '40',
  },
  resetTxt: { fontSize: 12, fontWeight: '700', color: colors.accent },

  overlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%', maxWidth: 340,
    backgroundColor: colors.surface, borderRadius: 24,
    borderWidth: 1, borderColor: colors.border, padding: 18,
  },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  yearTxt: { ...typography.h3 },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cellWrap: { width: '33.333%', padding: 4 },
  cell: {
    height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  cellSel: { backgroundColor: colors.accent, borderColor: colors.accent },
  cellOff: { opacity: 0.25 },
  cellTxt: { fontSize: 14, fontWeight: '600', color: colors.text },
  dot: { width: 5, height: 5, borderRadius: 3 },

  legend: { ...typography.caption, textAlign: 'center', marginTop: 8, marginBottom: 12, lineHeight: 17 },
  btnRow: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12,
    borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  btnOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  btnTxt: { fontSize: 13, fontWeight: '700', color: colors.text },
}));
