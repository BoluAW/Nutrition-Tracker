import { createClaudeAnalyzer, DEFAULT_CLAUDE_MODEL } from './providers/claude.js';
import { createGeminiAnalyzer, DEFAULT_GEMINI_MODEL } from './providers/gemini.js';
import type { Analyzer } from './schema.js';

/**
 * Picks a provider from the environment. Explicit PROVIDER wins; otherwise
 * whichever key is present decides, so a first-time setup only needs one line
 * in .env.
 */
export function createAnalyzer(env: NodeJS.ProcessEnv = process.env): Analyzer {
  const geminiKey = env.GEMINI_API_KEY?.trim();
  const anthropicKey = env.ANTHROPIC_API_KEY?.trim();
  const requested = env.PROVIDER?.trim().toLowerCase();

  const provider = requested ?? (geminiKey ? 'gemini' : anthropicKey ? 'claude' : undefined);

  if (!provider) {
    throw new Error(
      'No API key found. Copy .env.example to .env and set GEMINI_API_KEY (free tier: https://aistudio.google.com/apikey) or ANTHROPIC_API_KEY.',
    );
  }

  if (provider === 'gemini') {
    if (!geminiKey) {
      throw new Error('PROVIDER is "gemini" but GEMINI_API_KEY is not set in .env.');
    }
    return createGeminiAnalyzer(geminiKey, env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL);
  }

  if (provider === 'claude') {
    if (!anthropicKey) {
      throw new Error('PROVIDER is "claude" but ANTHROPIC_API_KEY is not set in .env.');
    }
    return createClaudeAnalyzer(anthropicKey, env.ANTHROPIC_MODEL?.trim() || DEFAULT_CLAUDE_MODEL);
  }

  throw new Error(`PROVIDER must be "gemini" or "claude", not "${provider}".`);
}
