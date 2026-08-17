import { ApiError, GoogleGenAI, type ContentListUnion } from '@google/genai';

import {
  AnalyzerError,
  NUTRITION_SCHEMA,
  SYSTEM_PROMPT,
  normalizeMimeType,
  parseResult,
  photoPrompt,
  textPrompt,
  type AnalysisResult,
  type Analyzer,
} from '../schema.js';

// An alias rather than a pinned version: Google retires specific model ids for
// new keys without warning (gemini-2.5-flash was already blocked when this was
// written), and "latest" keeps working through that. Pin GEMINI_MODEL in .env if
// you ever need a fixed version.
export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';

const RETRY_DELAYS_MS = [1500, 3000, 5000];
const MAX_RETRIES = RETRY_DELAYS_MS.length;

export function createGeminiAnalyzer(apiKey: string, model: string): Analyzer {
  const ai = new GoogleGenAI({ apiKey });

  async function run(contents: ContentListUnion): Promise<AnalysisResult> {
    let response;
    // The free tier returns 503 "high demand" often enough that a single
    // attempt fails more often than it succeeds at busy times. Retrying two or
    // three seconds later almost always works, and the user standing over their
    // dinner never sees it.
    for (let attempt = 0; ; attempt++) {
      try {
        response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            responseMimeType: 'application/json',
            // `responseJsonSchema` takes standard JSON Schema, unlike the older
            // `responseSchema` field which only accepts an OpenAPI subset — so
            // the exact same schema object drives both providers.
            responseJsonSchema: NUTRITION_SCHEMA,
          },
        });
        break;
      } catch (err) {
        const overloaded = err instanceof ApiError && (err.status === 503 || err.status === 500);
        if (!overloaded || attempt >= MAX_RETRIES) throw translateError(err);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
      }
    }

    const text = response.text;
    if (!text) {
      // Usually means the safety filters blocked the response rather than a bug.
      throw new AnalyzerError(
        "Gemini returned no analysis. Try again, or describe the meal in words instead.",
        502,
      );
    }
    return parseResult(text);
  }

  return {
    provider: 'gemini',
    model,

    analyzeText(description) {
      return run([{ text: textPrompt(description) }]);
    },

    analyzePhoto(base64Image, mimeType, hint) {
      return run([
        { inlineData: { mimeType: normalizeMimeType(mimeType), data: base64Image } },
        { text: photoPrompt(hint) },
      ]);
    },
  };
}

function translateError(err: unknown): AnalyzerError {
  if (err instanceof ApiError) {
    if (err.status === 429) {
      return new AnalyzerError(
        "You've hit Gemini's rate limit. The free tier allows a limited number of requests per minute and per day — wait a moment and try again.",
        429,
      );
    }
    // Gemini reports a bad key as 400 API_KEY_INVALID rather than 401, so match
    // on the reason as well as the status — otherwise the raw error JSON ends up
    // in front of the user.
    if (err.status === 401 || err.status === 403 || /API_KEY_INVALID|API key not valid/i.test(err.message)) {
      return new AnalyzerError('The GEMINI_API_KEY on the server is missing or invalid.', 401);
    }
    if (/quota|RESOURCE_EXHAUSTED/i.test(err.message)) {
      return new AnalyzerError(
        "You've used up the Gemini free-tier quota for now. It resets on a daily cycle — wait and try again, or switch PROVIDER to claude in .env.",
        429,
      );
    }
    if (err.status === 400) {
      return new AnalyzerError(`Gemini rejected the request: ${err.message}`, 400);
    }
    if (err.status === 503 || err.status === 500) {
      // Only reached after the retries above were exhausted.
      return new AnalyzerError(
        'Gemini is busy right now and stayed busy through several retries. Wait a minute and try again.',
        503,
      );
    }
    return new AnalyzerError(`Gemini returned an error: ${err.message}`, 502);
  }

  const message = err instanceof Error ? err.message : 'Unknown error calling Gemini.';
  return new AnalyzerError(message, 502);
}
