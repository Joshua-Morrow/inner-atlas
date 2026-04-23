import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  LayoutChangeEvent,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { seedTestData } from '@/lib/dev-seed';
import { getDatabase } from '@/lib/database';

// ─── Types ────────────────────────────────────────────────────────────────────

type PartType = 'manager' | 'firefighter' | 'exile' | 'self';

interface MiniPartRow {
  id: string;
  display_name: string;
  type: PartType;
}

interface MiniUpdateRow {
  id: string;
  part_id: string;
  intensity: number | null;
  created_at: string;
}

const TYPE_COLOR_MAP: Record<string, string> = {
  manager:     '#3B5BA5',
  firefighter: '#C2600A',
  exile:       '#7C3D9B',
  self:        '#B88A00',
};

// ─── Mini Chart Helper ────────────────────────────────────────────────────────

function renderMiniChartElements(
  width: number,
  height: number,
  updates: MiniUpdateRow[],
  color: string,
  startDate: Date,
  endDate: Date,
): React.ReactElement[] {
  if (!width || width < 10) return [];
  const startTs = startDate.getTime();
  const endTs   = endDate.getTime();
  const PAD     = 8;
  const plotW   = width - PAD * 2;
  const plotH   = height - PAD * 2;

  function px(ts: number): number {
    return endTs <= startTs ? PAD : PAD + ((ts - startTs) / (endTs - startTs)) * plotW;
  }
  function py(intensity: number | null): number {
    const v = Math.max(0, Math.min(5, intensity ?? 0));
    return PAD + plotH - (v / 5) * plotH;
  }

  const pts = updates.map((u) => ({
    x: px(new Date(u.created_at).getTime()),
    y: py(u.intensity),
  }));

  const elements: React.ReactElement[] = [];

  [0, 2.5, 5].forEach((v) => {
    const y = py(v);
    elements.push(
      <View
        key={`g${v}`}
        style={{
          position: 'absolute',
          left: PAD,
          right: PAD,
          top: y,
          height: 1,
          backgroundColor: 'rgba(255,255,255,0.07)',
        }}
      />,
    );
  });

  pts.forEach((p, i) => {
    if (i === 0) return;
    const prev = pts[i - 1]!;
    const dx   = p.x - prev.x;
    const dy   = p.y - prev.y;
    const len  = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const cx    = (prev.x + p.x) / 2;
    const cy    = (prev.y + p.y) / 2;
    elements.push(
      <View
        key={`l${i}`}
        style={{
          position: 'absolute',
          left: cx - len / 2,
          top:  cy - 0.75,
          width: len,
          height: 1.5,
          backgroundColor: color,
          transform: [{ rotate: `${angle}deg` }],
        }}
      />,
    );
  });

  pts.forEach((p, i) => {
    elements.push(
      <View
        key={`d${i}`}
        style={{
          position: 'absolute',
          left:         p.x - 3,
          top:          p.y - 3,
          width:        6,
          height:       6,
          borderRadius: 3,
          backgroundColor: color,
        }}
      />,
    );
  });

  return elements;
}

type FeatureCard = {
  label: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  onPress: () => void;
};

export default function DashboardScreen() {
  const [partsCount, setPartsCount] = useState<number | null>(null);
  const [backupDaysAgo, setBackupDaysAgo] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const db = getDatabase();
        const row = await db.getFirstAsync<{ count: number }>(
          'SELECT COUNT(*) AS count FROM parts'
        );
        setPartsCount(row?.count ?? 0);

        const raw = await SecureStore.getItemAsync('last_backup_at');
        if (!raw) {
          setBackupDaysAgo(null); // never backed up
        } else {
          const days = Math.floor(
            (Date.now() - new Date(raw).getTime()) / (1000 * 60 * 60 * 24)
          );
          setBackupDaysAgo(days);
        }
      }
      load();
    }, [])
  );

  async function handleSeed() {
    await seedTestData();
    router.replace('/(tabs)/explore');
  }

  // Still loading
  if (partsCount === null) return null;

  if (partsCount === 0) {
    return <FirstTimeState onSeed={handleSeed} />;
  }

  return (
    <ReturningState
      backupDaysAgo={backupDaysAgo}
      onSeed={handleSeed}
    />
  );
}

// ─── First-time state ──────────────────────────────────────────────────────

function FirstTimeState({ onSeed }: { onSeed: () => void }) {
  return (
    <SafeAreaView style={s.container}>
      <View style={s.firstTimeInner}>
        <Text style={s.appName}>Inner Atlas</Text>
        <Text style={s.subtitle}>Your internal map</Text>

        <View style={s.firstTimeCards}>
          <Pressable
            style={({ pressed }) => [s.firstTimeCard, pressed && s.pressed]}
            onPress={() => router.push('/assessment/first-mapping')}
          >
            <Ionicons name="compass-outline" size={32} color="#3B5BA5" style={s.firstTimeIcon} />
            <Text style={s.firstTimeCardTitle}>Explore Your System</Text>
            <Text style={s.firstTimeCardSub}>
              A guided journey to discover and name the parts of you
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [s.firstTimeCard, pressed && s.pressed]}
            onPress={() => router.push('/add-part')}
          >
            <Ionicons name="add-circle-outline" size={32} color="#3B5BA5" style={s.firstTimeIcon} />
            <Text style={s.firstTimeCardTitle}>Add a Part</Text>
            <Text style={s.firstTimeCardSub}>
              Name and describe a part you already know
            </Text>
          </Pressable>
        </View>

        {__DEV__ && (
          <Pressable style={s.devSeedBtn} onPress={onSeed}>
            <Text style={s.devSeedText}>⚡ Load Test Data</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Returning state ───────────────────────────────────────────────────────

function ReturningState({
  backupDaysAgo,
  onSeed,
}: {
  backupDaysAgo: number | null;
  onSeed: () => void;
}) {
  const showBackupWarning =
    backupDaysAgo === null || backupDaysAgo > 30;

  const backupLabel =
    backupDaysAgo === null
      ? 'Never backed up'
      : `Last backed up ${backupDaysAgo} day${backupDaysAgo === 1 ? '' : 's'} ago`;

  // ── Cycles mini widget state
  const [recentUpdates, setRecentUpdates] = useState<MiniUpdateRow[]>([]);
  const [topParts,      setTopParts]      = useState<MiniPartRow[]>([]);
  const [miniChartW,    setMiniChartW]    = useState(0);

  useFocusEffect(
    useCallback(() => {
      const db        = getDatabase();
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      db.getAllAsync<MiniUpdateRow>(
        `SELECT id, part_id, intensity, created_at FROM updates WHERE created_at >= ? ORDER BY created_at ASC`,
        [sevenDaysAgo],
      ).then((rows) => {
        const all = rows ?? [];
        setRecentUpdates(all);

        if (all.length < 2) {
          setTopParts([]);
          return;
        }

        // Top 3 most recently active parts
        const latestByPart = new Map<string, string>();
        for (const u of all) {
          const existing = latestByPart.get(u.part_id);
          if (!existing || u.created_at > existing) {
            latestByPart.set(u.part_id, u.created_at);
          }
        }
        const sorted = [...latestByPart.entries()]
          .sort((a, b) => (b[1] > a[1] ? 1 : -1))
          .slice(0, 3)
          .map(([id]) => id);

        if (sorted.length === 0) {
          setTopParts([]);
          return;
        }

        const placeholders = sorted.map(() => '?').join(',');
        db.getAllAsync<MiniPartRow>(
          `SELECT id, COALESCE(custom_name, name) AS display_name, type FROM parts WHERE id IN (${placeholders})`,
          sorted,
        ).then((prows) => setTopParts(prows ?? [])).catch(console.error);
      }).catch(console.error);
    }, []),
  );

  const cards: FeatureCard[] = [
    {
      label: 'My Parts',
      icon: 'people-outline',
      color: '#3B5BA5',
      onPress: () => router.push('/my-parts'),
    },
    {
      label: 'Parts Map',
      icon: 'map-outline',
      color: '#3B5BA5',
      onPress: () => router.push('/(tabs)/explore'),
    },
    {
      label: 'Dialogue',
      icon: 'chatbubbles-outline',
      color: '#3B5BA5',
      onPress: () => router.push({ pathname: '/my-parts', params: { mode: 'dialogue' } }),
    },
    {
      label: 'Relationships',
      icon: 'git-compare-outline',
      color: '#3B5BA5',
      onPress: () => router.push('/relationships' as any),
    },
    {
      label: 'Elaborate',
      icon: 'layers-outline',
      color: '#3B5BA5',
      onPress: () => router.push('/elaborate'),
    },
    {
      label: 'Techniques',
      icon: 'list-outline',
      color: '#3B5BA5',
      onPress: () => router.push('/techniques'),
    },
    {
      label: 'Updates',
      icon: 'time-outline',
      color: '#6B6860',
      onPress: () => router.push('/updates'),
    },
    {
      label: 'Cycles',
      icon: 'analytics-outline',
      color: '#3B5BA5',
      onPress: () => router.push('/cycles' as any),
    },
    {
      label: 'Assessment',
      icon: 'compass-outline',
      color: '#3B5BA5',
      onPress: () => router.push('/assessment/first-mapping'),
    },
  ];

  return (
    <SafeAreaView style={s.container}>
      <ScrollView
        style={s.flex1}
        contentContainerStyle={s.returningScroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.returningHeader}>
          <Text style={s.appName}>Inner Atlas</Text>
          <Pressable
            onPress={() => Alert.alert('Coming soon', 'Settings are in development.')}
            hitSlop={12}
          >
            <Ionicons name="settings-outline" size={22} color="#6B6860" />
          </Pressable>
        </View>

        {/* Feature card grid */}
        <View style={s.grid}>
          {cards.map((card) => {
            const cardColor = card.color ?? '#3B5BA5';
            return (
              <TouchableOpacity
                key={card.label}
                style={[s.glassCard, { borderColor: cardColor }]}
                activeOpacity={0.72}
                onPress={card.onPress}
              >
                <Ionicons name={card.icon} size={24} color={cardColor} />
                <Text style={[s.cardLabel, { color: cardColor }]}>{card.label}</Text>
                {card.subtitle && (
                  <Text style={s.cardSubtitle}>{card.subtitle}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Cycles mini widget — only if >= 2 updates in last 7 days */}
        {recentUpdates.length >= 2 && topParts.length > 0 && (
          <Pressable
            style={s.cyclesWidget}
            onPress={() => router.push('/cycles' as any)}
          >
            <View style={s.cyclesWidgetHeader}>
              <Text style={s.cyclesWidgetTitle}>Recent Cycles</Text>
              <Text style={s.cyclesWidgetViewAll}>View All →</Text>
            </View>
            <View
              style={s.cyclesMiniChart}
              onLayout={(e: LayoutChangeEvent) => setMiniChartW(e.nativeEvent.layout.width)}
            >
              {topParts.map((part) => {
                const partUpdates = recentUpdates.filter((u) => u.part_id === part.id);
                if (partUpdates.length < 1) return null;
                const color = TYPE_COLOR_MAP[part.type] ?? '#6B6860';
                const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
                const now = new Date();
                return (
                  <View key={part.id} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
                    {renderMiniChartElements(miniChartW, 100, partUpdates, color, sevenDaysAgo, now)}
                  </View>
                );
              })}
            </View>
          </Pressable>
        )}

        {/* Backup reminder */}
        {showBackupWarning && (
          <Text style={s.backupReminder}>{backupLabel}</Text>
        )}

        {__DEV__ && (
          <Pressable style={s.devSeedBtn} onPress={onSeed}>
            <Text style={s.devSeedText}>⚡ Load Test Data</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  flex1: {
    flex: 1,
  },

  // First-time state
  firstTimeInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  appName: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1C1B19',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 17,
    color: '#6B6860',
    marginTop: 6,
    marginBottom: 40,
    textAlign: 'center',
  },
  firstTimeCards: {
    width: '100%',
    gap: 16,
  },
  firstTimeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    padding: 24,
    shadowColor: '#1C1B19',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  firstTimeIcon: {
    marginBottom: 12,
  },
  firstTimeCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1B19',
    marginBottom: 6,
  },
  firstTimeCardSub: {
    fontSize: 14,
    color: '#6B6860',
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.72,
  },

  // Returning state
  returningScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  returningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  glassCard: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 8,
    minHeight: 80,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#6B6860',
    textAlign: 'center',
    marginTop: -4,
  },

  // Cycles mini widget
  cyclesWidget: {
    marginTop:       16,
    backgroundColor: '#1A1917',
    borderRadius:    12,
    padding:         12,
    overflow:        'hidden',
  },
  cyclesWidgetHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   8,
  },
  cyclesWidgetTitle: {
    fontSize:   13,
    fontWeight: '600',
    color:      'rgba(255,255,255,0.8)',
  },
  cyclesWidgetViewAll: {
    fontSize: 12,
    color:    '#B88A00',
    fontWeight: '500',
  },
  cyclesMiniChart: {
    height:   100,
    position: 'relative',
    overflow: 'hidden',
  },

  // Backup reminder
  backupReminder: {
    marginTop: 20,
    fontSize: 12,
    color: '#C2600A',
    textAlign: 'center',
  },

  // Dev seed
  devSeedBtn: {
    marginTop: 32,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E3DE',
  },
  devSeedText: {
    fontSize: 12,
    color: '#6B6860',
  },
});
