import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatTime, todayKey } from '../lib/date';
import { useStore } from '../lib/store';
import { colors, radius, spacing } from '../lib/theme';

const QUICK_AMOUNTS = [
  { label: 'Glass', ml: 250, emoji: '🥛' },
  { label: 'Big glass', ml: 400, emoji: '🍶' },
  { label: 'Bottle', ml: 500, emoji: '🧴' },
  { label: 'Large bottle', ml: 750, emoji: '💧' },
];

export function WaterScreen() {
  const { settings, todayTotals, waterFor, addWater, undoLastWater } = useStore();
  const entries = waterFor(todayKey());
  const goal = settings.goals.waterMl;
  const pct = goal > 0 ? Math.min(1, todayTotals.waterMl / goal) : 0;
  const remaining = Math.max(0, goal - todayTotals.waterMl);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Water</Text>
      <Text style={styles.sub}>
        {remaining === 0
          ? "Goal hit for today. Well done."
          : `${(remaining / 1000).toFixed(2)}L to go today.`}
      </Text>

      <View style={styles.hero}>
        {/* A vertical fill reads more like a glass filling up than a bar would. */}
        <View style={styles.glass}>
          <View style={[styles.glassFill, { height: `${pct * 100}%` }]} />
          <View style={styles.glassLabel}>
            <Text style={styles.glassValue}>{(todayTotals.waterMl / 1000).toFixed(2)}L</Text>
            <Text style={styles.glassGoal}>of {(goal / 1000).toFixed(1)}L</Text>
            <Text style={styles.glassPct}>{Math.round(pct * 100)}%</Text>
          </View>
        </View>
      </View>

      <View style={styles.grid}>
        {QUICK_AMOUNTS.map((amount) => (
          <Pressable
            key={amount.ml}
            style={styles.amountButton}
            onPress={() => addWater(amount.ml)}>
            <Text style={styles.amountEmoji}>{amount.emoji}</Text>
            <Text style={styles.amountLabel}>{amount.label}</Text>
            <Text style={styles.amountMl}>{amount.ml}ml</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.undo, entries.length === 0 && styles.disabled]}
        disabled={entries.length === 0}
        onPress={undoLastWater}>
        <Text style={styles.undoText}>Undo last drink</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Today's drinks</Text>
      {entries.length === 0 ? (
        <Text style={styles.empty}>Nothing logged yet. Tap an amount above.</Text>
      ) : (
        <View style={styles.list}>
          {entries.map((entry) => (
            <View key={entry.id} style={styles.listRow}>
              <Text style={styles.listAmount}>{entry.amountMl}ml</Text>
              <Text style={styles.listTime}>{formatTime(entry.loggedAt)}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  heading: { color: colors.text, fontSize: 30, fontWeight: '700' },
  sub: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  hero: { alignItems: 'center', marginVertical: spacing.xl },
  glass: {
    width: 150,
    height: 200,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  glassFill: { width: '100%', backgroundColor: 'rgba(56,189,248,0.35)' },
  glassLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassValue: { color: colors.text, fontSize: 30, fontWeight: '700' },
  glassGoal: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  glassPct: { color: colors.water, fontSize: 15, fontWeight: '600', marginTop: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  amountButton: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  amountEmoji: { fontSize: 26 },
  amountLabel: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: spacing.sm },
  amountMl: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  undo: { alignItems: 'center', paddingVertical: spacing.lg, marginTop: spacing.sm },
  undoText: { color: colors.textMuted, fontSize: 14 },
  disabled: { opacity: 0.35 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.md },
  empty: { color: colors.textFaint, fontSize: 14 },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  listAmount: { color: colors.water, fontSize: 15, fontWeight: '600' },
  listTime: { color: colors.textFaint, fontSize: 13 },
});
