// Theme entry point.
//   colours & text styles → useTheme() / createStyles()  (they depend on light/dark)
//   spacing, radius, layout, categories → plain constants (same in both themes)
export { ThemeProvider, useTheme, createStyles, THEME_MODES } from './ThemeContext';
export { useLayout, WIDE_BREAKPOINT, PAGE_MAX } from './useLayout';
export { palettes, typographyFor, readableOn } from './palettes';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

// Layout constants shared by every screen
export const layout = {
  screenPad: 20,      // horizontal padding of every screen
  touch: 44,          // minimum tappable size (Android/iOS guidelines)
  fabSize: 58,
  fabBottom: 16,
  scrollBottom: 96,   // bottom padding so the floating + never covers the last row
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  full: 999,
};

// Default categories — seeded into the user's data on first run / migration.
// After that, categories live in data.categories and are fully editable.
// 'general' is the permanent fallback category: it cannot be deleted, and
// everything from a deleted category is reassigned to it.
export const GENERAL_CATEGORY_ID = 'general';

export const DEFAULT_CATEGORIES = [
  { id: 'food',      name: 'Food',      icon: '🍔', type: 'expense', color: '#FF5C5C' },
  { id: 'transport', name: 'Transport', icon: '🚗', type: 'expense', color: '#B5FF4D' },
  { id: 'shopping',  name: 'Shopping',  icon: '🛍️', type: 'expense', color: '#4FE3A0' },
  { id: 'housing',   name: 'Housing',   icon: '🏠', type: 'expense', color: '#9370DB' },
  { id: 'health',    name: 'Health',    icon: '💊', type: 'expense', color: '#FFA500' },
  { id: 'bills',     name: 'Bills',     icon: '📱', type: 'expense', color: '#5B8DEF' },
  { id: 'fun',       name: 'Fun',       icon: '🎬', type: 'expense', color: '#FF69B4' },
  { id: 'education', name: 'Education', icon: '📚', type: 'expense', color: '#64B5F6' },
  { id: 'salary',    name: 'Salary',    icon: '💼', type: 'income',  color: '#4FE3A0' },
  { id: 'freelance', name: 'Freelance', icon: '💸', type: 'income',  color: '#B5FF4D' },
  { id: 'investment',name: 'Investment',icon: '📈', type: 'income',  color: '#64B5F6' },
  { id: GENERAL_CATEGORY_ID, name: 'General', icon: '📦', type: 'both', color: '#5A6080' },
];

// Palette + emoji choices offered in the category editor
export const CATEGORY_COLORS = [
  '#FF5C5C', '#FFA500', '#B5FF4D', '#4FE3A0', '#64B5F6', '#5B8DEF',
  '#9370DB', '#FF69B4', '#F4D35E', '#5A6080',
];

export const CATEGORY_ICONS = [
  '🍔','🛒','☕','🍕','🚗','⛽','🚌','✈️','🏠','💡','📱','🌐',
  '💊','🏥','🎬','🎮','📚','🎓','🛍️','👕','🎁','🐶','💇','🏋️',
  '💼','💸','📈','🏦','🧾','🔧','🎉','📦',
];
