import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, createStyles } from '../theme';
import { useApp } from '../context/AppContext';

// Shown on every screen, only while Google needs a click to renew access.
// (On the web, access lasts about an hour; nothing is lost while it is paused.)
export default function SyncBanner() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user, needsReconnect, reconnect, signingIn } = useApp();
  if (!user || !needsReconnect) return null;
  return (
    <View style={styles.bar} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={16} color={colors.orange} />
      <Text style={styles.txt} numberOfLines={2}>Sync is paused. Your changes are saved here and will upload once you reconnect.</Text>
      <TouchableOpacity style={styles.btn} onPress={reconnect} disabled={signingIn} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Reconnect to Google">
        <Text style={styles.btnTxt}>{signingIn ? 'Connecting…' : 'Reconnect'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.orange + '1F', borderBottomWidth: 1, borderBottomColor: colors.orange + '55' },
  txt: { flex: 1, fontSize: 12.5, color: colors.text, lineHeight: 17 },
  btn: { paddingHorizontal: 14, minHeight: 32, borderRadius: 10, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { fontSize: 12.5, fontWeight: '800', color: '#1a1a1a' },
}));
