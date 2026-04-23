/**
 * MeetingSpaceSetupStep — 'meeting-space-setup' step type.
 * Guides the user to establish the imaginal meeting space.
 */

import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type { TechniqueStep } from '@/lib/techniques-data';

const SPACE_OPTIONS = [
  { key: 'room',      label: 'A room',              desc: 'A quiet, neutral indoor space' },
  { key: 'outdoors',  label: 'Outdoors',             desc: 'A natural setting: garden, forest, clearing' },
  { key: 'open',      label: 'An open space',        desc: 'Expansive, undefined, just light and presence' },
  { key: 'familiar',  label: 'Something familiar',   desc: 'A place from memory or imagination' },
  { key: 'none',      label: 'No visual space',      desc: 'Just inner presence — no imagery required' },
];

interface Props {
  step: TechniqueStep;
  onAdvance: (data: string) => void;
}

export function MeetingSpaceSetupStep({ step: _step, onAdvance }: Props) {
  const [selectedSpace, setSelectedSpace] = useState<string | null>(null);
  const [description, setDescription] = useState('');

  function handleSpaceReady() {
    if (!selectedSpace) return;
    onAdvance(JSON.stringify({ space_type: selectedSpace, description: description.trim() || undefined }));
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.heading}>Where will you meet?</Text>
        <Text style={s.body}>
          Choose the kind of space that feels right, or describe your own.
          This is your inner space — it can be anywhere.
        </Text>

        <View style={s.options}>
          {SPACE_OPTIONS.map((opt) => {
            const selected = selectedSpace === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[s.optionCard, selected && s.optionCardSelected]}
                onPress={() => { setSelectedSpace(opt.key); setDescription(''); }}
                activeOpacity={0.75}
              >
                <View style={s.optionRow}>
                  <Text style={[s.optionLabel, selected && s.optionLabelSelected]}>
                    {opt.label}
                  </Text>
                  {selected && <Ionicons name="checkmark-circle" size={18} color="#B88A00" />}
                </View>
                <Text style={s.optionDesc}>{opt.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {selectedSpace && selectedSpace !== 'none' && (
          <>
            <Text style={s.descLabel}>Describe it briefly if you like</Text>
            <TextInput
              style={s.descInput}
              value={description}
              onChangeText={setDescription}
              placeholder="What does this space feel like..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              multiline
              textAlignVertical="top"
            />
          </>
        )}

        {selectedSpace === 'none' && (
          <View style={s.nonVisualNote}>
            <Text style={s.nonVisualText}>
              That's completely fine. You don't need an image.{'\n\n'}
              Just a sense of inner space — of being present with these parts without being merged with any of them.
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.readyBtn, !selectedSpace && s.readyBtnDisabled]}
          onPress={handleSpaceReady}
          disabled={!selectedSpace}
          activeOpacity={0.85}
        >
          <Text style={s.readyBtnText}>The space is ready</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 20 },
  heading: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', lineHeight: 30, marginBottom: 12 },
  body: { fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 24, marginBottom: 24 },
  options: { gap: 10 },
  optionCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 14,
    gap: 4,
  },
  optionCardSelected: {
    borderColor: '#B88A00',
    backgroundColor: 'rgba(184,138,0,0.08)',
  },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionLabel: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  optionLabelSelected: { color: '#B88A00' },
  optionDesc: { fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 18 },
  descLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
  },
  descInput: {
    backgroundColor: '#2A2927',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#FFFFFF',
    minHeight: 80,
    lineHeight: 22,
  },
  nonVisualNote: {
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 16,
  },
  nonVisualText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 26,
    fontStyle: 'italic',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#1A1917',
  },
  readyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B5BA5',
    borderRadius: 14,
    paddingVertical: 16,
  },
  readyBtnDisabled: { opacity: 0.4 },
  readyBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
