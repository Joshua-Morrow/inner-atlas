/**
 * Coming Soon — reusable placeholder for features not yet built
 * Route: /coming-soon?feature=<name>
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ComingSoonScreen() {
  const { feature } = useLocalSearchParams<{ feature: string }>();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={18} color="#3B5BA5" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text style={styles.heading}>{feature ?? 'Feature'}</Text>
        <Text style={styles.sub}>This feature is coming soon.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3B5BA5',
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1B19',
    textAlign: 'center',
  },
  sub: {
    fontSize: 16,
    color: '#6B6860',
    textAlign: 'center',
  },
});
