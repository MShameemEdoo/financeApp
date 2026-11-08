import React, { useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, createStyles, useLayout, PAGE_MAX } from '../theme';

import HomeScreen           from '../screens/HomeScreen';
import TransactionsScreen   from '../screens/TransactionsScreen';
import AddTransactionScreen from '../screens/AddTransactionScreen';
import BudgetScreen         from '../screens/BudgetScreen';
import AnalyticsScreen      from '../screens/AnalyticsScreen';
import AccountsScreen       from '../screens/AccountsScreen';
import SettingsScreen       from '../screens/SettingsScreen';
import TransactionSheet     from '../components/TransactionSheet';
import CategoriesScreen     from '../screens/CategoriesScreen';
import AuthScreen           from '../screens/AuthScreen';
import SyncBanner           from '../components/SyncBanner';

import { useApp } from '../context/AppContext';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

// The four tabs shown in the phone's bottom bar. Other screens (Add, Accounts, Settings,
// Categories) are registered as hidden tabs so the bar stays visible on them.
const VISIBLE_TABS = ['Home', 'Transactions', 'Budgets', 'Analytics'];

// Desktop sidebar: everything is one click away
const SIDEBAR_MAIN = [
  { name: 'Home',         label: 'Home',         icon: 'home' },
  { name: 'Transactions', label: 'Transactions', icon: 'list' },
  { name: 'Budgets',      label: 'Budgets',      icon: 'wallet' },
  { name: 'Analytics',    label: 'Analytics',    icon: 'bar-chart' },
];
const SIDEBAR_MORE = [
  { name: 'Accounts',   label: 'Accounts',   icon: 'card' },
  { name: 'Categories', label: 'Categories', icon: 'pricetags' },
  { name: 'Settings',   label: 'Settings',   icon: 'settings' },
];

// ── Phone: bottom bar ───────────────────────────────────────────────────────
function BottomBar({ state, navigation }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const currentName = state.routes[state.index].name;

  // On a hidden screen, keep highlighting the tab the user came from
  const lastVisible = useRef('Home');
  if (VISIBLE_TABS.includes(currentName)) lastVisible.current = currentName;
  const activeName = lastVisible.current;

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.filter(r => VISIBLE_TABS.includes(r.name)).map(route => {
        const focused = route.name === activeName;
        const icon = {
          Home:        focused ? 'home'      : 'home-outline',
          Transactions:focused ? 'list'      : 'list-outline',
          Budgets:     focused ? 'wallet'    : 'wallet-outline',
          Analytics:   focused ? 'bar-chart' : 'bar-chart-outline',
        }[route.name] || 'apps';
        return (
          <TouchableOpacity key={route.key} style={styles.tabItem} onPress={() => navigation.navigate(route.name)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={route.name}>
            <Ionicons name={icon} size={22} color={focused ? colors.accent : colors.muted} />
            <Text style={[styles.tabLabel, focused && styles.tabLabelOn]}>{route.name}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Desktop: sidebar ────────────────────────────────────────────────────────
function SidebarItem({ item, active, onPress }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.sbItem, active && styles.sbItemOn]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
    >
      <Ionicons name={active ? item.icon : `${item.icon}-outline`} size={20} color={active ? colors.accent : colors.textSecondary} />
      <Text style={[styles.sbLabel, active && styles.sbLabelOn]}>{item.label}</Text>
    </TouchableOpacity>
  );
}

function Sidebar({ state, navigation }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user, syncing, needsReconnect, syncError, driveEmpty, manualSync } = useApp();
  const current = state.routes[state.index].name;

  let syncIcon = 'cloud-done-outline', syncTint = colors.income, syncTxt = 'Synced';
  if (!user)               { syncIcon = 'phone-portrait-outline'; syncTint = colors.muted;   syncTxt = 'This device only'; }
  else if (needsReconnect) { syncIcon = 'cloud-offline-outline';  syncTint = colors.orange;  syncTxt = 'Reconnect to sync'; }
  else if (syncError)      { syncIcon = 'cloud-offline-outline';  syncTint = colors.expense; syncTxt = 'Sync failed'; }
  else if (syncing)        { syncIcon = 'sync-outline';           syncTint = colors.accent;  syncTxt = 'Syncing…'; }
  else if (driveEmpty)     { syncIcon = 'cloud-outline';          syncTint = colors.muted;   syncTxt = 'No backup found'; }

  return (
    <View style={styles.sidebar}>
      <View style={styles.sbBrand}>
        <Image source={require('../../assets/monei_Icon2.png')} style={styles.sbLogo} resizeMode="contain" />
        <Text style={styles.sbBrandTxt}>Monei</Text>
      </View>

      <TouchableOpacity
        style={styles.sbAdd}
        onPress={() => navigation.navigate('Add', { defaultType: 'expense' })}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Add transaction"
      >
        <Ionicons name="add" size={20} color={colors.bg} />
        <Text style={styles.sbAddTxt}>Add transaction</Text>
      </TouchableOpacity>

      <View style={styles.sbGroup}>
        {SIDEBAR_MAIN.map(i => (
          <SidebarItem key={i.name} item={i} active={current === i.name} onPress={() => navigation.navigate(i.name)} />
        ))}
      </View>
      <View style={styles.sbDivider} />
      <View style={styles.sbGroup}>
        {SIDEBAR_MORE.map(i => (
          <SidebarItem key={i.name} item={i} active={current === i.name} onPress={() => navigation.navigate(i.name)} />
        ))}
      </View>

      <View style={{ flex: 1 }} />

      <TouchableOpacity
        style={styles.sbSync}
        onPress={user ? (needsReconnect ? () => navigation.navigate('Settings') : manualSync) : () => navigation.navigate('Settings')}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Sync status: ${syncTxt}`}
      >
        <Ionicons name={syncIcon} size={16} color={syncTint} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.sbSyncTxt, { color: syncTint }]} numberOfLines={1}>{syncTxt}</Text>
          {!!user?.email && <Text style={styles.sbSyncSub} numberOfLines={1}>{user.email}</Text>}
        </View>
      </TouchableOpacity>
    </View>
  );
}

function MainTabBar(props) {
  const { isWide } = useLayout();
  return isWide ? <Sidebar {...props} /> : <BottomBar {...props} />;
}

// Centre every page in a column of readable width (desktop only; on a phone it is a no-op).
// Defined once per route so each screen keeps a stable identity.
function inPage(Screen, max = PAGE_MAX.wide) {
  return function Page(props) {
    const { isWide } = useLayout();
    if (!isWide) return <Screen {...props} />;
    return (
      <View style={{ flex: 1, alignItems: 'center' }}>
        <View style={{ flex: 1, width: '100%', maxWidth: max }}>
          <Screen {...props} />
        </View>
      </View>
    );
  };
}
const HomePage         = inPage(HomeScreen);
const TransactionsPage = inPage(TransactionsScreen, PAGE_MAX.wide);
const BudgetsPage      = inPage(BudgetScreen);
const AnalyticsPage    = inPage(AnalyticsScreen);
const AddPage          = inPage(AddTransactionScreen, PAGE_MAX.form);
const AccountsPage     = inPage(AccountsScreen, PAGE_MAX.narrow);
const CategoriesPage   = inPage(CategoriesScreen, PAGE_MAX.narrow);
const SettingsPage     = inPage(SettingsScreen, PAGE_MAX.narrow);

function MainTabs() {
  const { isWide } = useLayout();
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SyncBanner />
      <View style={{ flex: 1 }}>
        <Tab.Navigator
          tabBar={props => <MainTabBar {...props} />}
          screenOptions={{ headerShown: false, tabBarPosition: isWide ? 'left' : 'bottom' }}
          backBehavior="history"   // Back returns to the screen you came from
        >
          {/* Visible tabs */}
          <Tab.Screen name="Home"         component={HomePage} />
          <Tab.Screen name="Transactions" component={TransactionsPage} />
          <Tab.Screen name="Budgets"      component={BudgetsPage} />
          <Tab.Screen name="Analytics"    component={AnalyticsPage} />

          {/* Hidden tabs — reachable by navigate(); on a phone never drawn in the bar */}
          <Tab.Screen name="Add"          component={AddPage} />
          <Tab.Screen name="Accounts"     component={AccountsPage} />
          <Tab.Screen name="Settings"     component={SettingsPage} />
          <Tab.Screen name="Categories"   component={CategoriesPage} />
        </Tab.Navigator>

        {/* One shared edit / delete sheet: opens when ANY transaction row is tapped */}
        <TransactionSheet />
      </View>
    </View>
  );
}

// On the web the address bar follows the screen (/transactions, /budgets …), so refresh
// and the browser's back button work as expected. Phones don't use this.
const linking = {
  enabled: Platform.OS === 'web',
  prefixes: [],
  config: {
    screens: {
      Main: {
        screens: {
          Home: '',
          Transactions: 'transactions',
          Budgets: 'budgets',
          Analytics: 'analytics',
          Add: 'add',
          Accounts: 'accounts',
          Categories: 'categories',
          Settings: 'settings',
        },
      },
    },
  },
};

export default function AppNavigator() {
  const { user, authSkipped, loading } = useApp();
  const { colors, isDark } = useTheme();
  // React Navigation paints its own background behind screens while they animate;
  // give it the app's palette so that never flashes the wrong colour.
  const navTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      dark: isDark,
      colors: { ...base.colors, primary: colors.accent, background: colors.bg, card: colors.surface, text: colors.text, border: colors.border },
    };
  }, [colors, isDark]);
  if (loading) return null;
  return (
    <NavigationContainer theme={navTheme} linking={linking} documentTitle={{ formatter: () => 'Monei' }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {(user || authSkipped) ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const useStyles = createStyles((colors, typography) => ({
  tabBar: { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  tabItem: { flex: 1, alignItems: 'center', gap: 4 },
  tabLabel: { fontSize: 10, fontWeight: '600', color: colors.muted },
  tabLabelOn: { color: colors.accent },

  sidebar: { width: 240, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.border, paddingHorizontal: 14, paddingTop: 22, paddingBottom: 16 },
  sbBrand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, marginBottom: 22 },
  sbLogo: { width: 34, height: 34, borderRadius: 10 },
  sbBrandTxt: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  sbAdd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 46, borderRadius: 14, backgroundColor: colors.accent, marginBottom: 18 },
  sbAddTxt: { fontSize: 14.5, fontWeight: '800', color: colors.bg },
  sbGroup: { gap: 2 },
  sbDivider: { height: 1, backgroundColor: colors.border, marginVertical: 12, marginHorizontal: 8 },
  sbItem: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 42, paddingHorizontal: 12, borderRadius: 12 },
  sbItemOn: { backgroundColor: colors.accentDim },
  sbLabel: { fontSize: 14.5, fontWeight: '600', color: colors.textSecondary },
  sbLabelOn: { color: colors.accent, fontWeight: '700' },
  sbSync: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  sbSyncTxt: { fontSize: 12.5, fontWeight: '700' },
  sbSyncSub: { fontSize: 11, color: colors.muted, marginTop: 1 },
}));
