import { useWindowDimensions } from 'react-native';
import { useTheme } from './ThemeContext';

// At or above this width the app switches from the phone layout (bottom bar, bottom
// sheets) to the desktop layout (sidebar, centred page column, centred dialogs).
export const WIDE_BREAKPOINT = 900;

// Widest a page's content gets before it stops growing (keeps lines readable on big monitors)
export const PAGE_MAX = { wide: 1040, narrow: 720, form: 600 };

export function useLayout() {
  const { width, height } = useWindowDimensions();
  const { colors } = useTheme();
  const isWide = width >= WIDE_BREAKPOINT;

  // Spread these onto the overlay / card of any bottom-sheet style modal.
  // On the phone they are empty, so nothing changes there.
  const dialog = isWide
    ? {
        animation: 'fade',
        overlay: { justifyContent: 'center', alignItems: 'center', padding: 24 },
        card: {
          width: 580, maxWidth: '100%', maxHeight: Math.max(360, height - 48),
          borderRadius: 24, borderWidth: 1, borderColor: colors.border,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
        },
      }
    : { animation: 'slide', overlay: null, card: null };

  return { width, height, isWide, dialog };
}
