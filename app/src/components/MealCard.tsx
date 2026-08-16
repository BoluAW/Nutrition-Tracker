import React from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatTime } from '../lib/date';
import { colors, radius, spacing } from '../lib/theme';
import { MealEntry } from '../lib/types';

type Props = {
  meal: MealEntry;
  onDelete?: (id: string) => void;
};

const CONFIDENCE_LABEL: Record<MealEntry['confidence'], string> = {
  high: 'Confident estimate',
  medium: 'Rough estimate',
  low: 'Very rough — worth double-checking',
};

export function MealCard({ meal, onDelete }: Props) {
  const confirmDelete = () => {
    if (!onDelete) return;
    Alert.alert('Delete this entry?', meal.title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(meal.id) },
    ]);
  };

  return (
    <Pressable
      style={styles.card}
      onLongPress={confirmDelete}
      android_ripple={{ color: colors.border }}>
      <View style={styles.header}>
        {meal.photoUri ? (
          <Image source={{ uri: meal.photoUri }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <Text style={styles.thumbEmoji}>{meal.source === 'text' ? '💬' : '🍽️'}</Text>
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={2}>
            {meal.title}
          </Text>
          <Text style={styles.time}>
            {formatTime(meal.loggedAt)} · {CONFIDENCE_LABEL[meal.confidence]}
          </Text>
        </View>
      </View>

      <View style={styles.macros}>
        <Macro label="kcal" value={Math.round(meal.calories)} color={colors.calories} />
        <Macro label="protein" value={`${Math.round(meal.protein)}g`} color={colors.protein} />
        <Macro label="carbs" value={`${Math.round(meal.carbs)}g`} color={colors.carbs} />
        <Macro label="fat" value={`${Math.round(meal.fat)}g`} color={colors.fat} />
      </View>

      {meal.items.length > 0 && (
        <View style={styles.items}>
          {meal.items.map((item, i) => (
            <Text key={`${item.name}-${i}`} style={styles.item} numberOfLines={1}>
              • {item.name}
              {item.quantity ? ` (${item.quantity})` : ''} — {Math.round(item.calories)} kcal,{' '}
              {Math.round(item.protein)}g protein
            </Text>
          ))}
        </View>
      )}

      {meal.note ? <Text style={styles.note}>{meal.note}</Text> : null}
      {onDelete ? <Text style={styles.hint}>Long-press to delete</Text> : null}
    </Pressable>
  );
}

function Macro({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <View style={styles.macro}>
      <Text style={[styles.macroValue, { color }]}>{value}</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: { flexDirection: 'row', gap: spacing.md },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  thumbEmoji: { fontSize: 24 },
  headerText: { flex: 1, justifyContent: 'center' },
  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  time: { color: colors.textFaint, fontSize: 12, marginTop: 3 },
  macros: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  macro: { alignItems: 'center', flex: 1 },
  macroValue: { fontSize: 17, fontWeight: '700' },
  macroLabel: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  items: { marginTop: spacing.md, gap: 3 },
  item: { color: colors.textMuted, fontSize: 12.5 },
  note: { color: colors.textFaint, fontSize: 12, marginTop: spacing.sm, fontStyle: 'italic' },
  hint: { color: colors.textFaint, fontSize: 10.5, marginTop: spacing.sm, opacity: 0.6 },
});
