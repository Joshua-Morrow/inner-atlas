/**
 * Fog Explore — Placeholder screen for the mini-assessment library.
 * Navigated to via "Explore the fog" button on the Parts Map.
 * Full library will be built in a later session.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

export default function FogExploreScreen() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Map</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.fogBadge}>
          <Text style={styles.fogBadgeText}>Coming soon</Text>
        </View>

        <Text style={styles.title}>Mini-Assessment Library</Text>

        <Text style={styles.subtitle}>
          Focused explorations that reveal what's hidden in the fog.
        </Text>

        <Text style={styles.description}>
          Each mini-assessment follows a thread — a pattern, sensation, or
          moment — and guides you toward a part that hasn't fully emerged yet.
          Completing one lifts the fog in that region of your map.
        </Text>

        <View style={styles.comingSoonCard}>
          <Text style={styles.comingSoonTitle}>Assessments being built</Text>
          <Text style={styles.comingSoonItem}>· The Achiever</Text>
          <Text style={styles.comingSoonItem}>· The Protector</Text>
          <Text style={styles.comingSoonItem}>· The Connector</Text>
          <Text style={styles.comingSoonItem}>· The Escape Artist</Text>
          <Text style={styles.comingSoonItem}>· Tender Places</Text>
          <Text style={styles.comingSoonItem}>· The Body Speaks</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAF8' },

  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: { paddingVertical: 8 },
  backText: { color: '#3B5BA5', fontSize: 15, fontWeight: '600' },

  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },

  fogBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 16,
  },
  fogBadgeText: { color: '#3B5BA5', fontSize: 12, fontWeight: '600' },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1C1B19',
    marginBottom: 10,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B6860',
    lineHeight: 24,
    marginBottom: 20,
  },
  description: {
    fontSize: 15,
    color: '#6B6860',
    lineHeight: 23,
    marginBottom: 32,
  },

  comingSoonCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    padding: 20,
    gap: 8,
  },
  comingSoonTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A09D96',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  comingSoonItem: {
    fontSize: 15,
    color: '#6B6860',
    lineHeight: 22,
  },
});
