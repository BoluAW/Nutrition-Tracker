import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../lib/theme';

type Props = {
  label: string;
  value: number;
  goal: number;
  unit: string;
  color: string;
};

/**
 * A horizontal progress bar with the numbers above it. Called a "ring" because
 * that's the mental model — it's drawn as a bar so the app stays dependency-free
 * (no SVG/skia), which keeps it running in Expo Go without a custom build.
 */
export function Ring({ label, value, goal, unit, color }: Props) {
  const rounded = Math.round(value);
  const pct = goal > 0 ? Math.min(1, value / goal) : 0;
  const over = goal > 0 && value > goal;
  const remaining = Math.max(0, Math.round(goal - value));

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.remaining}>
          {over ? `${Math.round(value - goal)}${unit} over` : `${remaining}${unit} left`}
        </Text>
      </View>
      <View style={styles.numbers}>
        <Text style={[styles.value, { color }]}>{rounded.toLocaleString()}</Text>
        <Text style={styles.goal}>
          {' '}
          / {goal.toLocaleString()}
          {unit}
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${pct * 100}%`, backgroundColor: over ? colors.danger : color },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  remaining: { color: colors.textFaint, fontSize: 12 },
  numbers: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  value: { fontSize: 26, fontWeight: '700' },
  goal: { color: colors.textFaint, fontSize: 14 },
  track: {
    height: 8,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.pill,
    marginTop: 8,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill },
});
