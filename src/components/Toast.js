import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { radius, layout, createStyles } from '../theme';
import { useApp } from '../context/AppContext';

/**
 * The single message shown at the bottom of the screen, e.g. "Expense added · Undo".
 * State and the auto-hide timer live in AppContext, so any screen can call showToast()
 * and the message survives navigation (add a transaction → Add closes → toast is on Home).
 */
export default function ToastHost({ bottom = 16 }) {
  const s = useStyles();
  const { toast, dismissToast } = useApp();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (toast) Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    else opacity.setValue(0);
  }, [toast && toast.id]);

  if (!toast) return null;

  return (
    <Animated.View pointerEvents="box-none" style={[s.wrap, { bottom, opacity }]}>
      <View style={s.toast} accessibilityLiveRegion="polite">
        <Text style={s.text} numberOfLines={2}>{toast.text}</Text>
        {!!toast.actionLabel && (
          <TouchableOpacity
            style={s.action}
            onPress={() => { const fn = toast.onAction; dismissToast(); fn && fn(); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
          >
            <Text style={s.actionTxt}>{toast.actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const useStyles = createStyles((colors, typography) => ({
  wrap: { position: 'absolute', left: layout.screenPad - 4, right: layout.screenPad - 4 },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52,
    backgroundColor: colors.toast, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.toastBorder,
    paddingLeft: 16, paddingRight: 6, paddingVertical: 6,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  text: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.toastText },
  action: { minHeight: 40, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  actionTxt: { fontSize: 14, fontWeight: '800', color: colors.toastAction },
}));
