import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MealCard } from '../components/MealCard';
import { Ring } from '../components/Ring';
import { todayKey } from '../lib/date';
import { useStore } from '../lib/store';
import { colors, radius, spacing } from '../lib/theme';

type Props = {
  onLogFood: () => void;
  onOpenWater: () => void;
};

export function TodayScreen({ onLogFood, onOpenWater }: Props) {
  const { settings, todayTotals, mealsFor, removeMeal } = useStore();
  const meals = mealsFor(todayKey());
  const { goals } = settings;

  const waterPct = goals.waterMl > 0 ? Math.min(1, todayTotals.waterMl / goals.waterMl) : 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.greeting}>Today</Text>
      <Text style={styles.subtitle}>
        {meals.length === 0
          ? 'Nothing logged yet.'
          : `${meals.length} ${meals.length === 1 ? 'entry' : 'entries'} logged.`}
      </Text>

      <View style={styles.card}>
        <Ring
          label="Calories"
          value={todayTotals.calories}
          goal={goals.calories}
          unit=" kcal"
          color={colors.calories}
        />
        <Ring
          label="Protein"
          value={todayTotals.protein}
          goal={goals.protein}
          unit="g"
          color={colors.protein}
        />
        <View style={styles.macroRow}>
          <SmallStat label="Carbs" value={`${Math.round(todayTotals.carbs)}g`} color={colors.carbs} />
          <SmallStat label="Fat" value={`${Math.round(todayTotals.fat)}g`} color={colors.fat} />
        </View>
      </View>

      <Pressable style={styles.waterCard} onPress={onOpenWater}>
        <View style={styles.waterHeader}>
          <Text style={styles.waterTitle}>💧 Water</Text>
          <Text style={styles.waterValue}>
            {(todayTotals.waterMl / 1000).toFixed(2)}L
            <Text style={styles.waterGoal}> / {(goals.waterMl / 1000).toFixed(1)}L</Text>
          </Text>
        </View>
        <View style={styles.waterTrack}>
          <View style={[styles.waterFill, { width: `${waterPct * 100}%` }]} />
        </View>
        <Text style={styles.waterHint}>Tap to add a glass</Text>
      </Pressable>

      <Pressable style={styles.cta} onPress={onLogFood}>
        <Text style={styles.ctaText}>📸  Log food with AI</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Today's meals</Text>
      {meals.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🍳</Text>
          <Text style={styles.emptyText}>
            Snap a photo of your food or just describe it — the AI works out the calories and
            protein for you.
          </Text>
        </View>
      ) : (
        meals.map((meal) => <MealCard key={meal.id} meal={meal} onDelete={removeMeal} />)
      )}
    </ScrollView>
  );
}

function SmallStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.smallStat}>
      <Text style={[styles.smallStatValue, { color }]}>{value}</Text>
      <Text style={styles.smallStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  greeting: { color: colors.text, fontSize: 32, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: 14, marginTop: 2, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  macroRow: { flexDirection: 'row', gap: spacing.md },
  smallStat: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  smallStatValue: { fontSize: 18, fontWeight: '700' },
  smallStatLabel: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  waterCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  waterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  waterTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  waterValue: { color: colors.water, fontSize: 18, fontWeight: '700' },
  waterGoal: { color: colors.textFaint, fontSize: 13, fontWeight: '400' },
  waterTrack: {
    height: 8,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.pill,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  waterFill: { height: '100%', backgroundColor: colors.water, borderRadius: radius.pill },
  waterHint: { color: colors.textFaint, fontSize: 11, marginTop: spacing.sm },
  cta: {
    backgroundColor: colors.protein,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyEmoji: { fontSize: 34, marginBottom: spacing.md },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
