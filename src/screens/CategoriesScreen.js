import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { radius, CATEGORY_COLORS, CATEGORY_ICONS, GENERAL_CATEGORY_ID, useTheme, createStyles, useLayout } from '../theme';
import { useApp } from '../context/AppContext';
import { isNameTaken } from '../utils/formatters';
import ConfirmDialog from '../components/ConfirmDialog';

const NAME_MAX = 24;

export default function CategoriesScreen({ navigation }) {
  const styles = useStyles();
  const { dialog } = useLayout();
  const { colors, isDark } = useTheme();
  const { data, categories, addCategory, updateCategory, deleteCategory } = useApp();
  const insets = useSafeAreaInsets();

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId]       = useState(null);       // null = creating
  const [name, setName]           = useState('');
  const [icon, setIcon]           = useState(CATEGORY_ICONS[0]);
  const [color, setColor]         = useState(CATEGORY_COLORS[0]);
  const [type, setType]           = useState('expense');
  const [nameError, setNameError] = useState(null);       // null | string
  const [saving, setSaving]       = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const isGeneral = editId === GENERAL_CATEGORY_ID;

  // How many transactions use each category (transfers have no category)
  const usage = useMemo(() => {
    const map = {};
    data.transactions.forEach(t => {
      if (t.type !== 'transfer') map[t.category] = (map[t.category] || 0) + 1;
    });
    return map;
  }, [data.transactions]);

  const sections = [
    { key: 'expense', title: 'Expense categories', items: categories.filter(c => c.type === 'expense') },
    { key: 'income',  title: 'Income categories',  items: categories.filter(c => c.type === 'income') },
    { key: 'both',    title: 'Default',            items: categories.filter(c => c.type === 'both') },
  ].filter(s => s.items.length > 0);

  function openAdd() {
    setEditId(null);
    setName('');
    setIcon(CATEGORY_ICONS[0]);
    setColor(CATEGORY_COLORS[0]);
    setType('expense');
    setNameError(null);
    setShowModal(true);
  }

  function openEdit(c) {
    setEditId(c.id);
    setName(c.name);
    setIcon(c.icon);
    setColor(c.color);
    setType(c.type);
    setNameError(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Name is required');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    // Case/space-insensitive, so "food" and " Food " clash
    if (isNameTaken(categories, trimmed, editId)) {
      setNameError('A category with this name already exists');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setSaving(true);
    try {
      if (editId) await updateCategory(editId, { name: trimmed, icon, color });
      else        await addCategory({ name: trimmed, icon, color, type });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeModal();
    } catch (e) {
      if (e?.code === 'DUPLICATE_NAME') setNameError('A category with this name already exists');
      else throw e;
    } finally {
      setSaving(false);
    }
  }

  function askDelete() {
    const cat = categories.find(c => c.id === editId);
    if (!cat || cat.id === GENERAL_CATEGORY_ID) return;
    setShowModal(false);
    setDeleteTarget(cat);
  }

  async function confirmDelete() {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (target) await deleteCategory(target.id);
  }

  const deleteCount  = deleteTarget ? (usage[deleteTarget.id] || 0) : 0;
  const deleteBudget = deleteTarget ? data.budgets.some(b => b.category === deleteTarget.id) : false;
  const generalName  = categories.find(c => c.id === GENERAL_CATEGORY_ID)?.name || 'General';

  function deleteMessage() {
    if (!deleteTarget) return '';
    const parts = [];
    if (deleteCount > 0) {
      parts.push(`${deleteCount} transaction${deleteCount === 1 ? '' : 's'} will be moved to ${generalName}.`);
    } else {
      parts.push('No transactions use this category.');
    }
    if (deleteBudget) parts.push(`Its budget will move to ${generalName} too.`);
    return parts.join('\n');
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Categories</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd} accessibilityRole="button" accessibilityLabel="Add category">
          <Ionicons name="add" size={20} color={colors.bg} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {sections.map(sec => (
          <View key={sec.key} style={styles.section}>
            <Text style={styles.secLabel}>{sec.title}</Text>
            <View style={styles.listCard}>
              {sec.items.map((c, i) => {
                const n = usage[c.id] || 0;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.row, i === sec.items.length - 1 && { borderBottomWidth: 0 }]}
                    onPress={() => openEdit(c)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.iconWrap, { backgroundColor: c.color + '22' }]}>
                      <Text style={styles.iconEmoji}>{c.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName}>{c.name}</Text>
                      <Text style={styles.rowSub}>
                        {n} transaction{n === 1 ? '' : 's'}
                        {c.id === GENERAL_CATEGORY_ID ? ' · Can\'t be deleted' : ''}
                      </Text>
                    </View>
                    <View style={[styles.colorDotSmall, { backgroundColor: c.color }]} />
                    {c.id === GENERAL_CATEGORY_ID
                      ? <Ionicons name="lock-closed-outline" size={14} color={colors.muted} />
                      : <Ionicons name="chevron-forward" size={16} color={colors.muted} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        <Text style={styles.footNote}>
          Deleting a category moves its transactions to {generalName}.
        </Text>
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Create / edit modal */}
      <Modal visible={showModal} transparent animationType={dialog.animation} onRequestClose={closeModal}>
        <KeyboardAvoidingView style={[styles.modalOverlay, dialog.overlay]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom + 16, 28) }, dialog.card]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editId ? 'Edit Category' : 'New Category'}</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Preview */}
              <View style={styles.previewWrap}>
                <View style={[styles.previewIcon, { backgroundColor: color + '22', borderColor: color }]}>
                  <Text style={{ fontSize: 30 }}>{icon}</Text>
                </View>
              </View>

              {/* Name */}
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={[styles.nameInput, nameError && styles.nameInputError]}
                value={name}
                onChangeText={t => { setName(t.slice(0, NAME_MAX)); if (nameError) setNameError(null); }}
                placeholder="e.g. Groceries, Pets, Side hustle…"
                placeholderTextColor={colors.muted}
                maxLength={NAME_MAX}
                autoFocus={!editId}
              />
              {nameError && <Text style={styles.errText}>{nameError}</Text>}

              {/* Type — chosen at creation; fixed afterwards */}
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Type</Text>
              {editId ? (
                <Text style={styles.typeFixed}>
                  {type === 'both' ? 'Used for both income and expenses' : type === 'income' ? 'Income' : 'Expense'}
                  {type !== 'both' ? ' · can\'t be changed after creation' : ''}
                </Text>
              ) : (
                <View style={styles.typeTog}>
                  {['expense', 'income'].map(t => {
                    const on = type === t;
                    const tint = t === 'expense' ? colors.expense : colors.income;
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[styles.typeBtn, on && { backgroundColor: tint + '1A' }]}
                        onPress={() => setType(t)}
                      >
                        <Text style={[styles.typeTxt, on && { color: tint }]}>{t === 'expense' ? 'Expense' : 'Income'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Icon */}
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Icon</Text>
              <View style={styles.iconGrid}>
                {CATEGORY_ICONS.map(ic => (
                  <TouchableOpacity
                    key={ic}
                    style={[styles.iconCell, icon === ic && { borderColor: color, backgroundColor: color + '22' }]}
                    onPress={() => setIcon(ic)}
                  >
                    <Text style={{ fontSize: 20 }}>{ic}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Color */}
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Color</Text>
              <View style={styles.colorRow}>
                {CATEGORY_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotOn]}
                    onPress={() => setColor(c)}
                  >
                    {color === c && <Ionicons name="checkmark" size={14} color="#000" />}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Actions */}
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
                <Text style={styles.saveTxt}>{saving ? 'Saving…' : editId ? 'Save changes' : 'Add Category'}</Text>
              </TouchableOpacity>

              {editId && !isGeneral && (
                <TouchableOpacity style={styles.deleteBtn} onPress={askDelete} activeOpacity={0.8}>
                  <Ionicons name="trash-outline" size={16} color={colors.expense} />
                  <Text style={styles.deleteTxt}>Delete category</Text>
                </TouchableOpacity>
              )}
              {isGeneral && (
                <Text style={styles.lockNote}>
                  🔒 General is the default category. It can be renamed but not deleted.
                </Text>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ConfirmDialog
        visible={!!deleteTarget}
        icon="trash-outline"
        title={deleteTarget ? `Delete "${deleteTarget.name}"?` : ''}
        message={deleteMessage()}
        confirmText="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}

const useStyles = createStyles((colors, typography) => ({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { marginRight: 12 },
  title: { ...typography.h2, flex: 1 },
  addBtn: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },

  section: { marginBottom: 18 },
  secLabel: { ...typography.tiny, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 },
  listCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  iconWrap: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  iconEmoji: { fontSize: 20 },
  rowName: { ...typography.bodyMed },
  rowSub: { ...typography.caption, marginTop: 2 },
  colorDotSmall: { width: 10, height: 10, borderRadius: 5, marginRight: 4 },
  footNote: { ...typography.caption, textAlign: 'center', marginTop: 4, lineHeight: 18 },

  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1, borderTopColor: colors.border, padding: 24, maxHeight: '92%',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle: { ...typography.h3 },

  previewWrap: { alignItems: 'center', marginBottom: 16 },
  previewIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },

  fieldLabel: { fontSize: 10, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 },
  nameInput: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.text,
  },
  nameInputError: { borderColor: colors.expense, borderWidth: 1.5 },
  errText: { fontSize: 11, fontWeight: '600', color: colors.expense, marginTop: 5 },

  typeTog: { flexDirection: 'row', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 4 },
  typeBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
  typeTxt: { fontSize: 13, fontWeight: '700', color: colors.muted },
  typeFixed: { fontSize: 12, color: colors.textSecondary },

  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconCell: {
    width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },

  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  colorDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  colorDotOn: { borderWidth: 3, borderColor: colors.text },

  saveBtn: { backgroundColor: colors.accent, borderRadius: radius.lg, paddingVertical: 15, alignItems: 'center' },
  saveTxt: { fontSize: 15, fontWeight: '700', color: colors.bg },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10,
    paddingVertical: 14, borderRadius: radius.lg, backgroundColor: colors.expenseDim,
    borderWidth: 1, borderColor: colors.expense + '33',
  },
  deleteTxt: { fontSize: 14, fontWeight: '700', color: colors.expense },
  lockNote: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 14, lineHeight: 18 },
}));
