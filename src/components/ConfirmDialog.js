import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, useTheme, createStyles } from '../theme';

/**
 * Themed confirmation dialog — replaces Alert.alert for destructive actions.
 *
 * Props:
 *   visible:     bool
 *   icon:        ionicons name  (default 'trash-outline')
 *   title:       string
 *   message:     string
 *   confirmText: string  (default 'Delete')
 *   cancelText:  string  (default 'Cancel')
 *   danger:      bool — red confirm button (default true); false = accent/green
 *   onConfirm:   () => void
 *   onCancel:    () => void
 */
export default function ConfirmDialog({
  visible,
  icon        = 'trash-outline',
  title       = 'Are you sure?',
  message     = '',
  confirmText = 'Delete',
  cancelText  = 'Cancel',
  danger      = true,
  onConfirm,
  onCancel,
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const btnBg   = danger ? colors.expense : colors.accent;
  const iconBg  = danger ? colors.expenseDim : colors.accentDim;
  const iconClr = danger ? colors.expense : colors.accent;
  const btnTxt  = colors.bg;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      {/* Dimmed backdrop — tap to cancel */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onCancel}
      />

      {/* Card — centred on screen */}
      <View style={styles.centreWrap} pointerEvents="box-none">
        <View style={styles.card}>

          {/* Icon circle */}
          <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
            <Ionicons name={icon} size={28} color={iconClr} />
          </View>

          {/* Text */}
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}

          {/* Buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              activeOpacity={0.75}
            >
              <Text style={styles.cancelTxt}>{cancelText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: btnBg }]}
              onPress={onConfirm}
              activeOpacity={0.85}
            >
              <Text style={[styles.confirmTxt, { color: btnTxt }]}>
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const useStyles = createStyles((colors, typography) => ({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  centreWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 4,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    backgroundColor: colors.card2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.muted,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  confirmTxt: {
    fontSize: 14,
    fontWeight: '700',
  },
}));
