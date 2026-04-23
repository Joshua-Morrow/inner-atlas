/**
 * Relationship Members — add / remove / reassign
 * Route: /relationship-members?id=<relationship_id>
 *
 * Shows current members with remove buttons.
 * For polarizations: shows Side A / Side B assignment.
 * "Add Part" button → part selector modal.
 * Save pinned to bottom → router.back()
 */

import { useCallback, useState } from 'react';
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getDatabase } from '@/lib/database';

// ─── Types ────────────────────────────────────────────────────────────────────

type PartType = 'manager' | 'firefighter' | 'exile' | 'self';

interface RelRow {
  id: string;
  name: string;
  type: 'polarization' | 'alliance' | 'protective' | 'activation_chain';
}

interface MemberRow {
  member_id: string;
  part_id: string | null;
  side: string | null;
  display_name: string | null;
  part_type: PartType | null;
}

interface PartRow {
  id: string;
  display_name: string;
  type: PartType;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<PartType, string> = {
  manager:     '#3B5BA5',
  firefighter: '#C2600A',
  exile:       '#7C3D9B',
  self:        '#B88A00',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function nowIso(): string {
  return new Date().toISOString();
}

function getInitials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => (w[0] ?? '').toUpperCase()).join('');
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RelationshipMembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [rel, setRel]             = useState<RelRow | null>(null);
  const [members, setMembers]     = useState<MemberRow[]>([]);
  const [allParts, setAllParts]   = useState<PartRow[]>([]);
  const [showSelector, setShowSelector] = useState(false);
  const [addingSide, setAddingSide]     = useState<'a' | 'b' | 'member'>('member');
  const [saving, setSaving]             = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      const db = getDatabase();

      db.getFirstAsync<RelRow>(
        `SELECT id, name, type FROM relationships WHERE id = ?`,
        [id],
      ).then((r) => { if (r) setRel(r); }).catch(() => undefined);

      db.getAllAsync<MemberRow>(
        `SELECT rm.id AS member_id, rm.part_id, rm.side,
                COALESCE(p.custom_name, p.name) AS display_name,
                p.type AS part_type
         FROM relationship_members rm
         LEFT JOIN parts p ON p.id = rm.part_id
         WHERE rm.relationship_id = ?
         ORDER BY rm.side ASC, rm.created_at ASC`,
        [id],
      ).then((rows) => setMembers(rows ?? [])).catch(() => undefined);

      db.getAllAsync<PartRow>(
        `SELECT id, COALESCE(custom_name, name) AS display_name, type
         FROM parts ORDER BY created_at ASC`,
        [],
      ).then((rows) => setAllParts(rows)).catch(() => undefined);
    }, [id]),
  );

  const existingPartIds = members.map((m) => m.part_id).filter(Boolean) as string[];

  async function handleRemove(memberId: string) {
    const db = getDatabase();
    await db.runAsync(
      `DELETE FROM relationship_members WHERE id = ?`,
      [memberId],
    ).catch(() => undefined);
    setMembers((prev) => prev.filter((m) => m.member_id !== memberId));
  }

  async function handleAdd(part: PartRow, side: 'a' | 'b' | 'member') {
    if (!id) return;
    const db = getDatabase();
    const newMemberId = generateId();
    const now = nowIso();
    const sideValue: string | null = (() => {
      if (rel?.type === 'polarization' || rel?.type === 'protective') {
        return side === 'a' ? 'a' : 'b';
      }
      if (rel?.type === 'activation_chain') {
        const maxPos = members.reduce((max, m) => {
          const n = parseInt(m.side ?? '0', 10);
          return n > max ? n : max;
        }, 0);
        return String(maxPos + 1);
      }
      return null;
    })();

    await db.runAsync(
      `INSERT INTO relationship_members (id, relationship_id, member_type, part_id, side, created_at)
       VALUES (?, ?, 'part', ?, ?, ?)`,
      [newMemberId, id, part.id, sideValue, now],
    ).catch(() => undefined);

    setMembers((prev) => [
      ...prev,
      {
        member_id: newMemberId,
        part_id: part.id,
        side: sideValue,
        display_name: part.display_name,
        part_type: part.type,
      },
    ]);
    setShowSelector(false);
  }

  async function handleChangeSide(memberId: string, newSide: 'a' | 'b') {
    const db = getDatabase();
    await db.runAsync(
      `UPDATE relationship_members SET side = ? WHERE id = ?`,
      [newSide, memberId],
    ).catch(() => undefined);
    setMembers((prev) => prev.map((m) => m.member_id === memberId ? { ...m, side: newSide } : m));
  }

  function handleDone() {
    router.back();
  }

  const sideAMembers = (rel?.type === 'polarization' || rel?.type === 'protective') ? members.filter((m) => m.side === 'a') : [];
  const sideBMembers = (rel?.type === 'polarization' || rel?.type === 'protective') ? members.filter((m) => m.side === 'b') : [];
  const allianceMembers = rel?.type === 'alliance' ? members : [];

  const availableParts = allParts.filter((p) => !existingPartIds.includes(p.id));

  if (!rel) return <View style={styles.root} />;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#1C1B19" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Edit Members</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{rel.name}</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {rel.type === 'polarization' && (
          <>
            {/* Side A */}
            <Text style={styles.sideLabel}>Side A</Text>
            {sideAMembers.map((m) => (
              <MemberItem
                key={m.member_id}
                member={m}
                relType="polarization"
                onRemove={() => handleRemove(m.member_id)}
                onChangeSide={(s) => handleChangeSide(m.member_id, s)}
              />
            ))}
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => { setAddingSide('a'); setShowSelector(true); }}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={18} color="#3B5BA5" />
              <Text style={styles.addBtnText}>Add Part to Side A</Text>
            </TouchableOpacity>

            <View style={styles.sideDivider} />

            {/* Side B */}
            <Text style={styles.sideLabel}>Side B</Text>
            {sideBMembers.map((m) => (
              <MemberItem
                key={m.member_id}
                member={m}
                relType="polarization"
                onRemove={() => handleRemove(m.member_id)}
                onChangeSide={(s) => handleChangeSide(m.member_id, s)}
              />
            ))}
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => { setAddingSide('b'); setShowSelector(true); }}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={18} color="#3B5BA5" />
              <Text style={styles.addBtnText}>Add Part to Side B</Text>
            </TouchableOpacity>
          </>
        )}

        {rel.type === 'alliance' && (
          <>
            <Text style={styles.sideLabel}>Members</Text>
            {allianceMembers.map((m) => (
              <MemberItem
                key={m.member_id}
                member={m}
                relType="alliance"
                onRemove={() => handleRemove(m.member_id)}
                onChangeSide={() => undefined}
              />
            ))}
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => { setAddingSide('member'); setShowSelector(true); }}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={18} color="#3B5BA5" />
              <Text style={styles.addBtnText}>Add Part</Text>
            </TouchableOpacity>
          </>
        )}

        {rel.type === 'protective' && (
          <>
            <Text style={styles.sideLabel}>Protector(s)</Text>
            {sideAMembers.map((m) => (
              <MemberItem
                key={m.member_id}
                member={m}
                relType="protective"
                onRemove={() => handleRemove(m.member_id)}
                onChangeSide={(s) => handleChangeSide(m.member_id, s)}
              />
            ))}
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => { setAddingSide('a'); setShowSelector(true); }}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={18} color="#5B7FB8" />
              <Text style={[styles.addBtnText, { color: '#5B7FB8' }]}>Add Protector</Text>
            </TouchableOpacity>

            <View style={styles.sideDivider} />

            <Text style={styles.sideLabel}>Protected part(s)</Text>
            {sideBMembers.map((m) => (
              <MemberItem
                key={m.member_id}
                member={m}
                relType="protective"
                onRemove={() => handleRemove(m.member_id)}
                onChangeSide={(s) => handleChangeSide(m.member_id, s)}
              />
            ))}
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => { setAddingSide('b'); setShowSelector(true); }}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={18} color="#5B7FB8" />
              <Text style={[styles.addBtnText, { color: '#5B7FB8' }]}>Add Protected Part</Text>
            </TouchableOpacity>
          </>
        )}

        {rel.type === 'activation_chain' && (
          <>
            <Text style={styles.sideLabel}>Chain sequence</Text>
            {[...members]
              .sort((a, b) => {
                const na = parseInt(a.side ?? '999', 10);
                const nb = parseInt(b.side ?? '999', 10);
                return na - nb;
              })
              .map((m, idx) => (
                <View key={m.member_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#B88A00', width: 20 }}>
                    {idx + 1}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <MemberItem
                      member={m}
                      relType="activation_chain"
                      onRemove={() => handleRemove(m.member_id)}
                      onChangeSide={() => undefined}
                    />
                  </View>
                </View>
              ))}
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => { setAddingSide('member'); setShowSelector(true); }}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={18} color="#B88A00" />
              <Text style={[styles.addBtnText, { color: '#B88A00' }]}>Add to chain</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Save button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.saveBtn}
          activeOpacity={0.85}
          onPress={handleDone}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>Done</Text>
        </TouchableOpacity>
      </View>

      {/* Part selector modal */}
      <Modal visible={showSelector} animationType="slide" transparent onRequestClose={() => setShowSelector(false)}>
        <View style={modalStyles.container}>
          <TouchableOpacity style={modalStyles.backdrop} onPress={() => setShowSelector(false)} activeOpacity={1} />
          <View style={modalStyles.sheet}>
            <View style={modalStyles.handle} />
            <Text style={modalStyles.title}>Select a Part</Text>
            {availableParts.length === 0 ? (
              <Text style={modalStyles.empty}>All parts already added</Text>
            ) : (
              <FlatList
                data={availableParts}
                keyExtractor={(p) => p.id}
                renderItem={({ item }) => {
                  const color = TYPE_COLOR[item.type] ?? '#6B6860';
                  return (
                    <TouchableOpacity
                      style={modalStyles.partRow}
                      onPress={() => handleAdd(item, addingSide)}
                      activeOpacity={0.7}
                    >
                      <View style={[modalStyles.dot, { backgroundColor: color }]} />
                      <View style={[modalStyles.avatar, { backgroundColor: color }]}>
                        <Text style={modalStyles.avatarText}>{getInitials(item.display_name)}</Text>
                      </View>
                      <Text style={modalStyles.partName}>{item.display_name}</Text>
                      <Ionicons name="add-circle-outline" size={20} color="#3B5BA5" />
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Member row ───────────────────────────────────────────────────────────────

function MemberItem({
  member,
  relType,
  onRemove,
  onChangeSide,
}: {
  member: MemberRow;
  relType: 'polarization' | 'alliance' | 'protective' | 'activation_chain';
  onRemove: () => void;
  onChangeSide: (side: 'a' | 'b') => void;
}) {
  const color = member.part_type ? TYPE_COLOR[member.part_type] : '#6B6860';

  function getInitials(name: string): string {
    return name.trim().split(/\s+/).slice(0, 2).map((w) => (w[0] ?? '').toUpperCase()).join('');
  }

  return (
    <View style={memberStyles.row}>
      <View style={[memberStyles.avatar, { backgroundColor: color }]}>
        <Text style={memberStyles.avatarText}>
          {getInitials(member.display_name ?? '?')}
        </Text>
      </View>
      <Text style={memberStyles.name} numberOfLines={1}>{member.display_name ?? '?'}</Text>
      {(relType === 'polarization' || relType === 'protective') && (
        <View style={memberStyles.sideToggle}>
          <TouchableOpacity
            style={[memberStyles.sideBtn, member.side === 'a' && memberStyles.sideBtnActive]}
            onPress={() => onChangeSide('a')}
            activeOpacity={0.7}
          >
            <Text style={[memberStyles.sideBtnText, member.side === 'a' && memberStyles.sideBtnTextActive]}>A</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[memberStyles.sideBtn, member.side === 'b' && memberStyles.sideBtnActive]}
            onPress={() => onChangeSide('b')}
            activeOpacity={0.7}
          >
            <Text style={[memberStyles.sideBtnText, member.side === 'b' && memberStyles.sideBtnTextActive]}>B</Text>
          </TouchableOpacity>
        </View>
      )}
      <TouchableOpacity onPress={onRemove} hitSlop={8} style={memberStyles.removeBtn} activeOpacity={0.7}>
        <Ionicons name="trash-outline" size={18} color="#C2600A" />
      </TouchableOpacity>
    </View>
  );
}

const memberStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  name: { flex: 1, fontSize: 15, color: '#1C1B19', fontWeight: '500' },
  sideToggle: { flexDirection: 'row', gap: 4 },
  sideBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#C5C3BE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideBtnActive: {
    borderColor: '#3B5BA5',
    backgroundColor: '#EEF2FF',
  },
  sideBtnText: { fontSize: 12, fontWeight: '600', color: '#A09D96' },
  sideBtnTextActive: { color: '#3B5BA5' },
  removeBtn: { padding: 4 },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1C1B19' },
  headerSub: { fontSize: 13, color: '#6B6860' },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },
  sideLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B6860',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  sideDivider: {
    height: 1,
    backgroundColor: '#E5E3DE',
    marginVertical: 20,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#3B5BA5',
    borderStyle: 'dashed',
    marginBottom: 4,
  },
  addBtnText: { fontSize: 14, color: '#3B5BA5', fontWeight: '500' },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E3DE',
    backgroundColor: '#FFFFFF',
  },
  saveBtn: {
    backgroundColor: '#3B5BA5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});

const modalStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '70%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E3DE',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 17, fontWeight: '600', color: '#1C1B19', marginBottom: 12 },
  empty: { fontSize: 14, color: '#A09D96', fontStyle: 'italic', paddingVertical: 8 },
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F2EF',
    gap: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  partName: { flex: 1, fontSize: 15, color: '#1C1B19' },
});
