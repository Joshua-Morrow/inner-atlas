/**
 * New Relationship — 3-step creation wizard
 * Route: /new-relationship
 *
 * Step 1: Type selection (polarization | alliance | protective | activation_chain)
 * Step 2: Name
 * Step 3: Members
 *
 * On create → /relationship-profile?id=<id>
 */

import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getDatabase } from '@/lib/database';

// ─── Types ────────────────────────────────────────────────────────────────────

type RelType = 'polarization' | 'alliance' | 'protective' | 'activation_chain';
type PartType = 'manager' | 'firefighter' | 'exile' | 'self';
type SelectorTarget = 'a' | 'b' | 'alliance' | 'protector' | 'protected' | 'chain' | null;

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

// ─── Part chip ────────────────────────────────────────────────────────────────

function PartChip({
  part,
  onRemove,
}: {
  part: PartRow;
  onRemove: () => void;
}) {
  const color = TYPE_COLOR[part.type] ?? '#6B6860';
  return (
    <View style={[chipStyles.chip, { backgroundColor: color + '18', borderColor: color + '60' }]}>
      <View style={[chipStyles.avatar, { backgroundColor: color }]}>
        <Text style={chipStyles.avatarText}>{getInitials(part.display_name)}</Text>
      </View>
      <Text style={[chipStyles.label, { color }]} numberOfLines={1}>{part.display_name}</Text>
      <TouchableOpacity onPress={onRemove} hitSlop={8} style={chipStyles.removeBtn} activeOpacity={0.7}>
        <Ionicons name="close" size={14} color={color} />
      </TouchableOpacity>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 6,
    maxWidth: 180,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 8, fontWeight: '700', color: '#FFFFFF' },
  label: { fontSize: 13, fontWeight: '500', flexShrink: 1 },
  removeBtn: { padding: 2 },
});

// ─── Part Selector Modal ──────────────────────────────────────────────────────

function PartSelectorModal({
  visible,
  allParts,
  excludeIds,
  onSelect,
  onClose,
}: {
  visible: boolean;
  allParts: PartRow[];
  excludeIds: string[];
  onSelect: (part: PartRow) => void;
  onClose: () => void;
}) {
  const available = allParts.filter((p) => !excludeIds.includes(p.id));
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={modalStyles.container}>
        <TouchableOpacity style={modalStyles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />
          <Text style={modalStyles.title}>Select a Part</Text>
          {available.length === 0 ? (
            <Text style={modalStyles.empty}>All parts are already added</Text>
          ) : (
            <FlatList
              data={available}
              keyExtractor={(p) => p.id}
              renderItem={({ item }) => {
                const color = TYPE_COLOR[item.type] ?? '#6B6860';
                return (
                  <TouchableOpacity
                    style={modalStyles.partRow}
                    onPress={() => onSelect(item)}
                    activeOpacity={0.7}
                  >
                    <View style={[modalStyles.dot, { backgroundColor: color }]} />
                    <Text style={modalStyles.partName}>{item.display_name}</Text>
                    <Ionicons name="add" size={18} color="#3B5BA5" />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
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
  dot: { width: 10, height: 10, borderRadius: 5 },
  partName: { flex: 1, fontSize: 15, color: '#1C1B19' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NewRelationshipScreen() {
  const [step, setStep]                 = useState<1 | 2 | 3>(1);
  const [relType, setRelType]           = useState<RelType | null>(null);
  const [name, setName]                 = useState('');
  const [allParts, setAllParts]         = useState<PartRow[]>([]);
  const [sideAIds, setSideAIds]         = useState<string[]>([]);
  const [sideBIds, setSideBIds]         = useState<string[]>([]);
  const [allianceIds, setAllianceIds]   = useState<string[]>([]);
  const [protectorIds, setProtectorIds] = useState<string[]>([]);
  const [protectedIds, setProtectedIds] = useState<string[]>([]);
  const [chainIds, setChainIds]         = useState<string[]>([]);
  const [selectorTarget, setSelectorTarget] = useState<SelectorTarget>(null);
  const [saving, setSaving]             = useState(false);

  useFocusEffect(
    useCallback(() => {
      getDatabase()
        .getAllAsync<PartRow>(
          `SELECT id, COALESCE(custom_name, name) AS display_name, type
           FROM parts ORDER BY created_at ASC`,
          [],
        )
        .then((rows) => setAllParts(rows))
        .catch((e) => console.error('[NewRelationship] load parts:', e));
    }, []),
  );

  const partsMap = new Map(allParts.map((p) => [p.id, p]));

  function handleBack() {
    if (step === 1) {
      Alert.alert('Discard?', 'Discard this new relationship?', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      setStep((s) => (s - 1) as 1 | 2 | 3);
    }
  }

  function canContinue(): boolean {
    if (step === 1) return relType !== null;
    if (step === 2) return name.trim().length > 0;
    if (step === 3) {
      if (relType === 'polarization')      return sideAIds.length >= 1 && sideBIds.length >= 1;
      if (relType === 'protective')        return protectorIds.length >= 1 && protectedIds.length >= 1;
      if (relType === 'activation_chain')  return chainIds.length >= 2;
      return allianceIds.length >= 2;
    }
    return false;
  }

  function moveChainItemUp(idx: number) {
    setChainIds(prev => {
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }

  function moveChainItemDown(idx: number) {
    setChainIds(prev => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }

  async function handleCreate() {
    if (!relType || saving) return;
    setSaving(true);
    const db = getDatabase();
    const relId = generateId();
    const now = nowIso();

    try {
      await db.runAsync(
        `INSERT INTO relationships (id, name, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
        [relId, name.trim(), relType, now, now],
      );

      if (relType === 'polarization') {
        for (const pid of sideAIds) {
          await db.runAsync(
            `INSERT INTO relationship_members (id, relationship_id, member_type, part_id, side, created_at)
             VALUES (?, ?, 'part', ?, 'a', ?)`,
            [generateId(), relId, pid, now],
          );
        }
        for (const pid of sideBIds) {
          await db.runAsync(
            `INSERT INTO relationship_members (id, relationship_id, member_type, part_id, side, created_at)
             VALUES (?, ?, 'part', ?, 'b', ?)`,
            [generateId(), relId, pid, now],
          );
        }
        await db.runAsync(
          `INSERT INTO polarization_details (id, relationship_id, created_at, updated_at)
           VALUES (?, ?, ?, ?)`,
          [generateId(), relId, now, now],
        );
      } else if (relType === 'alliance') {
        for (const pid of allianceIds) {
          await db.runAsync(
            `INSERT INTO relationship_members (id, relationship_id, member_type, part_id, side, created_at)
             VALUES (?, ?, 'part', ?, NULL, ?)`,
            [generateId(), relId, pid, now],
          );
        }
      } else if (relType === 'protective') {
        for (const pid of protectorIds) {
          await db.runAsync(
            `INSERT INTO relationship_members (id, relationship_id, member_type, part_id, side, created_at)
             VALUES (?, ?, 'part', ?, 'a', ?)`,
            [generateId(), relId, pid, now],
          );
        }
        for (const pid of protectedIds) {
          await db.runAsync(
            `INSERT INTO relationship_members (id, relationship_id, member_type, part_id, side, created_at)
             VALUES (?, ?, 'part', ?, 'b', ?)`,
            [generateId(), relId, pid, now],
          );
        }
      } else if (relType === 'activation_chain') {
        for (let i = 0; i < chainIds.length; i++) {
          await db.runAsync(
            `INSERT INTO relationship_members (id, relationship_id, member_type, part_id, side, created_at)
             VALUES (?, ?, 'part', ?, ?, ?)`,
            [generateId(), relId, chainIds[i], String(i + 1), now],
          );
        }
      }

      router.replace(`/relationship-profile?id=${relId}` as any);
    } catch (e) {
      console.error('[NewRelationship] create:', e);
      setSaving(false);
    }
  }

  function addPart(target: SelectorTarget, part: PartRow) {
    if (target === 'a')          setSideAIds(prev => [...prev, part.id]);
    else if (target === 'b')     setSideBIds(prev => [...prev, part.id]);
    else if (target === 'alliance')  setAllianceIds(prev => [...prev, part.id]);
    else if (target === 'protector') setProtectorIds(prev => [...prev, part.id]);
    else if (target === 'protected') setProtectedIds(prev => [...prev, part.id]);
    else if (target === 'chain')     setChainIds(prev => [...prev, part.id]);
    setSelectorTarget(null);
  }

  function removePart(target: 'a' | 'b' | 'alliance' | 'protector' | 'protected', partId: string) {
    if (target === 'a')          setSideAIds(prev => prev.filter(x => x !== partId));
    else if (target === 'b')     setSideBIds(prev => prev.filter(x => x !== partId));
    else if (target === 'alliance')  setAllianceIds(prev => prev.filter(x => x !== partId));
    else if (target === 'protector') setProtectorIds(prev => prev.filter(x => x !== partId));
    else if (target === 'protected') setProtectedIds(prev => prev.filter(x => x !== partId));
  }

  const selectorExclude: string[] = (() => {
    if (selectorTarget === 'a')          return sideAIds;
    if (selectorTarget === 'b')          return sideBIds;
    if (selectorTarget === 'alliance')   return allianceIds;
    if (selectorTarget === 'protector')  return protectorIds;
    if (selectorTarget === 'protected')  return protectedIds;
    if (selectorTarget === 'chain')      return chainIds;
    return [];
  })();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} hitSlop={12} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="#1C1B19" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Relationship</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* ── Step 1 — Type selection ── */}
          {step === 1 && (
            <View style={styles.stepWrap}>
              <Text style={styles.stepQuestion}>What kind of relationship is this?</Text>

              <TouchableOpacity
                style={[styles.typeCard, relType === 'polarization' && styles.typeCardSelected]}
                activeOpacity={0.7}
                onPress={() => setRelType('polarization')}
              >
                <View style={styles.typeIconWrap}>
                  <Ionicons name="git-compare-outline" size={28} color={relType === 'polarization' ? '#C2600A' : '#6B6860'} />
                </View>
                <View style={styles.typeBody}>
                  <Text style={[styles.typeTitle, relType === 'polarization' && styles.typeTitleSelected]}>
                    Polarization
                  </Text>
                  <Text style={styles.typeDesc}>Two parts or groups in conflict with each other</Text>
                </View>
                {relType === 'polarization' && (
                  <Ionicons name="checkmark-circle" size={22} color="#C2600A" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeCard, relType === 'alliance' && styles.typeCardSelectedBlue]}
                activeOpacity={0.7}
                onPress={() => setRelType('alliance')}
              >
                <View style={styles.typeIconWrap}>
                  <Ionicons name="link-outline" size={28} color={relType === 'alliance' ? '#3B5BA5' : '#6B6860'} />
                </View>
                <View style={styles.typeBody}>
                  <Text style={[styles.typeTitle, relType === 'alliance' && styles.typeTitleSelectedBlue]}>
                    Alliance
                  </Text>
                  <Text style={styles.typeDesc}>Parts working together toward a shared goal</Text>
                </View>
                {relType === 'alliance' && (
                  <Ionicons name="checkmark-circle" size={22} color="#3B5BA5" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeCard, relType === 'protective' && styles.typeCardSelectedProtective]}
                activeOpacity={0.7}
                onPress={() => setRelType('protective')}
              >
                <View style={styles.typeIconWrap}>
                  <Ionicons name="shield-checkmark-outline" size={28} color={relType === 'protective' ? '#5B7FB8' : '#6B6860'} />
                </View>
                <View style={styles.typeBody}>
                  <Text style={[styles.typeTitle, relType === 'protective' && styles.typeTitleSelectedProtective]}>
                    Protective
                  </Text>
                  <Text style={styles.typeDesc}>A protector part shielding a more vulnerable part</Text>
                </View>
                {relType === 'protective' && (
                  <Ionicons name="checkmark-circle" size={22} color="#5B7FB8" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeCard, relType === 'activation_chain' && styles.typeCardSelectedGold]}
                activeOpacity={0.7}
                onPress={() => setRelType('activation_chain')}
              >
                <View style={styles.typeIconWrap}>
                  <Ionicons name="git-network-outline" size={28} color={relType === 'activation_chain' ? '#B88A00' : '#6B6860'} />
                </View>
                <View style={styles.typeBody}>
                  <Text style={[styles.typeTitle, relType === 'activation_chain' && styles.typeTitleSelectedGold]}>
                    Activation Chain
                  </Text>
                  <Text style={styles.typeDesc}>A sequence of parts that activate one after another</Text>
                </View>
                {relType === 'activation_chain' && (
                  <Ionicons name="checkmark-circle" size={22} color="#B88A00" />
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ── Step 2 — Name ── */}
          {step === 2 && (
            <View style={styles.stepWrap}>
              <Text style={styles.stepQuestion}>Give this relationship a name</Text>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                placeholder={
                  relType === 'polarization'     ? 'e.g. "The Push-Pull"' :
                  relType === 'alliance'         ? 'e.g. "The Guard Team"' :
                  relType === 'protective'       ? 'e.g. "Critic protecting Worthy"' :
                                                   'e.g. "Stress → Anger → Numbing"'
                }
                placeholderTextColor="#A09D96"
                autoFocus
                returnKeyType="done"
              />
            </View>
          )}

          {/* ── Step 3 — Members: polarization ── */}
          {step === 3 && relType === 'polarization' && (
            <View style={styles.stepWrap}>
              <Text style={styles.stepQuestion}>Who is on each side?</Text>

              <View style={styles.sideBlock}>
                <Text style={styles.sideLabel}>Side A</Text>
                <View style={styles.chipsWrap}>
                  {sideAIds.map((pid) => {
                    const p = partsMap.get(pid);
                    if (!p) return null;
                    return <PartChip key={pid} part={p} onRemove={() => removePart('a', pid)} />;
                  })}
                  <TouchableOpacity style={styles.addChipBtn} onPress={() => setSelectorTarget('a')} activeOpacity={0.7}>
                    <Ionicons name="add" size={16} color="#3B5BA5" />
                    <Text style={styles.addChipBtnText}>Add Part</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.sideBlock}>
                <Text style={styles.sideLabel}>Side B</Text>
                <View style={styles.chipsWrap}>
                  {sideBIds.map((pid) => {
                    const p = partsMap.get(pid);
                    if (!p) return null;
                    return <PartChip key={pid} part={p} onRemove={() => removePart('b', pid)} />;
                  })}
                  <TouchableOpacity style={styles.addChipBtn} onPress={() => setSelectorTarget('b')} activeOpacity={0.7}>
                    <Ionicons name="add" size={16} color="#3B5BA5" />
                    <Text style={styles.addChipBtnText}>Add Part</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.hint}>Minimum 1 member on each side</Text>
            </View>
          )}

          {/* ── Step 3 — Members: alliance ── */}
          {step === 3 && relType === 'alliance' && (
            <View style={styles.stepWrap}>
              <Text style={styles.stepQuestion}>Who is in this alliance?</Text>
              <View style={styles.chipsWrap}>
                {allianceIds.map((pid) => {
                  const p = partsMap.get(pid);
                  if (!p) return null;
                  return <PartChip key={pid} part={p} onRemove={() => removePart('alliance', pid)} />;
                })}
                <TouchableOpacity style={styles.addChipBtn} onPress={() => setSelectorTarget('alliance')} activeOpacity={0.7}>
                  <Ionicons name="add" size={16} color="#3B5BA5" />
                  <Text style={styles.addChipBtnText}>Add Part</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.hint}>Minimum 2 members</Text>
            </View>
          )}

          {/* ── Step 3 — Members: protective ── */}
          {step === 3 && relType === 'protective' && (
            <View style={styles.stepWrap}>
              <Text style={styles.stepQuestion}>Who is protecting whom?</Text>

              <View style={styles.sideBlock}>
                <View style={styles.sideLabelRow}>
                  <Ionicons name="shield-checkmark-outline" size={14} color="#5B7FB8" />
                  <Text style={[styles.sideLabel, { color: '#5B7FB8' }]}>Protector(s)</Text>
                </View>
                <View style={styles.chipsWrap}>
                  {protectorIds.map((pid) => {
                    const p = partsMap.get(pid);
                    if (!p) return null;
                    return <PartChip key={pid} part={p} onRemove={() => removePart('protector', pid)} />;
                  })}
                  <TouchableOpacity style={styles.addChipBtn} onPress={() => setSelectorTarget('protector')} activeOpacity={0.7}>
                    <Ionicons name="add" size={16} color="#5B7FB8" />
                    <Text style={[styles.addChipBtnText, { color: '#5B7FB8' }]}>Add Part</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.sideBlock}>
                <View style={styles.sideLabelRow}>
                  <Ionicons name="shield-outline" size={14} color="#7C3D9B" />
                  <Text style={[styles.sideLabel, { color: '#7C3D9B' }]}>Protected part(s)</Text>
                </View>
                <View style={styles.chipsWrap}>
                  {protectedIds.map((pid) => {
                    const p = partsMap.get(pid);
                    if (!p) return null;
                    return <PartChip key={pid} part={p} onRemove={() => removePart('protected', pid)} />;
                  })}
                  <TouchableOpacity style={styles.addChipBtn} onPress={() => setSelectorTarget('protected')} activeOpacity={0.7}>
                    <Ionicons name="add" size={16} color="#7C3D9B" />
                    <Text style={[styles.addChipBtnText, { color: '#7C3D9B' }]}>Add Part</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.hint}>At least one protector and one protected part</Text>
            </View>
          )}

          {/* ── Step 3 — Members: activation_chain ── */}
          {step === 3 && relType === 'activation_chain' && (
            <View style={styles.stepWrap}>
              <Text style={styles.stepQuestion}>Order the activation sequence</Text>

              {chainIds.map((pid, idx) => {
                const p = partsMap.get(pid);
                if (!p) return null;
                const color = TYPE_COLOR[p.type] ?? '#6B6860';
                return (
                  <View key={pid} style={styles.chainRow}>
                    <Text style={styles.chainPos}>{idx + 1}</Text>
                    <View style={[styles.chainChip, { backgroundColor: color + '18', borderColor: color + '60' }]}>
                      <View style={[chipStyles.avatar, { backgroundColor: color }]}>
                        <Text style={chipStyles.avatarText}>{getInitials(p.display_name)}</Text>
                      </View>
                      <Text style={[chipStyles.label, { color }]} numberOfLines={1}>{p.display_name}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => moveChainItemUp(idx)}
                      disabled={idx === 0}
                      hitSlop={8}
                      activeOpacity={0.7}
                      style={[styles.chainArrowBtn, idx === 0 && styles.chainArrowDisabled]}
                    >
                      <Ionicons name="chevron-up" size={18} color={idx === 0 ? '#C5C3BE' : '#3B5BA5'} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => moveChainItemDown(idx)}
                      disabled={idx === chainIds.length - 1}
                      hitSlop={8}
                      activeOpacity={0.7}
                      style={[styles.chainArrowBtn, idx === chainIds.length - 1 && styles.chainArrowDisabled]}
                    >
                      <Ionicons name="chevron-down" size={18} color={idx === chainIds.length - 1 ? '#C5C3BE' : '#3B5BA5'} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setChainIds(prev => prev.filter((_, i) => i !== idx))}
                      hitSlop={8}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close-circle-outline" size={20} color="#A09D96" />
                    </TouchableOpacity>
                  </View>
                );
              })}

              <TouchableOpacity style={styles.addChainBtn} onPress={() => setSelectorTarget('chain')} activeOpacity={0.7}>
                <Ionicons name="add" size={18} color="#B88A00" />
                <Text style={styles.addChainBtnText}>Add to chain</Text>
              </TouchableOpacity>
              <Text style={styles.hint}>At least 2 parts in sequence. Position 1 activates first.</Text>
            </View>
          )}
        </ScrollView>

        {/* Pinned footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.continueBtn, !canContinue() && styles.continueBtnDisabled]}
            onPress={step < 3 ? () => setStep((s) => (s + 1) as 1 | 2 | 3) : handleCreate}
            disabled={!canContinue() || saving}
            activeOpacity={0.85}
          >
            <Text style={styles.continueBtnText}>
              {step < 3 ? 'Continue' : 'Create Relationship'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Part selector modal */}
      <PartSelectorModal
        visible={selectorTarget !== null}
        allParts={allParts}
        excludeIds={selectorExclude}
        onSelect={(p) => selectorTarget && addPart(selectorTarget, p)}
        onClose={() => setSelectorTarget(null)}
      />
    </SafeAreaView>
  );
}

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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
    backgroundColor: '#FFFFFF',
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1B19',
  },
  headerRight: { width: 32 },

  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
  },

  stepWrap: {
    gap: 16,
  },

  stepQuestion: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1B19',
    marginBottom: 8,
  },

  // Type cards
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E5E3DE',
    padding: 16,
    gap: 14,
  },
  typeCardSelected: {
    borderColor: '#C2600A',
    backgroundColor: '#FFF7ED',
  },
  typeCardSelectedBlue: {
    borderColor: '#3B5BA5',
    backgroundColor: '#EEF2FF',
  },
  typeCardSelectedProtective: {
    borderColor: '#5B7FB8',
    backgroundColor: '#EEF4FF',
  },
  typeCardSelectedGold: {
    borderColor: '#B88A00',
    backgroundColor: '#FFFBEB',
  },
  typeIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F3F2EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBody: { flex: 1, gap: 4 },
  typeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1B19',
  },
  typeTitleSelected:           { color: '#C2600A' },
  typeTitleSelectedBlue:       { color: '#3B5BA5' },
  typeTitleSelectedProtective: { color: '#5B7FB8' },
  typeTitleSelectedGold:       { color: '#B88A00' },
  typeDesc: {
    fontSize: 13,
    color: '#6B6860',
    lineHeight: 18,
  },

  // Name input
  nameInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E3DE',
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1C1B19',
  },

  // Members
  sideBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    padding: 14,
    gap: 10,
  },
  sideLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sideLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B6860',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  addChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3B5BA5',
    borderStyle: 'dashed',
  },
  addChipBtnText: {
    fontSize: 13,
    color: '#3B5BA5',
    fontWeight: '500',
  },
  hint: {
    fontSize: 13,
    color: '#A09D96',
    fontStyle: 'italic',
  },

  // Activation chain rows
  chainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    padding: 10,
  },
  chainPos: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B88A00',
    width: 20,
    textAlign: 'center',
  },
  chainChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
  },
  chainArrowBtn: {
    padding: 2,
  },
  chainArrowDisabled: {
    opacity: 0.35,
  },
  addChainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#B88A00',
    borderStyle: 'dashed',
    backgroundColor: '#FFFBEB',
  },
  addChainBtnText: {
    fontSize: 14,
    color: '#B88A00',
    fontWeight: '600',
  },

  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E5E3DE',
    backgroundColor: '#FFFFFF',
  },
  continueBtn: {
    backgroundColor: '#3B5BA5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  continueBtnDisabled: {
    backgroundColor: '#C5C3BE',
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
