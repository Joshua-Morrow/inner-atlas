import '../global.css';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { initDatabase } from '@/lib/database';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    initDatabase()
      .then(() => setDbReady(true))
      .catch((err) => {
        // Database init failure is unrecoverable — surface clearly
        console.error('Database initialization failed:', err);
      });
  }, []);

  if (!dbReady) {
    // Blank screen while DB initializes — no content before DB is ready
    return <View className="flex-1 bg-background" />;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="assessment" options={{ headerShown: false }} />
        <Stack.Screen name="fog-explore" options={{ headerShown: false }} />
        <Stack.Screen name="part-profile" options={{ headerShown: false }} />
        <Stack.Screen name="add-part" options={{ headerShown: false }} />
        <Stack.Screen name="my-parts" options={{ headerShown: false }} />
        <Stack.Screen name="refine-part" options={{ headerShown: false }} />
        <Stack.Screen name="coming-soon" options={{ headerShown: false }} />
        <Stack.Screen name="dialogue" options={{ headerShown: false }} />
        <Stack.Screen name="dialogue-start" options={{ headerShown: false }} />
        <Stack.Screen name="dialogue-session" options={{ headerShown: false }} />
        <Stack.Screen name="techniques" options={{ headerShown: false }} />
        <Stack.Screen name="technique-detail" options={{ headerShown: false }} />
        <Stack.Screen name="technique-session" options={{ headerShown: false }} />
        <Stack.Screen name="technique-log" options={{ headerShown: false }} />
        <Stack.Screen name="breathing-timer" options={{ headerShown: false }} />
        <Stack.Screen name="updates" options={{ headerShown: false }} />
        <Stack.Screen name="log-update" options={{ headerShown: false }} />
        <Stack.Screen name="update-detail" options={{ headerShown: false }} />
        <Stack.Screen name="trailhead" options={{ headerShown: false }} />
        <Stack.Screen name="trailhead/new" options={{ headerShown: false }} />
        <Stack.Screen name="trailhead/session" options={{ headerShown: false }} />
        <Stack.Screen name="trailhead/transition" options={{ headerShown: false }} />
        <Stack.Screen name="trailhead/integration" options={{ headerShown: false }} />
        <Stack.Screen name="trailhead/reentry" options={{ headerShown: false }} />
        <Stack.Screen name="trailhead-session" options={{ headerShown: false }} />
        <Stack.Screen name="trailhead-review" options={{ headerShown: false }} />
        <Stack.Screen name="elaborate" options={{ headerShown: false }} />
        <Stack.Screen name="elaboration-session" options={{ headerShown: false }} />
        <Stack.Screen name="elaboration-review" options={{ headerShown: false }} />
        <Stack.Screen name="elaboration-menu" options={{ headerShown: false }} />
        <Stack.Screen name="descriptor-explorer" options={{ headerShown: false }} />
        <Stack.Screen name="guided-exploration" options={{ headerShown: false }} />
        <Stack.Screen name="getting-to-know" options={{ headerShown: false }} />
        <Stack.Screen name="relationships" options={{ headerShown: false }} />
        <Stack.Screen name="feeling-edge-detail" options={{ headerShown: false }} />
        <Stack.Screen name="add-feeling-connection" options={{ headerShown: false }} />
        <Stack.Screen name="new-relationship" options={{ headerShown: false }} />
        <Stack.Screen name="relationship-profile" options={{ headerShown: false }} />
        <Stack.Screen name="relationship-members" options={{ headerShown: false }} />
        <Stack.Screen name="cycles" options={{ headerShown: false }} />
        <Stack.Screen name="part-image-picker" options={{ headerShown: false }} />
        <Stack.Screen name="update-saved" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
