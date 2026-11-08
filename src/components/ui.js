import React from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, layout, useTheme, createStyles, useLayout } from '../theme';

/* ──────────────────────────────────────────────────────────────────────────
 * Shared building blocks. Using these everywhere keeps spacing, touch targets
 * (44 px minimum), contrast and states consistent across the whole app.
 * ────────────────────────────────────────────────────────────────────────── */

// Square icon button with a 44 px touch target
export function IconButton({ name, onPress, label, tint, bg, size = 20, style, badge }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[s.iconBtn, { backgroundColor: bg ?? colors.card }, style]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={name} size={size} color={tint ?? colors.textSecondary} />
      {!!badge && (
        <View style={s.badge}>
          <Text style={s.badgeTxt}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// Page title row. Optional back arrow, subtitle and a right-hand slot.
export function ScreenHeader({ title, subtitle, onBack, right, style }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[s.header, style]}>
      {onBack && (
        <IconButton name="arrow-back" onPress={onBack} label="Go back" tint={colors.text} bg="transparent" style={{ marginLeft: -10 }} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={s.headerTitle} numberOfLines={1} accessibilityRole="header">{title}</Text>
        {!!subtitle && <Text style={s.headerSub} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

// Pill used for filters, accounts, dates. `onRemove` adds a × (active-filter chips).
export function Chip({ label, icon, selected, onPress, tint, onRemove, style, sub }) {
  const s = useStyles();
  const { colors, readable } = useTheme();
  const tintColor = tint ?? colors.accent;
  // the chip's own colour may be a user-chosen one (e.g. lime): use a legible shade for text/icons
  const ink = readable(tintColor);
  return (
    <TouchableOpacity
      style={[s.chip, selected && { borderColor: tintColor, backgroundColor: tintColor + '22' }, style]}
      onPress={onPress}
      activeOpacity={0.75}
      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
    >
      {!!icon && (typeof icon === 'string' && /^[a-z-]+$/.test(icon)
        ? <Ionicons name={icon} size={14} color={selected ? ink : colors.textSecondary} />
        : <Text style={s.chipEmoji}>{icon}</Text>)}
      <View>
        <Text style={[s.chipTxt, selected && { color: ink }]} numberOfLines={1}>{label}</Text>
        {!!sub && <Text style={s.chipSub} numberOfLines={1}>{sub}</Text>}
      </View>
      {onRemove && (
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel={`Remove ${label} filter`}>
          <Ionicons name="close" size={14} color={selected ? ink : colors.textSecondary} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

// "Spending  ·········  See all"
export function SectionHeader({ title, actionLabel, onAction, style }) {
  const s = useStyles();
  return (
    <View style={[s.secHeader, style]}>
      <Text style={s.secTitle} accessibilityRole="header">{title}</Text>
      {!!actionLabel && (
        <TouchableOpacity onPress={onAction} hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }} accessibilityRole="button">
          <Text style={s.secAction}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function Card({ children, style }) {
  const s = useStyles();
  return <View style={[s.card, style]}>{children}</View>;
}

// Friendly "nothing here" with a way forward
export function EmptyState({ emoji = '🧾', title, message, actionLabel, onAction, secondaryLabel, onSecondary }) {
  const s = useStyles();
  return (
    <View style={s.empty}>
      <Text style={s.emptyEmoji}>{emoji}</Text>
      {!!title && <Text style={s.emptyTitle}>{title}</Text>}
      {!!message && <Text style={s.emptyMsg}>{message}</Text>}
      {!!actionLabel && (
        <TouchableOpacity style={s.emptyBtn} onPress={onAction} activeOpacity={0.85} accessibilityRole="button">
          <Text style={s.emptyBtnTxt}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
      {!!secondaryLabel && (
        <TouchableOpacity onPress={onSecondary} style={{ paddingVertical: 10 }} accessibilityRole="button">
          <Text style={s.emptyLink}>{secondaryLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Equal-width options, each with its own colour: Expense | Income | Transfer
export function Segmented({ options, value, onChange, style }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[s.seg, style]} accessibilityRole="tablist">
      {options.map(o => {
        const on = o.key === value;
        return (
          <TouchableOpacity
            key={o.key}
            style={[s.segBtn, on && { backgroundColor: (o.color || colors.accent) + '26' }]}
            onPress={() => onChange(o.key)}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
          >
            <Text style={[s.segTxt, on && { color: o.color || colors.accent }]} numberOfLines={1}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Bottom sheet: dimmed backdrop (tap to close), grab handle, title, scrollable body, pinned footer.
export function Sheet({ visible, onClose, title, children, footer, scroll = true, tall = false }) {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { dialog } = useLayout();
  return (
    <Modal visible={visible} transparent animationType={dialog.animation} onRequestClose={onClose}>
      <KeyboardAvoidingView style={[s.sheetRoot, dialog.overlay]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={onClose} accessibilityLabel="Close" />
        <View style={[s.sheet, tall && { height: '88%' }, dialog.card, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <View style={s.handle} />
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle} accessibilityRole="header">{title}</Text>
            <IconButton name="close" onPress={onClose} label="Close" bg="transparent" tint={colors.textSecondary} style={{ marginRight: -10 }} />
          </View>
          {scroll ? (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>
              {children}
            </ScrollView>
          ) : (
            <View style={{ flex: 1 }}>{children}</View>
          )}
          {!!footer && <View style={s.sheetFooter}>{footer}</View>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Big primary action (full width)
export function PrimaryButton({ label, onPress, color, textColor, icon, disabled, dim, style }) {
  const s = useStyles();
  const { colors } = useTheme();
  const fill = color ?? colors.accent;
  const ink = textColor ?? colors.bg;
  return (
    <TouchableOpacity
      style={[s.primary, { backgroundColor: fill }, dim && { opacity: 0.45 }, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {!!icon && <Ionicons name={icon} size={18} color={ink} />}
      <Text style={[s.primaryTxt, { color: ink }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

const useStyles = createStyles((colors, typography) => ({
  iconBtn: { width: layout.touch, height: layout.touch, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: 5, right: 5, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeTxt: { fontSize: 10, fontWeight: '800', color: colors.bg },

  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: layout.screenPad, paddingTop: 10, paddingBottom: 12, minHeight: 64 },
  headerTitle: { ...typography.h2 },
  headerSub: { ...typography.caption, marginTop: 2 },

  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card,
  },
  chipEmoji: { fontSize: 14 },
  chipTxt: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chipSub: { fontSize: 11, fontWeight: '500', color: colors.muted, marginTop: 1 },

  secHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  secTitle: { ...typography.h4 },
  secAction: { fontSize: 13, fontWeight: '700', color: colors.accent },

  card: { backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 16 },

  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 28 },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { ...typography.h4, textAlign: 'center', marginBottom: 6 },
  emptyMsg: { ...typography.caption, textAlign: 'center', lineHeight: 19, fontSize: 13.5 },
  emptyBtn: { marginTop: 16, backgroundColor: colors.accent, borderRadius: radius.lg, paddingHorizontal: 22, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  emptyBtnTxt: { fontSize: 14, fontWeight: '700', color: colors.bg },
  emptyLink: { fontSize: 13, fontWeight: '700', color: colors.accent },

  seg: { flexDirection: 'row', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 3 },
  segBtn: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 11, paddingHorizontal: 6 },
  segTxt: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },

  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 20, paddingTop: 8, maxHeight: '92%',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 6, backgroundColor: colors.handle },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  sheetTitle: { ...typography.h3 },
  sheetFooter: { paddingTop: 12 },

  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 54, borderRadius: radius.lg, paddingHorizontal: 18 },
  primaryTxt: { fontSize: 15, fontWeight: '800' },
}));
