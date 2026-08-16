import Anthropic from '@anthropic-ai/sdk';

/**
 * The shape the app expects back. Enforced by the API rather than by parsing
 * prose, so a malformed response is impossible rather than merely unlikely.
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

const SYSTEM_PROMPT = `You estimate the nutrition of meals for someone tracking their daily calories and protein.

Give a single best estimate. The person needs a number they can log in five seconds, not a range or a list of caveats — they would rather have a good guess now than a perfect one never.

How to judge portions:
- From a photo, use plate size, cutlery, hands, and packaging as scale references.
- When the portion is genuinely ambiguous, assume a normal adult serving rather than the smallest or largest plausible one.
- Account for how the food was likely cooked. Restaurant and takeaway food carries noticeably more oil, butter, and sugar than the same dish cooked at home; say so in the note when it materially moves the number.
- Drinks count. So do sauces, dressings, and oil.

Set confidence honestly: high when you can see or were told the ingredients and portions, medium for a normal estimate from a clear photo or description, low when a key part of the meal is hidden, unfamiliar, or unstated.

Keep the note to one sentence naming your single biggest assumption, and leave it empty when the estimate is straightforward.

Item totals should add up to the meal totals.`;

export type AnalyzerConfig = {
  client: Anthropic;
  model: string;
};

async function requestAnalysis(
  { client, model }: AnalyzerConfig,
  content: Anthropic.ContentBlockParam[],
): Promise<AnalysisResult> {
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    // Portion estimation is judgment, not deep reasoning — low effort keeps the
    // round trip short enough that logging a meal still feels instant.
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: NUTRITION_SCHEMA },
    },
    messages: [{ role: 'user', content }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error("The model declined to analyze that. Try describing the meal in words instead.");
  }

  const text = response.content.find((block) => block.type === 'text');
  if (!text || text.type !== 'text') {
    throw new Error('The model returned no analysis. Try again.');
  }

  return JSON.parse(text.text) as AnalysisResult;
}

/** Estimate nutrition from a sentence like "two eggs on toast with butter". */
export function analyzeText(config: AnalyzerConfig, description: string): Promise<AnalysisResult> {
  return requestAnalysis(config, [
    {
      type: 'text',
      text: `Estimate the nutrition of this meal:\n\n${description}`,
    },
  ]);
}

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

function normalizeMimeType(mimeType: string): SupportedImageType {
  const lower = mimeType.toLowerCase();
  if (lower === 'image/jpg') return 'image/jpeg';
  if ((SUPPORTED_IMAGE_TYPES as readonly string[]).includes(lower)) {
    return lower as SupportedImageType;
  }
  // The camera nearly always hands us JPEG; assume it rather than rejecting a
  // photo over an unrecognized label.
  return 'image/jpeg';
}

/** Estimate nutrition from a photo, optionally with a typed hint from the user. */
export function analyzePhoto(
  config: AnalyzerConfig,
  base64Image: string,
  mimeType: string,
  hint?: string,
): Promise<AnalysisResult> {
  const instruction = hint
    ? `Estimate the nutrition of the meal in this photo. The person adds: "${hint}"`
    : 'Estimate the nutrition of the meal in this photo.';

  return requestAnalysis(config, [
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: normalizeMimeType(mimeType),
        data: base64Image,
      },
    },
    { type: 'text', text: instruction },
  ]);
}
