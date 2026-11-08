import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, useTheme, createStyles, useLayout } from '../theme';
import { showAlert } from '../utils/alert';
import { useApp } from '../context/AppContext';
import { formatCurrency, isNameTaken, normalizeName, daysBetweenISO, todayISO } from '../utils/formatters';
import Overlays from '../components/Overlays';
import MonthSwitcher from '../components/MonthSwitcher';
import ConfirmDialog from '../components/ConfirmDialog';

export default function BudgetScreen() {
  const styles = useStyles();
  const { dialog } = useLayout();
  const { colors, isDark, readable } = useTheme();
  const {
    data, categories, catSpending, totalExpenses, currency,
    updateBudget, addBudget, deleteBudget,
    isCurrentMonth, periodLabel, periodWord, periodEnd,
  } = useApp();
  const insets = useSafeAreaInsets();

  const [editModal, setEditModal]       = useState(null);
  const [addModal, setAddModal]         = useState(false);
  const [newLimit, setNewLimit]         = useState('');
  const [newCatId, setNewCatId]         = useState(null);
  const [customName, setCustomName]     = useState('');
  const [nameError, setNameError]       = useState(null);   // null | message
  const [deleteTarget, setDeleteTarget] = useState(null);

  const totalBudget = useMemo(() =>
    data.budgets.reduce((s, b) => s + b.limit, 0), [data.budgets]);

  const overallPct = totalBudget > 0 ? Math.min((totalExpenses / totalBudget) * 100, 100) : 0;

  function openEdit(b) {
    setNewLimit(String(b.limit));
    setCustomName(b.catName || b.customName || '');
    setNameError(null);
    setEditModal(b);
  }

  function closeAdd() {
    setAddModal(false);
    setNewLimit('');
    setNewCatId(null);
    setCustomName('');
    setNameError(null);
  }

  async function handleSaveLimit() {
    const val = parseFloat(newLimit);
    if (!val || val <= 0) { showAlert('Invalid', 'Enter a valid limit.'); return; }
    const trimmed = customName.trim();
    if (!trimmed) { setNameError('Name is required'); return; }
    // Unique names — only checked when the name was actually changed
    const nameChanged = normalizeName(editModal.catName) !== normalizeName(trimmed);
    if (nameChanged && isNameTaken(enriched, trimmed, editModal.id, b => b.catName)) {
      setNameError('A budget with this name already exists');
      return;
    }
    try {
      await updateBudget(editModal.id, val, trimmed);
      setEditModal(null);
    } catch (e) {
      if (e?.code === 'DUPLICATE_NAME') setNameError('A budget with this name already exists');
      else throw e;
    }
  }

  async function handleAddBudget() {
    const val = parseFloat(newLimit);
    const trimmed = customName.trim();
    if (!newCatId) { showAlert('Select a category'); return; }
    if (!trimmed) { setNameError('Name is required'); return; }
    if (isNameTaken(enriched, trimmed, null, b => b.catName)) {
      setNameError('A budget with this name already exists');
      return;
    }
    if (!val || val <= 0) { showAlert('Invalid limit'); return; }
    const cat = categories.find(c => c.id === newCatId);
    try {
      await addBudget({
        category: newCatId,
        icon: cat?.icon || '💰',
        limit: val,
        color: cat?.color || colors.accent,
        customName: trimmed,
      });
      closeAdd();
    } catch (e) {
      if (e?.code === 'DUPLICATE_NAME') setNameError('A budget with this name already exists');
      else throw e;
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteBudget(deleteTarget.id);
    setDeleteTarget(null);
  }

  const enriched = useMemo(() => data.budgets.map(b => {
    const spent = catSpending[b.category] || 0;
    const pct   = b.limit > 0 ? Math.min((spent / b.limit) * 100, 100) : 0;
    const cat   = categories.find(c => c.id === b.category);
    return { ...b, spent, pct, catName: b.customName || cat?.name || b.category };
  }), [data.budgets, catSpending, categories]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Budgets</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setAddModal(true)} accessibilityRole="button" accessibilityLabel="Add budget">
            <Ionicons name="add" size={18} color={colors.bg} />
          </TouchableOpacity>
        </View>

        <MonthSwitcher />
        {!isCurrentMonth && (
          <Text style={styles.limitNote}>Budget limits are the same every {periodWord}, so past {periodWord}s are compared against today's limits.</Text>
        )}

        <View style={styles.overviewCard}>
          <LinearGradient
            colors={[colors.income + '14', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
          <Text style={styles.overviewMonth}>{periodLabel}</Text>
          <View style={styles.overviewAmts}>
            <Text style={styles.overviewSpent}>{formatCurrency(totalExpenses, currency)}</Text>
            <Text style={styles.overviewOf}> / {formatCurrency(totalBudget, currency)}</Text>
          </View>
          <Text style={styles.overviewSub}>
            {formatCurrency(Math.max(totalBudget - totalExpenses, 0), currency)} remaining
            {' · '}{Math.round(overallPct)}% used
          </Text>
          {isCurrentMonth && totalBudget > 0 && (() => {
            // What you can still spend per day until this period ends
            const daysLeft = Math.max(daysBetweenISO(todayISO(), periodEnd) + 1, 1);
            const left = totalBudget - totalExpenses;
            return left > 0 ? (
              <Text style={styles.allowance}>
                About {formatCurrency(Math.floor(left / daysLeft), currency)} a day for the next {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
              </Text>
            ) : (
              <Text style={[styles.allowance, { color: colors.expense }]}>
                Over budget by {formatCurrency(-left, currency)}
              </Text>
            );
          })()}
          <View style={styles.progressBg}>
            <LinearGradient
              colors={[colors.income, colors.accent]}
              style={[styles.progressFill, { width: `${overallPct}%` }]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            />
          </View>
        </View>

        <Text style={styles.secLabel}>By Category</Text>

        {enriched.map(b => {
          const isOver   = b.pct >= 100;
          const isWarn   = b.pct >= 75 && b.pct < 100;
          const barColor = isOver ? colors.expense : isWarn ? colors.orange : b.color;

          return (
            <TouchableOpacity
              key={b.id}
              style={styles.catCard}
              onPress={() => openEdit(b)}
              activeOpacity={0.8}
            >
              <View style={styles.catCardTop}>
                <View style={[styles.catIcon, { backgroundColor: `${barColor}1A` }]}>
                  <Text style={styles.catEmoji}>{b.icon}</Text>
                </View>
                <View style={styles.catInfo}>
                  <Text style={styles.catName}>{b.catName}</Text>
                </View>
                <View style={styles.catAmts}>
                  <Text style={styles.catSpent}>{formatCurrency(b.spent, currency)}</Text>
                  <Text style={styles.catLimit}>of {formatCurrency(b.limit, currency)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => setDeleteTarget(b)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={15} color={colors.expense} />
                </TouchableOpacity>
              </View>

              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${b.pct}%`, backgroundColor: barColor }]} />
              </View>

              <View style={styles.catCardBot}>
                {isOver && (
                  <Text style={[styles.metaText, { color: colors.expense }]}>
                    ⚠️ Over by {formatCurrency(b.spent - b.limit, currency)}
                  </Text>
                )}
                {isWarn && !isOver && (
                  <Text style={[styles.metaText, { color: colors.orange }]}>
                    Getting close · {Math.round(b.pct)}% used
                  </Text>
                )}
                {!isWarn && !isOver && (
                  <Text style={styles.metaText}>
                    {formatCurrency(b.limit - b.spent, currency)} left · {Math.round(b.pct)}% used
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 20 }} />
      </ScrollView>

      <Overlays fab />

      {/* Edit modal */}
      <Modal visible={!!editModal} transparent animationType={dialog.animation} onRequestClose={() => setEditModal(null)}>
        <KeyboardAvoidingView style={[styles.modalOverlay, dialog.overlay]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalCard, { maxHeight: '92%' }, dialog.card]}>
            <Text style={styles.modalTitle}>Edit Budget</Text>
            <Text style={styles.modalSub}>{editModal?.catName}</Text>

            <Text style={styles.inputLabel}>Budget Name</Text>
            <View style={[styles.modalInput, nameError && styles.inputError]}>
              <TextInput
                style={[styles.modalInputText, { fontSize: 15 }]}
                value={customName}
                onChangeText={v => { setCustomName(v); if (nameError) setNameError(null); }}
                placeholder="e.g. Monthly Groceries"
                placeholderTextColor={colors.muted}
                maxLength={40}
              />
            </View>
            {!!nameError && <Text style={styles.errorText}>{nameError}</Text>}

            <Text style={[styles.inputLabel, { marginTop: 12 }]}>Monthly Limit</Text>
            <View style={styles.modalInput}>
              <Text style={styles.modalCurr}>{currency}</Text>
              <TextInput
                style={styles.modalInputText}
                value={newLimit}
                onChangeText={setNewLimit}
                keyboardType="numeric"
                autoFocus
                selectTextOnFocus
              />
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setEditModal(null)}>
                <Text style={styles.modalCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleSaveLimit}>
                <Text style={styles.modalSaveTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add modal */}
      <Modal visible={addModal} transparent animationType={dialog.animation} onRequestClose={closeAdd}>
        <KeyboardAvoidingView style={[styles.modalOverlay, dialog.overlay]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalCard, { maxHeight: '92%' }, dialog.card]}>
            <Text style={styles.modalTitle}>Add Budget</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            <Text style={styles.inputLabel}>Category</Text>
            <View style={styles.catGrid}>
              {categories.filter(c => c.type !== 'income').map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.modalCatChip, newCatId === c.id && { borderColor: c.color, backgroundColor: `${c.color}1A` }]}
                  onPress={() => setNewCatId(c.id)}
                  activeOpacity={0.8}
                >
                  <Text>{c.icon}</Text>
                  <Text style={[styles.modalCatLabel, newCatId === c.id && { color: readable(c.color) }]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Budget Name</Text>
            <View style={[styles.modalInput, nameError && styles.inputError]}>
              <TextInput
                style={[styles.modalInputText, { fontSize: 15 }]}
                value={customName}
                onChangeText={v => { setCustomName(v); if (nameError) setNameError(null); }}
                placeholder="e.g. Weekly Groceries"
                placeholderTextColor={colors.muted}
                maxLength={40}
              />
            </View>
            {!!nameError && <Text style={styles.errorText}>{nameError}</Text>}

            <Text style={[styles.inputLabel, { marginTop: 12 }]}>Monthly Limit</Text>
            <View style={styles.modalInput}>
              <Text style={styles.modalCurr}>{currency}</Text>
              <TextInput
                style={styles.modalInputText}
                value={newLimit}
                onChangeText={setNewLimit}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.muted}
              />
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={closeAdd}>
                <Text style={styles.modalCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleAddBudget}>
                <Text style={styles.modalSaveTxt}>Add</Text>
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        visible={!!deleteTarget}
        title="Delete Budget"
        message={`Delete "${deleteTarget?.catName}" budget? This won't affect your transactions.`}
        icon="trash"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </View>
  );
}

const useStyles = createStyles((colors, typography) => ({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 96 },
  allowance: { fontSize: 13.5, fontWeight: '700', color: colors.accent, marginTop: -6, marginBottom: 14 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  title: { ...typography.h2 },
  addBtn: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },

  overviewCard: {
    borderRadius: radius.xl, borderWidth: 1,
    borderColor: colors.income + '26',
    backgroundColor: colors.incomeSurface,
    padding: 20, marginBottom: 22, overflow: 'hidden',
  },
  overviewMonth: { fontSize: 11, fontWeight: '600', color: colors.income + 'B3', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  overviewAmts: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 },
  overviewSpent: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.8 },
  overviewOf: { fontSize: 15, fontWeight: '400', color: colors.muted },
  overviewSub: { ...typography.caption, marginBottom: 14 },

  progressBg: { backgroundColor: colors.track, borderRadius: 5, height: 7, overflow: 'hidden', marginBottom: 5 },
  progressFill: { height: '100%', borderRadius: 5 },

  limitNote: { ...typography.caption, marginTop: -6, marginBottom: 12, lineHeight: 17 },
  secLabel: { ...typography.tiny, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12 },

  catCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: 15, marginBottom: 10,
  },
  catCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  catIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  catEmoji: { fontSize: 16 },
  catInfo: { flex: 1 },
  catName: { ...typography.bodyMed },
  catAmts: { alignItems: 'flex-end' },
  catSpent: { fontSize: 14, fontWeight: '700', color: colors.text },
  catLimit: { ...typography.tiny, marginTop: 1 },
  catCardBot: { marginTop: 5 },
  metaText: { ...typography.tiny, textAlign: 'right' },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: colors.expenseDim,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 4,
  },

  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  modalTitle: { ...typography.h3, marginBottom: 4 },
  modalSub: { ...typography.caption, marginBottom: 16 },
  inputLabel: { fontSize: 11, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  modalInput: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 4,
  },
  inputError: { borderColor: colors.expense },
  errorText: { fontSize: 11, color: colors.expense, marginBottom: 4, marginLeft: 2 },
  modalCurr: { fontSize: 16, fontWeight: '700', color: colors.muted },
  modalInputText: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.text },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancel: { flex: 1, padding: 14, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  modalCancelTxt: { fontSize: 14, fontWeight: '700', color: colors.muted },
  modalSave: { flex: 1, padding: 14, backgroundColor: colors.accent, borderRadius: radius.md, alignItems: 'center' },
  modalSaveTxt: { fontSize: 14, fontWeight: '700', color: colors.bg },
  modalCatChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  modalCatLabel: { fontSize: 12, fontWeight: '600', color: colors.muted },
})); 