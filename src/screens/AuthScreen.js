import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, Image 
} from 'react-native';
import { Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, useTheme, createStyles } from '../theme';
import { useApp } from '../context/AppContext';


export default function AuthScreen() {
  const styles = useStyles();
  const { colors, isDark } = useTheme();
  const { signIn, signingIn, skipAuth, googleAvailable } = useApp();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />

      <LinearGradient
        colors={[colors.accent + '10', 'transparent']}
        style={styles.glow}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Close — sign-in is optional */}
      <TouchableOpacity
        style={[styles.closeBtn, { top: insets.top + 12 }]}
        onPress={skipAuth}
        disabled={signingIn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Close and continue without signing in"
      >
        <Ionicons name="close" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Image
              source={require('../../assets/monei_Icon2.png')}
              style={styles.logoIcon}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.appName}>Monei</Text>
          <Text style={styles.tagline}>Your money, clearly.</Text>
        </View>

        <View style={styles.features}>
          {[
            { icon: 'cloud-done-outline',       label: Platform.OS === 'web' ? 'Synced with your phone through Google Drive' : 'Synced to Google Drive' },
            { icon: 'bar-chart-outline',         label: 'Smart analytics & insights' },
            { icon: 'shield-checkmark-outline',  label: 'Your data, only on your Drive' },
          ].map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon} size={16} color={colors.accent} />
              </View>
              <Text style={styles.featureText}>{f.label}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.signInBtn, signingIn && { opacity: 0.7 }]}
          onPress={signIn}
          activeOpacity={0.85}
          disabled={signingIn}
        >
          {signingIn ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color={colors.bg} />
              <Text style={styles.signInText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipBtn} onPress={skipAuth} disabled={signingIn} activeOpacity={0.7}>
          <Text style={styles.skipText}>Continue without signing in</Text>
        </TouchableOpacity>

        {!googleAvailable && (
          <Text style={[styles.disclaimer, { color: colors.orange }]}>
            Google sign-in isn't available in Expo Go — tap "Continue without signing in".
          </Text>
        )}

        <Text style={styles.disclaimer}>
          Signing in is optional. Without it your data stays on{'\n'}this device only — you can sign in any time from Settings.
        </Text>
      </View>
    </View>
  );
}
const iconsize = 180;
const useStyles = createStyles((colors, typography) => ({
  root:       { flex: 1, backgroundColor: colors.bg },
  closeBtn: {
    position: 'absolute', top: 12, right: 20, zIndex: 10,
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  skipBtn:    { alignItems: 'center', paddingVertical: 4, marginTop: -20 },
  skipText:   { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  glow:       { position: 'absolute', top: 0, left: 0, right: 0, height: 300 },
  content:    { flex: 1, paddingHorizontal: 28, justifyContent: 'center', gap: 40 },
  logoWrap: {alignItems: 'center',gap: 12,},

logoCircle: {
  width: 88,
  height: 88,
  borderRadius: 28,
  // backgroundColor: colors.accentDim,
  borderWidth: 1,
  // borderColor: 'rgba(181,255,77,0.25)',
  alignItems: 'center',
  justifyContent: 'center',
},

logoIcon: {
  width: iconsize,
  height: iconsize,
  borderRadius: 20,
},
  appName:     { fontSize: 32, fontWeight: '700', color: colors.text, letterSpacing: -0.8 },
  tagline:     { ...typography.body, color: colors.muted },
  features:    { gap: 14 },
  featureRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.accentDim,
    alignItems: 'center', justifyContent: 'center',
  },
  featureText: { ...typography.bodyMed, color: colors.textSecondary },
  signInBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  signInText:  { fontSize: 15, fontWeight: '700', color: colors.bg },
  disclaimer:  { ...typography.caption, textAlign: 'center', lineHeight: 18, color: colors.muted },
}));
