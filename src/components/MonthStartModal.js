import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { radius, useTheme, createStyles, useLayout } from '../theme';
import { useApp } from '../context/AppContext';
import { MAX_START_DAY, ordinal, periodKeyOfDate, formatPeriod } from '../utils/formatters';

const DAYS = Array.from({ length: MAX_START_DAY }, (_, i) => i + 1);

/**
 * Lets the user choose which day of the month a tracking period starts on.
 * Day 1 (default) = calendar months. Day 25 = 25 Oct → 24 Nov, and so on.
 */
export default function MonthStartModal({ visible, onClose }) {
  const styles = useStyles();
  const { dialog } = useLayout();
  const { colors } = useTheme();
  const { monthStartDay, setMonthStartDay } = useApp();
  const insets = useSafeAreaInsets();
  const [day, setDay]       = useState(monthStartDay);
  const [saving, setSaving] = useState(false);

  // Start from the saved value every time the sheet opens
  useEffect(() => {
    if (visible) setDay(monthStartDay);
  }, [visible]);

  // Preview: which period would TODAY fall in with the chosen day?
  const previewKey   = periodKeyOfDate(new Date(), day);
  const previewLabel = formatPeriod(previewKey, day);
  const changed      = day !== monthStartDay;

  function pick(d) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDay(d);
  }

  async function save() {
    if (!changed) { onClose(); return; }
    setSaving(true);
    try {
      await setMonthStartDay(day);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType={dialog.animation} onRequestClose={onClose}>
      <View style={[styles.overlay, dialog.overlay]}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 16, 28) }, dialog.card]}>

          <View style={styles.header}>
            <Text style={styles.title}>Month starts on</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.sub}>
            Choose the day your month begins, for example the day you get paid. Balances, budgets and analytics all follow it.
          </Text>

          {/* Day grid */}
          <View style={styles.grid}>
            {DAYS.map(d => {
              const on = d === day;
              return (
                <View key={d} style={styles.cellWrap}>
                  <TouchableOpacity
                    style={[styles.cell, on && styles.cellOn]}
                    onPress={() => pick(d)}
                    activeOpacity={0.75}
                    accessibilityLabel={`Day ${d}`}
                  >
                    <Text style={[styles.cellTxt, on && styles.cellTxtOn]}>{d}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {/* Live preview */}
          <View style={styles.preview}>
            <Ionicons name="calendar-outline" size={18} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.previewTitle}>
                {day === 1
                  ? 'Calendar months (1st to the last day)'
                  : `Each month runs from the ${ordinal(day)} to the ${ordinal(day - 1)}`}
              </Text>
              <Text style={styles.previewSub}>Today falls in {previewLabel}</Text>
            </View>
          </View>

          <Text style={styles.note}>
            Your transactions are not changed, only how they are grouped into months. Days 29–31 aren't offered so every month has a start date.
          </Text>

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, !changed && { opacity: 0.5 }]}
              onPress={save}
              disabled={saving || !changed}
              activeOpacity={0.85}
            >
              <Text style={styles.saveTxt}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const useStyles = createStyles((colors, typography) => ({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1, borderTopColor: colors.border, padding: 24,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { ...typography.h3 },
  sub: { ...typography.caption, lineHeight: 18, marginBottom: 16 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  cellWrap: { width: `${100 / 7}%`, padding: 3 },
  cell: {
    aspectRatio: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  cellOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  cellTxt: { fontSize: 14, fontWeight: '600', color: colors.text },
  cellTxtOn: { color: colors.bg, fontWeight: '700' },

  preview: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accent + '33',
    borderRadius: radius.lg, padding: 14, marginTop: 14,
  },
  previewTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  previewSub: { fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 17 },

  note: { ...typography.caption, lineHeight: 17, marginTop: 12, marginBottom: 16 },

  btnRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: radius.lg,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  cancelTxt: { fontSize: 14, fontWeight: '700', color: colors.muted },
  saveBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: radius.lg, backgroundColor: colors.accent },
  saveTxt: { fontSize: 14, fontWeight: '700', color: colors.bg },
}));
