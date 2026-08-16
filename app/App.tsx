import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ensurePermissions } from './src/lib/notifications';
import { StoreProvider, useStore } from './src/lib/store';
import { colors, spacing } from './src/lib/theme';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { LogScreen } from './src/screens/LogScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { WaterScreen } from './src/screens/WaterScreen';

type Tab = 'today' | 'log' | 'water' | 'history' | 'settings';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'today', label: 'Today', icon: '🏠' },
  { key: 'log', label: 'Log', icon: '📸' },
  { key: 'water', label: 'Water', icon: '💧' },
  { key: 'history', label: 'History', icon: '📈' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
];

function Shell() {
  const { ready, settings } = useStore();
  const [tab, setTab] = useState<Tab>('today');

  // Ask once on first launch, so the reminders the user configured can actually fire.
  useEffect(() => {
    if (!ready || !settings.reminders.enabled) return;
    ensurePermissions().catch(() => {
      // Denied is a valid answer; Settings shows the state and can re-prompt.
    });
  }, [ready, settings.reminders.enabled]);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.protein} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.body}>
        {tab === 'today' && (
          <TodayScreen onLogFood={() => setTab('log')} onOpenWater={() => setTab('water')} />
        )}
        {tab === 'log' && (
          <LogScreen onLogged={() => setTab('today')} onOpenSettings={() => setTab('settings')} />
        )}
        {tab === 'water' && <WaterScreen />}
        {tab === 'history' && <HistoryScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </View>

      <View style={styles.tabBar}>
        {TABS.map((item) => {
          const active = item.key === tab;
          return (
            <Pressable key={item.key} style={styles.tab} onPress={() => setTab(item.key)}>
              <Text style={[styles.tabIcon, !active && styles.tabInactive]}>{item.icon}</Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="light" />
        <Shell />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingTop: spacing.sm,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
  tabIcon: { fontSize: 20 },
  tabInactive: { opacity: 0.5 },
  tabLabel: { color: colors.textFaint, fontSize: 10.5, marginTop: 2 },
  tabLabelActive: { color: colors.text, fontWeight: '600' },
});
