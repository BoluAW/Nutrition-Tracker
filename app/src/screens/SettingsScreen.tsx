import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AnalyzeError, pingServer } from '../lib/api';
import { parseTimeString } from '../lib/date';
import {
  cancelAll,
  ensurePermissions,
  isPhysicalDevice,
  scheduledCount,
  sendTestNotification,
} from '../lib/notifications';
import { useStore } from '../lib/store';
import { colors, radius, spacing } from '../lib/theme';

export function SettingsScreen() {
  const { settings, updateSettings, syncReminders } = useStore();
  const [serverDraft, setServerDraft] = useState(settings.serverUrl);
  const [testing, setTesting] = useState(false);
  const [scheduled, setScheduled] = useState<number | null>(null);

  useEffect(() => {
    setServerDraft(settings.serverUrl);
  }, [settings.serverUrl]);

  const refreshScheduled = () => {
    scheduledCount()
      .then(setScheduled)
      .catch(() => setScheduled(null));
  };

  useEffect(refreshScheduled, [settings.reminders]);

  const setGoal = (key: 'calories' | 'protein' | 'waterMl', raw: string) => {
    const value = Number(raw.replace(/[^0-9]/g, ''));
    updateSettings({ goals: { ...settings.goals, [key]: Number.isFinite(value) ? value : 0 } });
  };

  const setMealTime = (index: number, value: string) => {
    const next = [...settings.reminders.mealTimes];
    next[index] = value;
    updateSettings({ reminders: { ...settings.reminders, mealTimes: next } });
  };

  const addMealTime = () => {
    updateSettings({
      reminders: {
        ...settings.reminders,
        mealTimes: [...settings.reminders.mealTimes, '16:00'],
      },
    });
  };

  const removeMealTime = (index: number) => {
    updateSettings({
      reminders: {
        ...settings.reminders,
        mealTimes: settings.reminders.mealTimes.filter((_, i) => i !== index),
      },
    });
  };

  const toggleReminders = async (enabled: boolean) => {
    if (enabled) {
      const granted = await ensurePermissions();
      if (!granted) {
        Alert.alert(
          'Notifications are blocked',
          'Turn them on for this app in your phone settings, then flip this switch again.',
        );
        return;
      }
    } else {
      await cancelAll();
    }
    await updateSettings({ reminders: { ...settings.reminders, enabled } });
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const result = await pingServer(serverDraft);
      Alert.alert(
        'Server is reachable',
        result.model
          ? `Connected. It's using ${result.model}.`
          : 'Connected, but the server did not report a model.',
      );
    } catch (err) {
      Alert.alert(
        "Couldn't connect",
        err instanceof AnalyzeError ? err.message : 'Unknown error.',
      );
    } finally {
      setTesting(false);
    }
  };

  const testNotification = async () => {
    const granted = await ensurePermissions();
    if (!granted) {
      Alert.alert('Notifications are blocked', 'Enable them for this app in your phone settings.');
      return;
    }
    await sendTestNotification();
    Alert.alert('Sent', 'A test notification will arrive in about five seconds.');
  };

  const applyReminders = async () => {
    const granted = await ensurePermissions();
    if (!granted) {
      Alert.alert('Notifications are blocked', 'Enable them for this app in your phone settings.');
      return;
    }
    const count = await syncReminders();
    setScheduled(count);
    Alert.alert('Reminders updated', `${count} daily reminder${count === 1 ? '' : 's'} scheduled.`);
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Settings</Text>

        <Section title="Daily goals">
          <Field
            label="Calories"
            suffix="kcal"
            value={String(settings.goals.calories)}
            onChangeText={(v) => setGoal('calories', v)}
          />
          <Field
            label="Protein"
            suffix="g"
            value={String(settings.goals.protein)}
            onChangeText={(v) => setGoal('protein', v)}
          />
          <Field
            label="Water"
            suffix="ml"
            value={String(settings.goals.waterMl)}
            onChangeText={(v) => setGoal('waterMl', v)}
          />
        </Section>

        <Section title="AI analyzer">
          <Text style={styles.help}>
            The address of the server in this repo. On your home network it looks like
            http://192.168.1.20:8787 — your computer's IP, not localhost, because the phone needs
            to reach it.
          </Text>
          <TextInput
            style={styles.input}
            value={serverDraft}
            onChangeText={setServerDraft}
            onBlur={() => updateSettings({ serverUrl: serverDraft.trim() })}
            placeholder="http://192.168.1.20:8787"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Pressable style={styles.button} onPress={testConnection} disabled={testing}>
            {testing ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.buttonText}>Test connection</Text>
            )}
          </Pressable>
        </Section>

        <Section title="Reminders">
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.switchLabel}>Daily reminders</Text>
              <Text style={styles.switchHelp}>
                Meal nudges, water nudges and an evening check-in that tells you what's left.
              </Text>
            </View>
            <Switch
              value={settings.reminders.enabled}
              onValueChange={toggleReminders}
              trackColor={{ true: colors.protein, false: colors.border }}
            />
          </View>

          {settings.reminders.enabled && (
            <>
              <Text style={styles.subheading}>Meal times</Text>
              {settings.reminders.mealTimes.map((time, index) => {
                const valid = parseTimeString(time) !== null;
                return (
                  <View key={index} style={styles.timeRow}>
                    <TextInput
                      style={[styles.timeInput, !valid && styles.invalid]}
                      value={time}
                      onChangeText={(v) => setMealTime(index, v)}
                      placeholder="13:00"
                      placeholderTextColor={colors.textFaint}
                      keyboardType="numbers-and-punctuation"
                    />
                    <Pressable onPress={() => removeMealTime(index)} style={styles.removeButton}>
                      <Text style={styles.removeText}>Remove</Text>
                    </Pressable>
                  </View>
                );
              })}
              <Pressable style={styles.button} onPress={addMealTime}>
                <Text style={styles.buttonText}>Add a meal time</Text>
              </Pressable>

              <Text style={styles.subheading}>Water nudges</Text>
              <Field
                label="Every"
                suffix="hours"
                value={String(settings.reminders.waterEveryHours)}
                onChangeText={(v) =>
                  updateSettings({
                    reminders: {
                      ...settings.reminders,
                      waterEveryHours: Math.max(1, Number(v.replace(/[^0-9]/g, '')) || 1),
                    },
                  })
                }
              />
              <Field
                label="From"
                suffix="h"
                value={String(settings.reminders.waterStartHour)}
                onChangeText={(v) =>
                  updateSettings({
                    reminders: {
                      ...settings.reminders,
                      waterStartHour: Math.min(23, Number(v.replace(/[^0-9]/g, '')) || 0),
                    },
                  })
                }
              />
              <Field
                label="Until"
                suffix="h"
                value={String(settings.reminders.waterEndHour)}
                onChangeText={(v) =>
                  updateSettings({
                    reminders: {
                      ...settings.reminders,
                      waterEndHour: Math.min(23, Number(v.replace(/[^0-9]/g, '')) || 0),
                    },
                  })
                }
              />

              <View style={styles.switchRow}>
                <View style={styles.switchText}>
                  <Text style={styles.switchLabel}>Evening check-in</Text>
                  <Text style={styles.switchHelp}>
                    At {settings.reminders.eveningCheckInTime}, tells you how much protein and how
                    many calories you still have left.
                  </Text>
                </View>
                <Switch
                  value={settings.reminders.eveningCheckIn}
                  onValueChange={(v) =>
                    updateSettings({ reminders: { ...settings.reminders, eveningCheckIn: v } })
                  }
                  trackColor={{ true: colors.protein, false: colors.border }}
                />
              </View>
              {settings.reminders.eveningCheckIn && (
                <Field
                  label="Check-in time"
                  value={settings.reminders.eveningCheckInTime}
                  onChangeText={(v) =>
                    updateSettings({
                      reminders: { ...settings.reminders, eveningCheckInTime: v },
                    })
                  }
                  numeric={false}
                />
              )}

              <Pressable style={styles.primaryButton} onPress={applyReminders}>
                <Text style={styles.primaryButtonText}>Apply reminder schedule</Text>
              </Pressable>
              <Pressable style={styles.button} onPress={testNotification}>
                <Text style={styles.buttonText}>Send a test notification</Text>
              </Pressable>
              <Text style={styles.status}>
                {scheduled === null
                  ? ' '
                  : `${scheduled} reminder${scheduled === 1 ? '' : 's'} currently scheduled.`}
                {!isPhysicalDevice() && ' Reminders behave best on a real phone, not a simulator.'}
              </Text>
            </>
          )}
        </Section>

        <Text style={styles.footer}>
          Everything you log stays on this phone. Photos are sent to your own analyzer server for
          the estimate and are not stored there.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({
  label,
  suffix,
  value,
  onChangeText,
  numeric = true,
}: {
  label: string;
  suffix?: string;
  value: string;
  onChangeText: (v: string) => void;
  numeric?: boolean;
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldInputWrap}>
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          keyboardType={numeric ? 'number-pad' : 'numbers-and-punctuation'}
          selectTextOnFocus
        />
        {suffix ? <Text style={styles.fieldSuffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  heading: { color: colors.text, fontSize: 30, fontWeight: '700', marginBottom: spacing.lg },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: spacing.md },
  subheading: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  help: { color: colors.textFaint, fontSize: 12.5, lineHeight: 18, marginBottom: spacing.md },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  fieldLabel: { color: colors.textMuted, fontSize: 14 },
  fieldInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
  },
  fieldInput: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: spacing.sm,
    minWidth: 70,
    textAlign: 'right',
  },
  fieldSuffix: { color: colors.textFaint, fontSize: 12, marginLeft: spacing.sm },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    color: colors.text,
    fontSize: 14,
    padding: spacing.md,
  },
  button: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  primaryButton: {
    backgroundColor: colors.protein,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  switchText: { flex: 1 },
  switchLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  switchHelp: { color: colors.textFaint, fontSize: 12, marginTop: 2, lineHeight: 17 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  timeInput: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    color: colors.text,
    fontSize: 16,
    padding: spacing.md,
  },
  invalid: { borderWidth: 1, borderColor: colors.danger },
  removeButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  removeText: { color: colors.textFaint, fontSize: 13 },
  status: { color: colors.textFaint, fontSize: 12, marginTop: spacing.md, lineHeight: 17 },
  footer: {
    color: colors.textFaint,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
});
