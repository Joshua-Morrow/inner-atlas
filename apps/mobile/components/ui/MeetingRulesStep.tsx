/**
 * MeetingRulesStep — 'meeting-rules' step type.
 * Presents the agreements that hold the Meeting Space.
 */

import { Ionicons } from '@expo/vector-icons';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { TechniqueStep } from '@/lib/techniques-data';

const RULES = [
  {
    number: 1,
    text: 'Each part speaks for itself — no speaking over others.',
    label: 'Respect',
  },
  {
    number: 2,
    text: 'Parts describe their experience, not attacks.',
    label: 'No name-calling',
  },
  {
    number: 3,
    text: 'If a part feels unsafe, it says so. Fear and limits are welcome.',
    label: 'Fear and boundaries are welcome',
  },
  {
    number: 4,
    text: 'Nothing has to be resolved today. Witnessing is enough.',
    label: 'No pressure to resolve',
  },
  {
    number: 5,
    text: 'Self is the host — not a judge, not a fixer, just present.',
    label: 'Self as host',
  },
  {
    number: 6,
    text: 'Every part has a reason for what it does. Curiosity before conclusions.',
    label: 'Curiosity first',
  },
];

interface Props {
  step: TechniqueStep;
  onAdvance: (data: string) => void;
}

export function MeetingRulesStep({ step: _step, onAdvance }: Props) {
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.heading}>Before the meeting begins.</Text>
        <Text style={s.body}>These are the agreements that hold the space:</Text>

        <View style={s.rulesList}>
          {RULES.map((rule) => (
            <View key={rule.number} style={s.ruleCard}>
              <View style={s.ruleNumber}>
                <Text style={s.ruleNumberText}>{rule.number}</Text>
              </View>
              <View style={s.ruleContent}>
                <Text style={s.ruleLabel}>{rule.label}</Text>
                <Text style={s.ruleText}>{rule.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={s.beginBtn}
          onPress={() => onAdvance('agreed')}
          activeOpacity={0.85}
        >
          <Text style={s.beginBtnText}>I understand — begin the meeting</Text>
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
  rulesList: { gap: 10 },
  ruleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 14,
  },
  ruleNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(184,138,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  ruleNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B88A00',
  },
  ruleContent: { flex: 1, gap: 3 },
  ruleLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.3,
  },
  ruleText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#1A1917',
  },
  beginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B5BA5',
    borderRadius: 14,
    paddingVertical: 16,
  },
  beginBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
