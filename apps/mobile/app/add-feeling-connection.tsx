/**
 * Add Feeling Connection — 3-step flow
 * Route: /add-feeling-connection
 *
 * Step 1: Select from-part ("Who is having the feeling?")
 * Step 2: Select to-part ("[Name] feels towards...")
 * Step 3: Select feelings (chip selector)
 */

import { useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  FeelingEdge,
  MapPart,
  getAllFeelingEdges,
  getMapParts,
  upsertFeelingEdge,
} from '@/lib/database';
import { NODE_COLORS } from '@/lib/map-nodes';
import {
  FEEL_TOWARDS_REACTIVE,
  FEEL_TOWARDS_SELF_LIKE,
  FEEL_TOWARDS_SELF_QUALITIES,
} from '@/lib/techniques-data';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPartColor(type: string): string {
  return NODE_COLORS[type as keyof typeof NODE_COLORS] ?? '#6B6860';
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;

export default function AddFeelingConnectionScreen() {
  const [step, setStep]                     = useState<Step>(1);
  const [parts, setParts]                   = useState<MapPart[]>([]);
  const [existingEdges, setExistingEdges]   = useState<FeelingEdge[]>([]);
  const [fromPart, setFromPart]             = useState<MapPart | null>(null);
  const [toPart, setToPart]                 = useState<MapPart | null>(null);
  const [selectedFeelings, setSelectedFeelings] = useState<string[]>([]);
  const [saving, setSaving]                 = useState(false);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const [p, fe] = await Promise.all([getMapParts(), getAllFeelingEdges()]);
        // Exclude synthetic self from the parts list (real self type parts remain)
        setParts(p.filter((pt) => pt.id !== '__self__'));
        setExistingEdges(fe);
      }
      load().catch(() => undefined);
    }, []),
  );

  function handleBack() {
    if (step === 1) router.back();
    else if (step === 2) setStep(1);
    else setStep(2);
  }

  function handleSelectFrom(p: MapPart) {
    setFromPart(p);
    setToPart(null);
    setSelectedFeelings([]);
  }

  function handleSelectTo(p: MapPart) {
    setToPart(p);
    setSelectedFeelings([]);
  }

  function toggleFeeling(f: string) {
    setSelectedFeelings((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    );
  }

  async function handleSave() {
    if (!fromPart || !toPart || selectedFeelings.length === 0 || saving) return;
    setSaving(true);
    try {
      await upsertFeelingEdge({
        fromPartId: fromPart.id,
        toPartId: toPart.id,
        feelings: selectedFeelings,
        source: 'manual',
        sessionId: null,
      });
      router.back();
    } catch (e) {
      console.error('[AddFeelingConnection] save:', e);
    } finally {
      setSaving(false);
    }
  }

  const stepTitle = step === 1
    ? 'Who is having the feeling?'
    : step === 2
    ? `${fromPart?.display_name ?? '…'} feels towards…`
    : `How does ${fromPart?.display_name ?? '…'} feel towards ${toPart?.display_name ?? '…'}?`;

  const toParts = parts.filter((p) => p.id !== fromPart?.id);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} hitSlop={12} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#1C1B19" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Feeling Connection</Text>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>{step}/3</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.stepTitle}>{stepTitle}</Text>

        {/* Step 1 — from part */}
        {step === 1 && parts.map((p) => {
          const isSelected = fromPart?.id === p.id;
          const color = getPartColor(p.type);
          return (
            <TouchableOpacity
              key={p.id}
              style={[styles.partRow, isSelected && styles.partRowSelected, isSelected && { borderColor: color }]}
              onPress={() => handleSelectFrom(p)}
              activeOpacity={0.7}
            >
              <View style={[styles.partDot, { backgroundColor: color }]} />
              <Text style={[styles.partName, isSelected && styles.partNameSelected]}>
                {p.display_name}
              </Text>
              {isSelected && <Ionicons name="checkmark-circle" size={20} color={color} />}
            </TouchableOpacity>
          );
        })}

        {/* Step 2 — to part */}
        {step === 2 && toParts.map((p) => {
          const isSelected = toPart?.id === p.id;
          const color = getPartColor(p.type);
          const existingEdge = existingEdges.find(
            (e) => e.from_part_id === fromPart?.id && e.to_part_id === p.id,
          );
          return (
            <TouchableOpacity
              key={p.id}
              style={[styles.partRow, isSelected && styles.partRowSelected, isSelected && { borderColor: color }]}
              onPress={() => handleSelectTo(p)}
              activeOpacity={0.7}
            >
              <View style={[styles.partDot, { backgroundColor: color }]} />
              <View style={styles.partBody}>
                <Text style={[styles.partName, isSelected && styles.partNameSelected]}>
                  {p.display_name}
                </Text>
                {existingEdge && (
                  <Text style={styles.existingNote}>Existing record — will update</Text>
                )}
              </View>
              {isSelected && <Ionicons name="checkmark-circle" size={20} color={color} />}
            </TouchableOpacity>
          );
        })}

        {/* Step 3 — feelings chip selector */}
        {step === 3 && (
          <>
            <Text style={styles.chipGroupLabel}>Parts present (reactive feelings)</Text>
            <View style={styles.chipsWrap}>
              {FEEL_TOWARDS_REACTIVE.map((f) => {
                const sel = selectedFeelings.includes(f);
                return (
                  <TouchableOpacity
                    key={f}
                    style={[styles.chip, sel && styles.chipSelected]}
                    onPress={() => toggleFeeling(f)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipText, sel && styles.chipTextSel]}>{f}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.chipGroupLabel, { marginTop: 18 }]}>Self-like part present</Text>
            <View style={styles.chipsWrap}>
              {FEEL_TOWARDS_SELF_LIKE.map((f) => {
                const sel = selectedFeelings.includes(f);
                return (
                  <TouchableOpacity
                    key={f}
                    style={[styles.chip, sel && styles.chipSelfLikeSel]}
                    onPress={() => toggleFeeling(f)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipText, sel && styles.chipTextSel]}>{f}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.chipGroupLabel, { marginTop: 18 }]}>Self energy present</Text>
            <View style={styles.chipsWrap}>
              {FEEL_TOWARDS_SELF_QUALITIES.map((f) => {
                const sel = selectedFeelings.includes(f);
                return (
                  <TouchableOpacity
                    key={f}
                    style={[styles.chip, sel && styles.chipSelfSel]}
                    onPress={() => toggleFeeling(f)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipText, sel && styles.chipTextSel]}>{f}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Pinned footer button */}
      <View style={styles.footer}>
        {step < 3 ? (
          <TouchableOpacity
            style={[
              styles.continueBtn,
              ((step === 1 && !fromPart) || (step === 2 && !toPart)) && { opacity: 0.4 },
            ]}
            onPress={() => {
              if (step === 1 && fromPart) setStep(2);
              else if (step === 2 && toPart) setStep(3);
            }}
            disabled={(step === 1 && !fromPart) || (step === 2 && !toPart)}
            activeOpacity={0.85}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.continueBtn, (selectedFeelings.length === 0 || saving) && { opacity: 0.4 }]}
            onPress={handleSave}
            disabled={selectedFeelings.length === 0 || saving}
            activeOpacity={0.85}
          >
            <Text style={styles.continueBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAF8' },
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
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '600', color: '#1C1B19' },
  stepBadge: {
    backgroundColor: '#F3F2EF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stepBadgeText: { fontSize: 12, color: '#6B6860', fontWeight: '500' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 20 },

  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1B19',
    marginBottom: 20,
    lineHeight: 28,
  },

  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E3DE',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  partRowSelected: { backgroundColor: '#F8F9FF' },
  partDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  partBody: { flex: 1 },
  partName: { fontSize: 15, color: '#1C1B19', fontWeight: '500' },
  partNameSelected: { fontWeight: '700' },
  existingNote: { fontSize: 12, color: '#B88A00', marginTop: 2 },

  chipGroupLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9B9A94',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#E5E3DE',
    backgroundColor: '#FFFFFF',
  },
  chipSelected: { backgroundColor: '#EEF2FF', borderColor: '#3B5BA5' },
  chipSelfLikeSel: { backgroundColor: 'rgba(34,197,94,0.1)', borderColor: '#22C55E' },
  chipSelfSel: { backgroundColor: 'rgba(184,138,0,0.1)', borderColor: '#B88A00' },
  chipText: { fontSize: 13, color: '#6B6860', fontWeight: '500' },
  chipTextSel: { color: '#1C1B19', fontWeight: '600' },

  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E3DE',
    backgroundColor: '#FFFFFF',
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B5BA5',
    borderRadius: 12,
    paddingVertical: 14,
  },
  continueBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
