import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AnalysisResult, analyzePhoto, analyzeText, AnalyzeError } from '../lib/api';
import { useStore } from '../lib/store';
import { colors, radius, spacing } from '../lib/theme';

type Pending = {
  result: AnalysisResult;
  source: 'photo' | 'text';
  photoUri?: string;
};

type Props = {
  onLogged: () => void;
  onOpenSettings: () => void;
};

const QUICK_PROMPTS = [
  'Chicken breast, rice and broccoli',
  'Two eggs on toast with butter',
  'Protein shake with a banana',
];

export function LogScreen({ onLogged, onOpenSettings }: Props) {
  const { settings, addMeal } = useStore();
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState<'photo' | 'text' | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serverConfigured = settings.serverUrl.trim().length > 0;

  const handleError = (err: unknown) => {
    const message =
      err instanceof AnalyzeError
        ? err.message
        : "Something went wrong analyzing that. Give it another go.";
    setError(message);
  };

  const runPhoto = async (mode: 'camera' | 'library') => {
    setError(null);

    const permission =
      mode === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(
        mode === 'camera'
          ? 'Camera access is off. Enable it for this app in your phone settings.'
          : 'Photo library access is off. Enable it in your phone settings.',
      );
      return;
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      // Downscaling keeps the upload small; the model doesn't need full resolution
      // to tell a chicken breast from a burger.
      quality: 0.6,
      base64: true,
      exif: false,
    };

    const picked =
      mode === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    if (picked.canceled || picked.assets.length === 0) return;
    const asset = picked.assets[0];
    if (!asset.base64) {
      setError("Couldn't read that image. Try taking the photo again.");
      return;
    }

    setBusy('photo');
    try {
      const result = await analyzePhoto(
        settings.serverUrl,
        asset.base64,
        asset.mimeType ?? 'image/jpeg',
        description.trim() || undefined,
      );
      setPending({ result, source: 'photo', photoUri: asset.uri });
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(null);
    }
  };

  const runText = async () => {
    const text = description.trim();
    if (!text) return;
    setError(null);
    setBusy('text');
    try {
      const result = await analyzeText(settings.serverUrl, text);
      setPending({ result, source: 'text' });
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!pending) return;
    await addMeal(pending.result, pending.source, pending.photoUri);
    setPending(null);
    setDescription('');
    onLogged();
  };

  const editAmount = (field: 'calories' | 'protein', delta: number) => {
    setPending((prev) =>
      prev
        ? {
            ...prev,
            result: {
              ...prev.result,
              [field]: Math.max(0, prev.result[field] + delta),
            },
          }
        : prev,
    );
  };

  if (pending) {
    const { result } = pending;
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Does this look right?</Text>
        <Text style={styles.sub}>
          Nudge the numbers if the AI misjudged your portion, then save.
        </Text>

        {pending.photoUri && (
          <Image source={{ uri: pending.photoUri }} style={styles.preview} />
        )}

        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>{result.title}</Text>

          <View style={styles.adjustRow}>
            <View style={styles.adjustInfo}>
              <Text style={[styles.adjustValue, { color: colors.calories }]}>
                {Math.round(result.calories)}
              </Text>
              <Text style={styles.adjustLabel}>calories</Text>
            </View>
            <View style={styles.adjustButtons}>
              <StepButton label="−50" onPress={() => editAmount('calories', -50)} />
              <StepButton label="+50" onPress={() => editAmount('calories', 50)} />
            </View>
          </View>

          <View style={styles.adjustRow}>
            <View style={styles.adjustInfo}>
              <Text style={[styles.adjustValue, { color: colors.protein }]}>
                {Math.round(result.protein)}g
              </Text>
              <Text style={styles.adjustLabel}>protein</Text>
            </View>
            <View style={styles.adjustButtons}>
              <StepButton label="−5" onPress={() => editAmount('protein', -5)} />
              <StepButton label="+5" onPress={() => editAmount('protein', 5)} />
            </View>
          </View>

          <View style={styles.secondaryMacros}>
            <Text style={styles.secondaryMacro}>
              Carbs <Text style={{ color: colors.carbs }}>{Math.round(result.carbs)}g</Text>
            </Text>
            <Text style={styles.secondaryMacro}>
              Fat <Text style={{ color: colors.fat }}>{Math.round(result.fat)}g</Text>
            </Text>
          </View>

          {result.items.length > 0 && (
            <View style={styles.breakdown}>
              <Text style={styles.breakdownTitle}>What the AI saw</Text>
              {result.items.map((item, i) => (
                <Text key={`${item.name}-${i}`} style={styles.breakdownItem}>
                  • {item.name}
                  {item.quantity ? ` — ${item.quantity}` : ''} ({Math.round(item.calories)} kcal)
                </Text>
              ))}
            </View>
          )}

          {result.note ? <Text style={styles.note}>ℹ️ {result.note}</Text> : null}
        </View>

        <Pressable style={styles.primaryButton} onPress={save}>
          <Text style={styles.primaryButtonText}>Save to today</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => setPending(null)}>
          <Text style={styles.secondaryButtonText}>Discard</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Log food</Text>
        <Text style={styles.sub}>Snap it or describe it — the AI does the maths.</Text>

        {!serverConfigured && (
          <Pressable style={styles.warning} onPress={onOpenSettings}>
            <Text style={styles.warningText}>
              No analyzer server set yet. Tap here to add its address in Settings.
            </Text>
          </Pressable>
        )}

        <View style={styles.photoRow}>
          <Pressable
            style={[styles.photoButton, busy && styles.disabled]}
            disabled={!!busy}
            onPress={() => runPhoto('camera')}>
            <Text style={styles.photoEmoji}>📷</Text>
            <Text style={styles.photoLabel}>Take photo</Text>
          </Pressable>
          <Pressable
            style={[styles.photoButton, busy && styles.disabled]}
            disabled={!!busy}
            onPress={() => runPhoto('library')}>
            <Text style={styles.photoEmoji}>🖼️</Text>
            <Text style={styles.photoLabel}>From library</Text>
          </Pressable>
        </View>

        <Text style={styles.orLabel}>or tell the AI what you ate</Text>

        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. large bowl of chilli con carne with rice"
          placeholderTextColor={colors.textFaint}
          multiline
          editable={!busy}
        />

        <View style={styles.chips}>
          {QUICK_PROMPTS.map((prompt) => (
            <Pressable key={prompt} style={styles.chip} onPress={() => setDescription(prompt)}>
              <Text style={styles.chipText}>{prompt}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[
            styles.primaryButton,
            (!description.trim() || !!busy) && styles.disabled,
          ]}
          disabled={!description.trim() || !!busy}
          onPress={runText}>
          {busy === 'text' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Analyze description</Text>
          )}
        </Pressable>

        {busy === 'photo' && (
          <View style={styles.busyRow}>
            <ActivityIndicator color={colors.protein} />
            <Text style={styles.busyText}>Looking at your photo…</Text>
          </View>
        )}

        {error && (
          <Pressable
            style={styles.errorBox}
            onPress={() => Alert.alert('Analyzer error', error)}>
            <Text style={styles.errorText}>{error}</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StepButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.step} onPress={onPress}>
      <Text style={styles.stepText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  heading: { color: colors.text, fontSize: 30, fontWeight: '700' },
  sub: { color: colors.textMuted, fontSize: 14, marginTop: 2, marginBottom: spacing.lg },
  warning: {
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  warningText: { color: colors.danger, fontSize: 13 },
  photoRow: { flexDirection: 'row', gap: spacing.md },
  photoButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoEmoji: { fontSize: 30 },
  photoLabel: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: spacing.sm },
  orLabel: {
    color: colors.textFaint,
    fontSize: 12,
    textAlign: 'center',
    marginVertical: spacing.lg,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    padding: spacing.lg,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  chip: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: { color: colors.textMuted, fontSize: 12 },
  primaryButton: {
    backgroundColor: colors.protein,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: { paddingVertical: spacing.lg, alignItems: 'center' },
  secondaryButtonText: { color: colors.textMuted, fontSize: 15 },
  disabled: { opacity: 0.45 },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  busyText: { color: colors.textMuted, fontSize: 14 },
  errorBox: {
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  preview: { width: '100%', height: 220, borderRadius: radius.lg, marginBottom: spacing.lg },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultTitle: { color: colors.text, fontSize: 19, fontWeight: '700', marginBottom: spacing.lg },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  adjustInfo: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  adjustValue: { fontSize: 26, fontWeight: '700' },
  adjustLabel: { color: colors.textMuted, fontSize: 13 },
  adjustButtons: { flexDirection: 'row', gap: spacing.sm },
  step: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 52,
    alignItems: 'center',
  },
  stepText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  secondaryMacros: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  secondaryMacro: { color: colors.textMuted, fontSize: 14 },
  breakdown: { marginTop: spacing.lg },
  breakdownTitle: {
    color: colors.textFaint,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  breakdownItem: { color: colors.textMuted, fontSize: 13, marginBottom: 2 },
  note: { color: colors.textFaint, fontSize: 12.5, marginTop: spacing.md, fontStyle: 'italic' },
});
