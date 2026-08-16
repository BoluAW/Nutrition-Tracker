import { FoodItem } from './types';

export type AnalysisResult = {
  title: string;
  items: FoodItem[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: 'high' | 'medium' | 'low';
  note?: string;
};

export class AnalyzeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalyzeError';
  }
}

const TIMEOUT_MS = 45_000;

function normalizeBaseUrl(serverUrl: string): string {
  const trimmed = serverUrl.trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new AnalyzeError(
      'No server URL set yet. Open Settings and paste the address your backend is running on.',
    );
  }
  return trimmed;
}

async function postJson<T>(serverUrl: string, path: string, body: unknown): Promise<T> {
  const base = normalizeBaseUrl(serverUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AnalyzeError('The server took too long to answer. Try again.');
    }
    throw new AnalyzeError(
      `Couldn't reach the server at ${base}. Check that it's running and that your phone is on the same network.`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new AnalyzeError(
      detail.slice(0, 200) || `The server returned ${response.status}.`,
    );
  }

  return (await response.json()) as T;
}

/** Ask the backend to estimate nutrition from a sentence like "two eggs and toast". */
export function analyzeText(serverUrl: string, description: string): Promise<AnalysisResult> {
  return postJson<AnalysisResult>(serverUrl, '/analyze/text', { description });
}

/**
 * Ask the backend to estimate nutrition from a photo. `base64` is the raw
 * image data without a `data:` prefix — expo-image-picker returns it that way.
 */
export function analyzePhoto(
  serverUrl: string,
  base64: string,
  mimeType: string,
  hint?: string,
): Promise<AnalysisResult> {
  return postJson<AnalysisResult>(serverUrl, '/analyze/photo', {
    image: base64,
    mimeType,
    hint,
  });
}

/** Cheap reachability probe used by the Settings screen's "Test connection" button. */
export async function pingServer(serverUrl: string): Promise<{ ok: boolean; model?: string }> {
  const base = normalizeBaseUrl(serverUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${base}/health`, { signal: controller.signal });
    if (!response.ok) throw new AnalyzeError(`Server returned ${response.status}.`);
    return (await response.json()) as { ok: boolean; model?: string };
  } catch (err) {
    if (err instanceof AnalyzeError) throw err;
    throw new AnalyzeError(`Couldn't reach ${base}.`);
  } finally {
    clearTimeout(timer);
  }
}
