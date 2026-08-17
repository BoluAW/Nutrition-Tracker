import Anthropic from '@anthropic-ai/sdk';

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

export const DEFAULT_CLAUDE_MODEL = 'claude-opus-5';

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

export function createClaudeAnalyzer(apiKey: string, model: string): Analyzer {
  const client = new Anthropic({ apiKey });

  async function run(content: Anthropic.ContentBlockParam[]): Promise<AnalysisResult> {
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        // Portion estimation is judgment, not deep reasoning — low effort keeps
        // the round trip short enough that logging a meal still feels instant.
        output_config: {
          effort: 'low',
          format: { type: 'json_schema', schema: NUTRITION_SCHEMA },
        },
        messages: [{ role: 'user', content }],
      });
    } catch (err) {
      throw translateError(err);
    }

    if (response.stop_reason === 'refusal') {
      throw new AnalyzerError(
        'Claude declined to analyze that. Try describing the meal in words instead.',
        422,
      );
    }

    const text = response.content.find((block) => block.type === 'text');
    if (!text || text.type !== 'text') {
      throw new AnalyzerError('Claude returned no analysis. Try again.', 502);
    }
    return parseResult(text.text);
  }

  return {
    provider: 'claude',
    model,

    analyzeText(description) {
      return run([{ type: 'text', text: textPrompt(description) }]);
    },

    analyzePhoto(base64Image, mimeType, hint) {
      return run([
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: normalizeMimeType(mimeType) as ImageMediaType,
            data: base64Image,
          },
        },
        { type: 'text', text: photoPrompt(hint) },
      ]);
    },
  };
}

function translateError(err: unknown): AnalyzerError {
  if (err instanceof Anthropic.RateLimitError) {
    return new AnalyzerError(
      'Rate limited by the Claude API. Wait a moment and try again.',
      429,
    );
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return new AnalyzerError('The ANTHROPIC_API_KEY on the server is missing or invalid.', 401);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new AnalyzerError("The server couldn't reach the Claude API.", 502);
  }

  const message = err instanceof Error ? err.message : 'Unknown error calling Claude.';
  return new AnalyzerError(message, 502);
}
