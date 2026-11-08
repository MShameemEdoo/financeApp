import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { radius, useTheme, createStyles, useLayout } from '../theme';
import { useApp } from '../context/AppContext';
import { formatCurrency, isNameTaken, normalizeName } from '../utils/formatters';
import ConfirmDialog from '../components/ConfirmDialog';
import * as Haptics from 'expo-haptics';

const ACCOUNT_TYPES = [
  { id: 'bank',   label: 'Bank Account', icon: '🏦' },
  { id: 'cash',   label: 'Cash',         icon: '💵' },
  { id: 'wallet', label: 'Mobile Wallet',icon: '📱' },
  { id: 'savings',label: 'Savings',      icon: '🏧' },
  { id: 'credit', label: 'Credit Card',  icon: '💳' },
  { id: 'other',  label: 'Other',        icon: '🗂️' },
];

const ACCOUNT_COLORS = ['#5B8DEF','#4FE3A0','#B5FF4D','#FF5C5C','#9370DB','#FFA500','#FF69B4','#64B5F6'];

export default function AccountsScreen({ navigation }) {
  const styles = useStyles();
  const { dialog } = useLayout();
  const { colors, isDark } = useTheme();
  const { data, addAccount, updateAccount, deleteAccount, getAccountBalance, currency } = useApp();
  const insets = useSafeAreaInsets();

  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId]   = useState(null);   // null = creating a new account
  const [newStart, setNewStart] = useState('');   // optional starting amount
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('bank');
  const [newColor, setNewColor] = useState(ACCOUNT_COLORS[0]);
  const [newIcon, setNewIcon] = useState('🏦');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [nameError, setNameError] = useState(null);   // null | message

  function resetForm() {
    setEditId(null);
    setNewName('');
    setNewType('bank');
    setNewColor(ACCOUNT_COLORS[0]);
    setNewIcon('🏦');
    setNewStart('');
    setNameError(null);
  }

  function openAdd() {
    resetForm();
    setShowAdd(true);
  }

  function openEdit(a) {
    setEditId(a.id);
    setNewName(a.name);
    setNewType(a.type);
    setNewIcon(a.icon);
    setNewColor(a.color);
    setNewStart(a.startingBalance ? String(a.startingBalance) : '');
    setNameError(null);
    setShowAdd(true);
  }

  function closeModal() {
    setShowAdd(false);
    resetForm();
  }

  async function handleSave() {
    if (!newName.trim()) {
      setNameError('Account name is required');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    // Names must be unique. When editing, only check if the name was changed
    // (so older data that already has duplicates can still be edited).
    const original = editId ? data.accounts.find(a => a.id === editId) : null;
    const nameChanged = !original || normalizeName(original.name) !== normalizeName(newName);
    if (nameChanged && isNameTaken(data.accounts, newName, editId)) {
      setNameError('An account with this name already exists');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    // Starting amount is optional — blank means 0
    const startingBalance = parseFloat(newStart) || 0;
    const fields = { name: newName.trim(), type: newType, icon: newIcon, color: newColor, startingBalance };
    setSaving(true);
    try {
      if (editId) await updateAccount(editId, fields);
      else        await addAccount(fields);
      closeModal();
    } catch (e) {
      if (e?.code === 'DUPLICATE_NAME') setNameError('An account with this name already exists');
      else throw e;
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(account) {
    setDeleteTarget(account);
  }

  function pickType(t) {
    setNewType(t.id);
    setNewIcon(t.icon);
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Accounts</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd} accessibilityRole="button" accessibilityLabel="Add account">
          <Ionicons name="add" size={20} color={colors.bg} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Total across all accounts */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total across all accounts</Text>
          <Text style={styles.totalAmt}>
            {formatCurrency(
              data.accounts.reduce((s, a) => s + getAccountBalance(a.id), 0),
              currency
            )}
          </Text>
        </View>

        {/* Account cards */}
        {data.accounts.map(a => {
          const bal = getAccountBalance(a.id);
          const typeLabel = ACCOUNT_TYPES.find(t => t.id === a.type)?.label || a.type;
          return (
            <TouchableOpacity key={a.id} style={styles.acctCard} onPress={() => openEdit(a)} activeOpacity={0.8}>
              <View style={[styles.acctIconWrap, { backgroundColor: a.color + '22' }]}>
                <Text style={styles.acctIconEmoji}>{a.icon}</Text>
              </View>
              <View style={styles.acctInfo}>
                <Text style={styles.acctName}>{a.name}</Text>
                <Text style={styles.acctType}>
                  {typeLabel}{a.startingBalance ? ` · Started with ${formatCurrency(a.startingBalance, currency)}` : ''}
                </Text>
              </View>
              <View style={styles.acctRight}>
                <Text style={[styles.acctBal, { color: bal >= 0 ? colors.income : colors.expense }]}>
                  {bal < 0 ? '−' : ''}{formatCurrency(Math.abs(bal), currency)}
                </Text>
                <TouchableOpacity onPress={() => setDeleteTarget(a)} style={styles.deleteBtn}>
                  <Ionicons name="trash-outline" size={16} color={colors.expense} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}

        {data.accounts.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🏦</Text>
            <Text style={styles.emptyText}>No accounts yet{'\n'}Tap + to add one</Text>
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      <ConfirmDialog
        visible={!!deleteTarget}
        icon="trash-outline"
        title={deleteTarget ? `Delete "${deleteTarget.name}"?` : ''}
        message={deleteTarget ? `This won't delete its transactions.
Balance: ${formatCurrency(Math.abs(getAccountBalance(deleteTarget.id)), currency)}` : ''}
        confirmText="Delete"
        onConfirm={() => { deleteAccount(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Add Account Modal */}
      <Modal visible={showAdd} transparent animationType={dialog.animation} onRequestClose={closeModal}>
        <KeyboardAvoidingView style={[styles.modalOverlay, dialog.overlay]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom + 16, 32), maxHeight: '92%' }, dialog.card]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editId ? 'Edit Account' : 'New Account'}</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Name input */}
            <Text style={styles.fieldLabel}>Account name</Text>
            <TextInput
              style={[styles.nameInput, nameError && { borderColor: colors.expense, borderWidth: 1.5 }]}
              placeholder="e.g. Bank MCB, Cash, Savings..."
              placeholderTextColor={colors.muted}
              value={newName}
              onChangeText={t => { setNewName(t); if (nameError) setNameError(null); }}
              maxLength={40}
              autoFocus={!editId}
            />
            {!!nameError && <Text style={styles.errText}>{nameError}</Text>}

            {/* Type picker */}
            <Text style={styles.fieldLabel}>Account type</Text>
            <View style={styles.typeGrid}>
              {ACCOUNT_TYPES.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.typeChip, newType === t.id && styles.typeChipOn]}
                  onPress={() => pickType(t)}
                >
                  <Text style={styles.typeEmoji}>{t.icon}</Text>
                  <Text style={[styles.typeLabel, newType === t.id && { color: colors.accent }]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Color picker */}
            <Text style={styles.fieldLabel}>Color</Text>
            <View style={styles.colorRow}>
              {ACCOUNT_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }, newColor === c && styles.colorDotOn]}
                  onPress={() => setNewColor(c)}
                >
                  {newColor === c && <Ionicons name="checkmark" size={14} color="#000" />}
                </TouchableOpacity>
              ))}
            </View>

            {/* Starting amount (optional) */}
            <Text style={styles.fieldLabel}>Starting amount <Text style={styles.optionalTag}>· optional</Text></Text>
            <View style={styles.startInput}>
              <Text style={styles.startCurr}>{currency}</Text>
              <TextInput
                style={styles.startField}
                value={newStart}
                onChangeText={t => {
                  // digits and a single decimal point only
                  const cleaned = t.replace(/[^0-9.]/g, '');
                  const parts = cleaned.split('.');
                  setNewStart(parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned);
                }}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.muted}
                maxLength={12}
              />
            </View>
            <Text style={styles.startHint}>The balance this account already has today. It isn't counted as income.</Text>

            {/* Save */}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveTxt}>{saving ? 'Saving…' : editId ? 'Save changes' : 'Add Account'}</Text>
            </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const useStyles = createStyles((colors, typography) => ({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  backBtn: { marginRight: 12 },
  title: { ...typography.h2, flex: 1 },
  addBtn: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },

  totalCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.xl, padding: 20, marginBottom: 16,
    alignItems: 'center',
  },
  totalLabel: { ...typography.caption, textTransform: 'uppercase', letterSpacing: 0.7 },
  totalAmt: { fontSize: 32, fontWeight: '700', color: colors.text, letterSpacing: -1, marginTop: 6 },

  acctCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: 16, marginBottom: 10,
  },
  acctIconWrap: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  acctIconEmoji: { fontSize: 22 },
  acctInfo: { flex: 1 },
  acctName: { ...typography.bodyMed },
  acctType: { ...typography.caption, marginTop: 2, textTransform: 'capitalize' },
  acctRight: { alignItems: 'flex-end', gap: 6 },
  acctBal: { fontSize: 15, fontWeight: '700' },
  deleteBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: colors.expenseDim,
    alignItems: 'center', justifyContent: 'center',
  },

  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyIcon: { fontSize: 36 },
  emptyText: { ...typography.body, color: colors.muted, textAlign: 'center', lineHeight: 22 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1, borderTopColor: colors.border,
    padding: 24,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { ...typography.h3 },

  fieldLabel: {
    fontSize: 10, fontWeight: '600', color: colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10,
  },
  nameInput: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: colors.text, marginBottom: 18,
  },
  errText: { fontSize: 11, fontWeight: '600', color: colors.expense, marginTop: -12, marginBottom: 16 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  typeChipOn: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  typeEmoji: { fontSize: 13 },
  typeLabel: { fontSize: 12, fontWeight: '600', color: colors.muted },

  colorRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  optionalTag: { fontWeight: '500', textTransform: 'none', letterSpacing: 0 },
  startInput: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 4,
  },
  startCurr: { fontSize: 15, fontWeight: '700', color: colors.muted },
  startField: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text, paddingVertical: 10 },
  startHint: { fontSize: 11, color: colors.muted, marginTop: 6, marginBottom: 20 },
  colorDot: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  colorDotOn: { borderWidth: 3, borderColor: colors.text },

  saveBtn: {
    backgroundColor: colors.accent, borderRadius: radius.lg,
    paddingVertical: 15, alignItems: 'center',
  },
  saveTxt: { fontSize: 15, fontWeight: '700', color: colors.bg },
}));
