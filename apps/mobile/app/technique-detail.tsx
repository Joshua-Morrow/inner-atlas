/**
 * Technique Detail — collapsible tutorial + framing + Begin Practice.
 * Route: /technique-detail?id=[technique_id]&partId=[optional]
 * "Begin Practice" → /technique-session?id=[id](&partId=[id])
 */

import { useCallback, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { getTechnique } from '@/lib/techniques-data';
import { getDatabase } from '@/lib/database';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSavedDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TechniqueDetailScreen() {
  const { id, partId } = useLocalSearchParams<{ id: string; partId?: string }>();
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [incompleteSession, setIncompleteSession] = useState<{
    id: string;
    saved_at: string;
  } | null>(null);

  const technique = id ? getTechnique(id) : undefined;

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      const db = getDatabase();
      db.getFirstAsync<{ id: string; completed_at: string }>(
        `SELECT id, completed_at FROM practice_sessions
         WHERE technique_id = ? AND notes_json LIKE '%"status":"incomplete"%'
         ORDER BY completed_at DESC LIMIT 1`,
        [id],
      )
        .then((row) =>
          setIncompleteSession(row ? { id: row.id, saved_at: row.completed_at } : null),
        )
        .catch(() => setIncompleteSession(null));
    }, [id]),
  );

  if (!technique) {
    return (
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <Text style={s.errorText}>Technique not found.</Text>
      </SafeAreaView>
    );
  }

  function handleBegin() {
    const baseUrl = `/technique-session?id=${technique!.id}`;
    const url = partId ? `${baseUrl}&partId=${partId}` : baseUrl;
    router.push(url as never);
  }

  function handleResume() {
    if (!incompleteSession) return;
    const baseUrl = `/technique-session?id=${technique!.id}&resumeId=${incompleteSession.id}`;
    const url = partId ? `${baseUrl}&partId=${partId}` : baseUrl;
    router.push(url as never);
  }

  function handleClearIncompleteSession() {
    if (!incompleteSession) return;
    Alert.alert(
      'Clear saved session?',
      'This will delete the incomplete session. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = getDatabase();
              await db.runAsync(
                'DELETE FROM practice_sessions WHERE id = ?',
                [incompleteSession.id],
              );
              setIncompleteSession(null);
            } catch (e) {
              console.error('[TechniqueDetail] clearIncompleteSession:', e);
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#1C1B19" />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{technique.title}</Text>
        <View style={s.headerRight} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Week badge + duration */}
        <View style={s.metaRow}>
          <View style={s.weekPill}>
            <Text style={s.weekPillText}>Week {technique.week}</Text>
          </View>
          <View style={s.durationRow}>
            <Ionicons name="time-outline" size={14} color="#6B6860" />
            <Text style={s.durationText}>Suggested time: {technique.duration_minutes} minutes</Text>
          </View>
        </View>

        {/* Tutorial (collapsible) */}
        <TouchableOpacity
          style={s.tutorialToggle}
          activeOpacity={0.7}
          onPress={() => setTutorialOpen((v) => !v)}
        >
          <Ionicons name="information-circle-outline" size={18} color="#6B6860" />
          <Text style={s.tutorialToggleText}>Tutorial</Text>
          <Ionicons
            name={tutorialOpen ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="#6B6860"
          />
        </TouchableOpacity>

        {tutorialOpen && (
          <View style={s.tutorialCard}>
            <Text style={s.tutorialText}>{technique.tutorial_text}</Text>
          </View>
        )}

        {/* Framing — main content */}
        <View style={s.framingSection}>
          <Text style={s.framingTitle}>{technique.framing_title}</Text>
          <Text style={s.framingBody}>{technique.framing_body}</Text>
        </View>

        {/* Spacer for pinned button */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Footer — Resume + Begin Practice */}
      <View style={s.footer}>
        {incompleteSession && (
          <View style={s.resumeSection}>
            <View style={s.resumeRow}>
              <TouchableOpacity style={s.resumeBtn} onPress={handleResume} activeOpacity={0.85}>
                <Text style={s.resumeBtnText}>Resume last session</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.clearBtn}
                onPress={handleClearIncompleteSession}
                activeOpacity={0.7}
                accessibilityLabel="Clear saved session"
              >
                <Ionicons name="close-circle-outline" size={20} color="#6B6860" />
              </TouchableOpacity>
            </View>
            <Text style={s.resumeDate}>Saved {formatSavedDate(incompleteSession.saved_at)}</Text>
          </View>
        )}
        <TouchableOpacity
          style={s.beginBtn}
          onPress={handleBegin}
          activeOpacity={0.85}
        >
          <Text style={s.beginBtnText}>Begin Practice</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAF8' },
  errorText: { textAlign: 'center', marginTop: 80, color: '#6B6860', fontSize: 15 },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
    backgroundColor: '#FAFAF8',
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#1C1B19', textAlign: 'center' },
  headerRight: { width: 28 },
  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 },
  // Meta row
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  weekPill: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  weekPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3B5BA5',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  durationText: {
    fontSize: 13,
    color: '#6B6860',
  },
  // Tutorial toggle
  tutorialToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#F5F5F3',
    borderRadius: 10,
    marginBottom: 8,
  },
  tutorialToggleText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#6B6860',
  },
  tutorialCard: {
    backgroundColor: '#F5F5F3',
    borderRadius: 10,
    padding: 16,
    marginBottom: 24,
  },
  tutorialText: {
    fontSize: 15,
    color: '#1C1B19',
    lineHeight: 24,
  },
  // Framing
  framingSection: {
    marginTop: 32,
  },
  framingTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1C1B19',
    lineHeight: 34,
    marginBottom: 16,
  },
  framingBody: {
    fontSize: 16,
    color: '#4A4844',
    lineHeight: 26,
  },
  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FAFAF8',
    borderTopWidth: 1,
    borderTopColor: '#E5E3DE',
    gap: 10,
  },
  resumeSection: {
    alignItems: 'center',
    gap: 4,
  },
  resumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  resumeBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#3B5BA5',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  resumeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3B5BA5',
  },
  clearBtn: {
    padding: 8,
  },
  resumeDate: {
    fontSize: 12,
    color: '#6B6860',
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
