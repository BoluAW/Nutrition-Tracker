/**
 * Everything both providers share: the output contract, the prompts, and the
 * error type the HTTP layer maps to status codes. Adding a third provider means
 * writing one file in ./providers and nothing else.
 */

/**
 * Standard JSON Schema. Claude enforces it via structured outputs and Gemini via
 * `responseJsonSchema`, so in both cases a malformed response is impossible
 * rather than merely unlikely.
 */
export const NUTRITION_SCHEMA = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description:
        'Short name for the whole meal, as a person would say it. e.g. "Chicken burrito bowl".',
    },
    items: {
      type: 'array',
      description: 'Each distinct food or drink identified, broken out separately.',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'The food, e.g. "grilled chicken breast".' },
          quantity: {
            type: 'string',
            description: 'Estimated portion in everyday terms, e.g. "about 150g" or "1 cup".',
          },
          calories: { type: 'number' },
          protein: { type: 'number', description: 'Grams of protein.' },
          carbs: { type: 'number', description: 'Grams of carbohydrate.' },
          fat: { type: 'number', description: 'Grams of fat.' },
        },
        required: ['name', 'quantity', 'calories', 'protein', 'carbs', 'fat'],
        additionalProperties: false,
      },
    },
    calories: { type: 'number', description: 'Total calories across all items.' },
    protein: { type: 'number', description: 'Total grams of protein.' },
    carbs: { type: 'number', description: 'Total grams of carbohydrate.' },
    fat: { type: 'number', description: 'Total grams of fat.' },
    confidence: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
      description:
        'high when portions and ingredients are clear; low when the estimate rests on guesswork.',
    },
    note: {
      type: 'string',
      description:
        'One short sentence naming the biggest assumption, e.g. "Assumed the rice was cooked in oil." Empty string if there is nothing worth flagging.',
    },
  },
  required: ['title', 'items', 'calories', 'protein', 'carbs', 'fat', 'confidence', 'note'],
  additionalProperties: false,
} as const;

export type FoodItem = {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type AnalysisResult = {
  title: string;
  items: FoodItem[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: 'high' | 'medium' | 'low';
  note: string;
};

export const SYSTEM_PROMPT = `You estimate the nutrition of meals for someone tracking their daily calories and protein.

Give a single best estimate. The person needs a number they can log in five seconds, not a range or a list of caveats — they would rather have a good guess now than a perfect one never.

How to judge portions:
- From a photo, use plate size, cutlery, hands, and packaging as scale references.
- When the portion is genuinely ambiguous, assume a normal adult serving rather than the smallest or largest plausible one.
- Account for how the food was likely cooked. Restaurant and takeaway food carries noticeably more oil, butter, and sugar than the same dish cooked at home; say so in the note when it materially moves the number.
- Drinks count. So do sauces, dressings, and oil.

Set confidence honestly: high when you can see or were told the ingredients and portions, medium for a normal estimate from a clear photo or description, low when a key part of the meal is hidden, unfamiliar, or unstated.

Keep the note to one sentence naming your single biggest assumption, and leave it empty when the estimate is straightforward.

Item totals should add up to the meal totals.`;

export function textPrompt(description: string): string {
  return `Estimate the nutrition of this meal:\n\n${description}`;
}

export function photoPrompt(hint?: string): string {
  return hint
    ? `Estimate the nutrition of the meal in this photo. The person adds: "${hint}"`
    : 'Estimate the nutrition of the meal in this photo.';
}

/** Carries an HTTP status so the route layer doesn't need provider-specific knowledge. */
export class AnalyzerError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'AnalyzerError';
  }
}

/** What the routes depend on. Providers are interchangeable behind this. */
export interface Analyzer {
  readonly provider: string;
  readonly model: string;
  analyzeText(description: string): Promise<AnalysisResult>;
  analyzePhoto(base64Image: string, mimeType: string, hint?: string): Promise<AnalysisResult>;
}

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

/**
 * Both providers accept the same four image types. The camera nearly always
 * hands us JPEG, so assume it rather than rejecting a photo over an
 * unrecognized label.
 */
export function normalizeMimeType(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (lower === 'image/jpg') return 'image/jpeg';
  return (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(lower) ? lower : 'image/jpeg';
}

/** Guards against a provider returning JSON that parses but isn't our shape. */
export function parseResult(raw: string): AnalysisResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AnalyzerError('The model returned something that was not valid JSON.', 502);
  }

  const result = parsed as AnalysisResult;
  if (typeof result?.calories !== 'number' || !Array.isArray(result?.items)) {
    throw new AnalyzerError('The model returned JSON in an unexpected shape.', 502);
  }
  return result;
}
