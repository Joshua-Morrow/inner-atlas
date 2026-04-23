import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getDatabase } from '@/lib/database';

type PartType = 'manager' | 'firefighter' | 'exile';

const TYPE_COLORS: Record<PartType, string> = {
  manager: '#3B5BA5',
  firefighter: '#C2600A',
  exile: '#7C3D9B',
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function AddPartScreen() {
  const [name, setName] = useState('');
  const [appearance, setAppearance] = useState('');
  const [job, setJob] = useState('');
  const [keyTrigger, setKeyTrigger] = useState('');
  const [keyIdentifier, setKeyIdentifier] = useState('');
  const [fears, setFears] = useState('');
  const [partType, setPartType] = useState<PartType | null>(null);
  const [saving, setSaving] = useState(false);

  const hasAnyInput =
    name.trim().length > 0 ||
    appearance.trim().length > 0 ||
    job.trim().length > 0 ||
    keyTrigger.trim().length > 0 ||
    keyIdentifier.trim().length > 0 ||
    fears.trim().length > 0;

  function handleBack() {
    if (hasAnyInput) {
      Alert.alert(
        'Discard part?',
        'You have unsaved information. Are you sure you want to go back?',
        [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setSaving(true);
    try {
      const db = getDatabase();
      const now = new Date().toISOString();
      const partId = makeId();

      await db.runAsync(
        `INSERT INTO parts
          (id, name, type, discovered_via, status, created_at, updated_at)
         VALUES (?, ?, ?, 'manual', 'named', ?, ?)`,
        [partId, trimmedName, partType ?? 'manager', now, now]
      );

      await db.runAsync(
        `INSERT INTO part_profiles
          (part_id, appearance, job, key_trigger, key_identifier, fears, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          partId,
          appearance.trim() || null,
          job.trim() || null,
          keyTrigger.trim() || null,
          keyIdentifier.trim() || null,
          fears.trim() || null,
          now,
        ]
      );

      router.replace('/(tabs)/explore');
    } catch (err) {
      console.error('Failed to save part:', err);
      Alert.alert('Error', 'Could not save your part. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const canSave = name.trim().length > 0 && !saving;

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView
        style={s.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Nav header */}
        <View style={s.navHeader}>
          <Pressable onPress={handleBack} hitSlop={12}>
            <Text style={s.backBtn}>← Back</Text>
          </Pressable>
        </View>

        <ScrollView
          style={s.flex1}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.heading}>Add a Part</Text>
          <Text style={s.subheading}>Name and describe what you notice</Text>

          {/* Name */}
          <View style={s.field}>
            <TextInput
              style={s.nameInput}
              placeholder="What will you call this part?"
              placeholderTextColor="#A09E99"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          {/* Appearance */}
          <FieldBlock label="What does this part look or feel like?">
            <TextInput
              style={[s.textArea, s.textArea3]}
              placeholder="An image, color, texture, sensation — whatever comes..."
              placeholderTextColor="#A09E99"
              value={appearance}
              onChangeText={setAppearance}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </FieldBlock>

          {/* Job */}
          <FieldBlock label="What is this part trying to do to help?">
            <TextInput
              style={[s.textArea, s.textArea2]}
              placeholder="Its role or intention..."
              placeholderTextColor="#A09E99"
              value={job}
              onChangeText={setJob}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </FieldBlock>

          {/* Key Trigger */}
          <FieldBlock label="What primarily activates this part?">
            <TextInput
              style={[s.textArea, s.textArea2]}
              placeholder="A situation, feeling, or event..."
              placeholderTextColor="#A09E99"
              value={keyTrigger}
              onChangeText={setKeyTrigger}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </FieldBlock>

          {/* Key Identifier */}
          <FieldBlock label="How do you know when it is active?">
            <TextInput
              style={[s.textArea, s.textArea2]}
              placeholder="A thought, feeling, sensation, or impulse..."
              placeholderTextColor="#A09E99"
              value={keyIdentifier}
              onChangeText={setKeyIdentifier}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </FieldBlock>

          {/* Fears */}
          <FieldBlock label="What is this part afraid of?">
            <TextInput
              style={[s.textArea, s.textArea2]}
              placeholder="What it worries will happen..."
              placeholderTextColor="#A09E99"
              value={fears}
              onChangeText={setFears}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </FieldBlock>

          {/* Part type selector */}
          <View style={s.typeRow}>
            {(['manager', 'firefighter', 'exile'] as PartType[]).map((t) => {
              const isActive = partType === t;
              const color = TYPE_COLORS[t];
              return (
                <Pressable
                  key={t}
                  style={[
                    s.typeChip,
                    isActive && { backgroundColor: color, borderColor: color },
                  ]}
                  onPress={() => setPartType(isActive ? null : t)}
                >
                  <Text
                    style={[
                      s.typeChipText,
                      isActive && s.typeChipTextActive,
                    ]}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Save */}
          <Pressable
            style={[s.saveBtn, !canSave && s.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
          >
            <Text style={s.saveBtnText}>
              {saving ? 'Saving...' : 'Add to My Atlas'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Field wrapper ─────────────────────────────────────────────────────────

function FieldBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  flex1: { flex: 1 },

  navHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E3DE',
  },
  backBtn: {
    fontSize: 16,
    color: '#3B5BA5',
  },

  scroll: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },

  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1C1B19',
    marginBottom: 4,
  },
  subheading: {
    fontSize: 15,
    color: '#6B6860',
    marginBottom: 28,
  },

  field: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1B19',
    marginBottom: 8,
  },

  nameInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E3DE',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 17,
    fontWeight: '500',
    color: '#1C1B19',
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E3DE',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    color: '#1C1B19',
    lineHeight: 22,
  },
  textArea2: {
    minHeight: 68,
  },
  textArea3: {
    minHeight: 92,
  },

  // Type selector
  typeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 32,
    marginTop: 4,
  },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    backgroundColor: '#FFFFFF',
  },
  typeChipText: {
    fontSize: 14,
    color: '#6B6860',
    fontWeight: '500',
  },
  typeChipTextActive: {
    color: '#FFFFFF',
  },

  // Save
  saveBtn: {
    backgroundColor: '#3B5BA5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.45,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
