/**
 * Techniques Library — 6-week IFS therapy adjunct program.
 * Route: /techniques
 * Tap a card → /technique-detail?id=[technique_id]
 */

import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  TECHNIQUES,
  TECHNIQUE_CATEGORIES,
  type Technique,
} from '@/lib/techniques-data';

// ─── Card ─────────────────────────────────────────────────────────────────────

function TechniqueCard({ technique }: { technique: Technique }) {
  return (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.75}
      onPress={() => router.push(`/technique-detail?id=${technique.id}` as never)}
      accessibilityRole="button"
      accessibilityLabel={technique.title}
    >
      {/* Week badge */}
      <View style={s.weekBadge}>
        <Text style={s.weekBadgeText}>WEEK {technique.week}</Text>
      </View>

      <View style={s.cardBody}>
        <View style={s.cardMain}>
          <Text style={s.cardTitle}>{technique.title}</Text>
          <Text style={s.cardSubtitle} numberOfLines={2}>{technique.subtitle}</Text>
        </View>

        <View style={s.cardRight}>
          <View style={s.durationRow}>
            <Ionicons name="time-outline" size={13} color="#6B6860" />
            <Text style={s.durationText}>{technique.duration_minutes} min</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#B8B4AC" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TechniquesScreen() {
  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#1C1B19" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Techniques</Text>
        <View style={s.headerRight} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.intro}>
          A 7-week progressive program. One technique per week, each building on the last.
        </Text>

        {TECHNIQUE_CATEGORIES.map(({ key, label }) => {
          const techniques = TECHNIQUES.filter((t) => t.category === key);
          return (
            <View key={key} style={s.section}>
              <Text style={s.sectionHeader}>{label}</Text>
              <View style={s.list}>
                {techniques.map((t) => (
                  <TechniqueCard key={t.id} technique={t} />
                ))}
              </View>
            </View>
          );
        })}

        {/* Week 7 — Capstone */}
        <View style={s.section}>
          <Text style={s.sectionHeader}>CAPSTONE</Text>
          <View style={s.list}>
            <TouchableOpacity
              style={s.card}
              activeOpacity={0.75}
              onPress={() => router.push('/trailhead' as never)}
              accessibilityRole="button"
              accessibilityLabel="Following a Trailhead"
            >
              <View style={[s.weekBadge, { backgroundColor: '#F5F0FF' }]}>
                <Text style={[s.weekBadgeText, { color: '#7C3D9B' }]}>WEEK 7</Text>
              </View>
              <View style={s.cardBody}>
                <View style={s.cardMain}>
                  <Text style={s.cardTitle}>Following a Trailhead</Text>
                  <Text style={s.cardSubtitle} numberOfLines={2}>
                    Follow an activation through your system's protection chain to the exile it guards
                  </Text>
                </View>
                <View style={s.cardRight}>
                  <Ionicons name="chevron-forward" size={16} color="#B8B4AC" />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Spacer for pinned button */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Practice Log button — pinned above tab bar */}
      <View style={s.footer}>
        <TouchableOpacity
          style={s.logBtn}
          activeOpacity={0.8}
          onPress={() => router.push('/technique-log' as never)}
        >
          <Ionicons name="journal-outline" size={18} color="#3B5BA5" />
          <Text style={s.logBtnText}>Practice Log</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
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
    backgroundColor: '#FAFAF8',
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1B19',
    textAlign: 'center',
  },
  headerRight: { width: 28 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
  },
  intro: {
    fontSize: 14,
    color: '#6B6860',
    lineHeight: 22,
    marginBottom: 28,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B6860',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  list: { gap: 10 },
  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    padding: 14,
    shadowColor: '#1C1B19',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  weekBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginBottom: 8,
  },
  weekBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B6860',
    letterSpacing: 0.5,
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardMain: {
    flex: 1,
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1B19',
    marginBottom: 3,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6B6860',
    lineHeight: 18,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  durationText: {
    fontSize: 12,
    color: '#6B6860',
    fontWeight: '500',
  },
  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E3DE',
    backgroundColor: '#FAFAF8',
  },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#3B5BA5',
    borderRadius: 12,
    paddingVertical: 13,
  },
  logBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3B5BA5',
  },
});
