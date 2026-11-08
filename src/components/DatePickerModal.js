import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { radius, useTheme, createStyles } from '../theme';
import { parseLocalDate, toISODate, todayISO, formatDate } from '../utils/formatters';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ── Calendar modal ───────────────────────────────────────────────────────────
// value / onChange work with 'YYYY-MM-DD' strings.
export function DatePickerModal({ visible, value, onChange, onClose }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const selected = parseLocalDate(value || todayISO());
  const [viewYear, setViewYear]   = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());

  // Jump to the selected date's month each time the picker opens
  useEffect(() => {
    if (visible) {
      const d = parseLocalDate(value || todayISO());
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [visible]);

  const today    = todayISO();
  const selISO   = toISODate(selected);
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMo = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMo; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function shiftMonth(delta) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  function pick(day) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(toISODate(new Date(viewYear, viewMonth, day)));
    onClose();
  }

  function pickToday() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(todayISO());
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        {/* Inner touchable swallows taps so tapping the card doesn't close it */}
        <TouchableOpacity style={styles.card} activeOpacity={1} onPress={() => {}}>

          <View style={styles.monthRow}>
            <TouchableOpacity style={styles.navBtn} onPress={() => shiftMonth(-1)} hitSlop={8}>
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.monthTxt}>{MONTHS[viewMonth]} {viewYear}</Text>
            <TouchableOpacity style={styles.navBtn} onPress={() => shiftMonth(1)} hitSlop={8}>
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, i) => (
              <Text key={i} style={styles.weekTxt}>{w}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (day === null) return <View key={i} style={styles.cell} />;
              const iso = toISODate(new Date(viewYear, viewMonth, day));
              const isSel   = iso === selISO;
              const isToday = iso === today;
              return (
                <TouchableOpacity key={i} style={styles.cell} onPress={() => pick(day)} activeOpacity={0.7}>
                  <View style={[
                    styles.dayBubble,
                    isToday && !isSel && styles.dayToday,
                    isSel && styles.daySel,
                  ]}>
                    <Text style={[
                      styles.dayTxt,
                      isToday && !isSel && { color: colors.accent },
                      isSel && { color: colors.bg, fontWeight: '700' },
                    ]}>{day}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.todayBtn} onPress={pickToday}>
              <Ionicons name="today-outline" size={15} color={colors.accent} />
              <Text style={styles.todayTxt}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>

        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Tappable field that shows the date and opens the picker ─────────────────
export function DateField({ value, onChange, label = 'Date', style }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={style}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity style={styles.field} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Ionicons name="calendar-outline" size={16} color={colors.accent} />
        <Text style={styles.fieldTxt}>{formatDate(value)}</Text>
        <Text style={styles.fieldSub}>{parseLocalDate(value).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
        <Ionicons name="chevron-down" size={14} color={colors.muted} />
      </TouchableOpacity>
      <DatePickerModal
        visible={open}
        value={value}
        onChange={onChange}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

const useStyles = createStyles((colors, typography) => ({
  overlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%', maxWidth: 360,
    backgroundColor: colors.surface, borderRadius: 24,
    borderWidth: 1, borderColor: colors.border, padding: 18,
  },

  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  monthTxt: { ...typography.h3 },
  navBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekTxt: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: colors.muted },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayBubble: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayToday: { borderWidth: 1, borderColor: colors.accent },
  daySel: { backgroundColor: colors.accent },
  dayTxt: { fontSize: 14, fontWeight: '500', color: colors.text },

  btnRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  todayBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: radius.md,
    backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accent + '40',
  },
  todayTxt: { fontSize: 13, fontWeight: '700', color: colors.accent },
  cancelBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12,
    borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  cancelTxt: { fontSize: 13, fontWeight: '700', color: colors.muted },

  fieldLabel: { fontSize: 10, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12,
  },
  fieldTxt: { fontSize: 14, fontWeight: '600', color: colors.text },
  fieldSub: { flex: 1, fontSize: 12, color: colors.muted, textAlign: 'right' },
}));
