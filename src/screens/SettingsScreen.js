import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { radius, useTheme, createStyles } from '../theme';
import { useApp } from '../context/AppContext';
import ConfirmDialog from '../components/ConfirmDialog';
import MonthStartModal from '../components/MonthStartModal';
import CurrencyPicker from '../components/CurrencyPicker';
import Overlays from '../components/Overlays';
import { Segmented } from '../components/ui';
import { findCurrency } from '../utils/currencies';
import { ordinal, periodKeyOfDate, formatPeriod } from '../utils/formatters';
import appConfig from '../../app.json';

function NavRow({ icon, tint, label, sub, onPress, last }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const tintColor = tint ?? colors.accent;
  return (
    <TouchableOpacity
      style={[styles.navRow, last && { borderBottomWidth: 0 }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.navIcon, { backgroundColor: tintColor + '1A' }]}>
        <Ionicons name={icon} size={18} color={tintColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.navLabel}>{label}</Text>
        {!!sub && <Text style={styles.navSub}>{sub}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ navigation }) {
  const styles = useStyles();
  const { colors, isDark, mode, setMode, scheme } = useTheme();
  const {
    data, categories, user, syncing, syncError, signingIn,
    needsReconnect, driveEmpty, lastSyncedAt, reconnect,
    signIn, signOut, manualSync, monthStartDay,
    currency, currencyCode, setCurrency, showToast,
  } = useApp();
  const insets = useSafeAreaInsets();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [showStartDay, setShowStartDay]     = useState(false);
  const [currencyOpen, setCurrencyOpen]     = useState(false);
  const [pendingCurrency, setPendingCurrency] = useState(null);   // code awaiting confirmation
  const currentCurrency = findCurrency(currencyCode);
  const currentPeriod = formatPeriod(periodKeyOfDate(new Date(), monthStartDay), monthStartDay);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Appearance: System (follows the phone) / Light / Dark */}
        <Text style={styles.secLabel}>Appearance</Text>
        <View style={styles.appearanceCard}>
          <Segmented
            options={[
              { key: 'system', label: 'System', color: colors.accent },
              { key: 'light',  label: 'Light',  color: colors.accent },
              { key: 'dark',   label: 'Dark',   color: colors.accent },
            ]}
            value={mode}
            onChange={setMode}
          />
          <Text style={styles.appearanceNote}>
            {mode === 'system'
              ? `Follows your phone’s setting. It is ${scheme} right now.`
              : `Always ${mode}, whatever your phone is set to.`}
          </Text>
        </View>

        {/* Preferences */}
        <Text style={styles.secLabel}>Preferences</Text>
        <View style={styles.listCard}>
          <NavRow
            icon="cash-outline"
            tint={colors.income}
            label="Currency"
            sub={currentCurrency ? `${currentCurrency.name} (${currentCurrency.code}) · ${currency}` : `Not set · showing “${currency}”`}
            onPress={() => setCurrencyOpen(true)}
          />
          <NavRow
            icon="calendar-outline"
            tint={colors.accent}
            label="Month starts on"
            sub={`${ordinal(monthStartDay)} · ${currentPeriod}`}
            onPress={() => setShowStartDay(true)}
            last
          />
        </View>
        <Text style={styles.privacy}>
          Foreign-currency rates come from a free public exchange-rate API. Only currency codes are sent, never your amounts or personal data.
        </Text>

        {/* Manage */}
        <Text style={styles.secLabel}>Manage</Text>
        <View style={styles.listCard}>
          <NavRow
            icon="pricetags-outline"
            tint={colors.purple}
            label="Categories"
            sub={`${categories.length} categories`}
            onPress={() => navigation.navigate('Categories')}
          />
          <NavRow
            icon="wallet-outline"
            tint={colors.blue}
            label="Accounts"
            sub={`${data.accounts.length} account${data.accounts.length === 1 ? '' : 's'}`}
            onPress={() => navigation.navigate('Accounts')}
            last
          />
        </View>

        {/* Drive sync (moved here from Analytics) */}
        <Text style={styles.secLabel}>Sync</Text>
        {user ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Drive Sync</Text>
            <View style={styles.profileRow}>
              <View style={styles.profileAvi}>
                <Ionicons name="person-outline" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>{user?.name || 'User'}</Text>
                <Text style={styles.profileEmail}>{user?.email || ''}</Text>
              </View>
              <Ionicons
                name={(syncError || needsReconnect) ? 'cloud-offline-outline' : 'cloud-done-outline'}
                size={18}
                color={syncError ? colors.expense : needsReconnect ? colors.orange : colors.income}
              />
            </View>
            {needsReconnect ? (
              <Text style={[styles.syncNote, { color: colors.orange }]}>
                Sync is paused: Google needs you to reconnect. Your changes are saved on this device and will upload as soon as you do.
              </Text>
            ) : syncError ? (
              <Text style={[styles.syncNote, { color: colors.expense }]}>
                ⚠️ Last sync failed: {syncError}
              </Text>
            ) : driveEmpty ? (
              <Text style={styles.syncNote}>
                No Monei data was found in this Google account's Drive yet. If your phone already has data, make sure you signed in with the same Google account. Anything you add here will be saved to Drive.
              </Text>
            ) : (
              <Text style={styles.syncNote}>
                Syncs with your other devices through FinanceApp/finance-data.json on your Google Drive.
                {lastSyncedAt ? ` Last synced ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : ''}
              </Text>
            )}
            <TouchableOpacity
              style={styles.pushBtn}
              onPress={needsReconnect ? reconnect : manualSync}
              disabled={syncing || signingIn}
              activeOpacity={0.8}
            >
              <Ionicons
                name={needsReconnect ? 'logo-google' : syncing ? 'sync' : 'sync-outline'}
                size={16}
                color={colors.bg}
                style={syncing && { opacity: 0.7 }}
              />
              <Text style={styles.pushBtnTxt}>
                {needsReconnect ? (signingIn ? 'Connecting…' : 'Reconnect to Google') : syncing ? 'Syncing…' : 'Sync now'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Drive Sync</Text>
            <View style={styles.profileRow}>
              <View style={styles.profileAvi}>
                <Ionicons name="phone-portrait-outline" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>Not signed in</Text>
                <Text style={styles.profileEmail}>Data is stored on this device only</Text>
              </View>
              <Ionicons name="cloud-offline-outline" size={18} color={colors.muted} />
            </View>
            <Text style={styles.syncNote}>
              Sign in with Google to back up your data to your own Drive. Anything you've entered so far will be kept.
            </Text>
            <TouchableOpacity
              style={[styles.pushBtn, signingIn && { opacity: 0.7 }]}
              onPress={signIn}
              disabled={signingIn}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-google" size={16} color={colors.bg} />
              <Text style={styles.pushBtnTxt}>{signingIn ? 'Signing in…' : 'Sign in with Google'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {user && (
          <TouchableOpacity style={styles.signOutBtn} onPress={() => setConfirmSignOut(true)} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={18} color={colors.expense} />
            <Text style={styles.signOutTxt}>Sign Out</Text>
          </TouchableOpacity>
        )}

        {/* About */}
        <Text style={styles.about}>Monei · v{appConfig.expo.version}</Text>

        <View style={{ height: 30 }} />
      </ScrollView>

      <MonthStartModal visible={showStartDay} onClose={() => setShowStartDay(false)} />

      <CurrencyPicker
        visible={currencyOpen}
        onClose={() => setCurrencyOpen(false)}
        selected={currencyCode}
        title="Your currency"
        onSelect={code => {
          setCurrencyOpen(false);
          if (code !== currencyCode) setPendingCurrency(code);
        }}
      />

      <ConfirmDialog
        visible={!!pendingCurrency}
        icon="cash-outline"
        title={pendingCurrency ? `Switch to ${findCurrency(pendingCurrency)?.name}?` : ''}
        message={'Amounts you already entered keep their numbers and will be shown in the new currency. They are not converted.'}
        confirmText="Switch"
        onConfirm={async () => {
          const code = pendingCurrency;
          setPendingCurrency(null);
          await setCurrency(code);
          showToast({ text: `Currency changed to ${findCurrency(code)?.name}` });
        }}
        onCancel={() => setPendingCurrency(null)}
      />

      <ConfirmDialog
        visible={confirmSignOut}
        icon="log-out-outline"
        title="Sign out?"
        message={'Your data will remain on Google Drive.\nLocal data on this device will be cleared.'}
        confirmText="Sign Out"
        onConfirm={() => { setConfirmSignOut(false); signOut(); }}
        onCancel={() => setConfirmSignOut(false)}
      />

      <Overlays />
    </View>
  );
}

const useStyles = createStyles((colors, typography) => ({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20 },
  appearanceCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 12, marginBottom: 18 },
  appearanceNote: { ...typography.caption, lineHeight: 18, marginTop: 10, marginHorizontal: 4 },
  privacy: { ...typography.caption, lineHeight: 18, marginTop: -8, marginBottom: 18 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { marginRight: 12 },
  title: { ...typography.h2, flex: 1 },

  secLabel: { ...typography.tiny, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8, marginTop: 6 },

  listCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.xl, paddingHorizontal: 14, marginBottom: 18,
  },
  navRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  navIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  navLabel: { ...typography.bodyMed },
  navSub: { ...typography.caption, marginTop: 2 },

  card: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.xl, padding: 16, marginBottom: 14,
  },
  cardTitle: { ...typography.h4, marginBottom: 12 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  profileAvi: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: colors.accentDim,
    alignItems: 'center', justifyContent: 'center',
  },
  profileName: { ...typography.bodyMed },
  profileEmail: { ...typography.caption, marginTop: 2 },
  syncNote: { ...typography.caption, lineHeight: 18, marginBottom: 12 },
  pushBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 12,
  },
  pushBtnTxt: { fontSize: 13, fontWeight: '700', color: colors.bg },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, backgroundColor: colors.expenseDim, borderWidth: 1,
    borderColor: colors.expense + '33', borderRadius: radius.lg, marginTop: 2,
  },
  signOutTxt: { fontSize: 14, fontWeight: '700', color: colors.expense },

  about: { ...typography.caption, textAlign: 'center', marginTop: 24 },
}));
