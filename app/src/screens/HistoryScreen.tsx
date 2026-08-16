import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MealCard } from '../components/MealCard';
import { formatDateKey, recentDateKeys } from '../lib/date';
import { useStore } from '../lib/store';
import { colors, radius, spacing } from '../lib/theme';

const DAYS_SHOWN = 7;

export function HistoryScreen() {
  const { settings, totalsFor, mealsFor, removeMeal } = useStore();
  const [expanded, setExpanded] = useState<string | null>(null);
  const days = recentDateKeys(DAYS_SHOWN);
  const { goals } = settings;

  const loggedDays = days.filter((key) => {
    const t = totalsFor(key);
    return t.calories > 0 || t.waterMl > 0;
  });

  const avgCalories =
    loggedDays.length > 0
      ? loggedDays.reduce((sum, key) => sum + totalsFor(key).calories, 0) / loggedDays.length
      : 0;
  const avgProtein =
    loggedDays.length > 0
      ? loggedDays.reduce((sum, key) => sum + totalsFor(key).protein, 0) / loggedDays.length
      : 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Last 7 days</Text>
      <Text style={styles.sub}>
        {loggedDays.length === 0
          ? 'No history yet — log a meal and it shows up here.'
          : `Averaging ${Math.round(avgCalories).toLocaleString()} kcal and ${Math.round(
              avgProtein,
            )}g protein on the ${loggedDays.length} ${
              loggedDays.length === 1 ? 'day' : 'days'
            } you logged.`}
      </Text>

      {days.map((key) => {
        const totals = totalsFor(key);
        const meals = mealsFor(key);
        const isOpen = expanded === key;
        const calPct = goals.calories > 0 ? Math.min(1, totals.calories / goals.calories) : 0;
        const proPct = goals.protein > 0 ? Math.min(1, totals.protein / goals.protein) : 0;
        const waterPct = goals.waterMl > 0 ? Math.min(1, totals.waterMl / goals.waterMl) : 0;
        const empty = totals.calories === 0 && totals.waterMl === 0;

        return (
          <View key={key} style={styles.dayCard}>
            <Pressable
              onPress={() => setExpanded(isOpen ? null : key)}
              disabled={meals.length === 0}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayName}>{formatDateKey(key)}</Text>
                <Text style={styles.dayMeta}>
                  {empty
                    ? 'nothing logged'
                    : `${Math.round(totals.calories).toLocaleString()} kcal · ${Math.round(
                        totals.protein,
                      )}g protein`}
                </Text>
              </View>

              {!empty && (
                <View style={styles.bars}>
                  <Bar pct={calPct} color={colors.calories} />
                  <Bar pct={proPct} color={colors.protein} />
                  <Bar pct={waterPct} color={colors.water} />
                </View>
              )}

              {meals.length > 0 && (
                <Text style={styles.toggle}>
                  {isOpen ? 'Hide' : `Show ${meals.length} ${meals.length === 1 ? 'entry' : 'entries'}`}
                </Text>
              )}
            </Pressable>

            {isOpen && (
              <View style={styles.expanded}>
                {meals.map((meal) => (
                  <MealCard key={meal.id} meal={meal} onDelete={removeMeal} />
                ))}
              </View>
            )}
          </View>
        );
      })}

      <View style={styles.legend}>
        <LegendDot color={colors.calories} label="Calories" />
        <LegendDot color={colors.protein} label="Protein" />
        <LegendDot color={colors.water} label="Water" />
      </View>
    </ScrollView>
  );
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  heading: { color: colors.text, fontSize: 30, fontWeight: '700' },
  sub: { color: colors.textMuted, fontSize: 14, marginTop: 2, marginBottom: spacing.lg, lineHeight: 20 },
  dayCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  dayName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  dayMeta: { color: colors.textMuted, fontSize: 12.5 },
  bars: { gap: 5, marginTop: spacing.md },
  barTrack: {
    height: 6,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: radius.pill },
  toggle: { color: colors.protein, fontSize: 12.5, marginTop: spacing.md },
  expanded: { marginTop: spacing.lg },
  legend: { flexDirection: 'row', gap: spacing.lg, justifyContent: 'center', marginTop: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: colors.textFaint, fontSize: 12 },
});
