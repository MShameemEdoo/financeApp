import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Keyboard, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { layout, useTheme, createStyles, useLayout } from '../theme';

/**
 * The floating "+" — adding a transaction is one tap from any main tab.
 * It hides while the keyboard is open (e.g. while searching) so it never covers typing.
 */
export default function QuickAddFab() {
  const s = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [keyboardUp, setKeyboardUp] = useState(false);
  const { isWide } = useLayout();

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardUp(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  if (keyboardUp || isWide) return null;   // desktop: the sidebar has an Add button

  return (
    <TouchableOpacity
      style={s.fab}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        navigation.navigate('Add', { defaultType: 'expense' });
      }}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Add transaction"
    >
      <Ionicons name="add" size={30} color={colors.bg} />
    </TouchableOpacity>
  );
}

const useStyles = createStyles((colors, typography) => ({
  fab: {
    position: 'absolute', right: layout.screenPad, bottom: layout.fabBottom,
    width: layout.fabSize, height: layout.fabSize, borderRadius: layout.fabSize / 2,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.accent, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
}));
