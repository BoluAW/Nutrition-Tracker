import Anthropic from '@anthropic-ai/sdk';
import cors from 'cors';
import express from 'express';

import { analyzePhoto, analyzeText, type AnalyzerConfig } from './nutrition.js';

const PORT = Number(process.env.PORT ?? 8787);
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    'ANTHROPIC_API_KEY is not set. Copy .env.example to .env, add your key, and start again.',
  );
  process.exit(1);
}

const config: AnalyzerConfig = {
  client: new Anthropic(),
  model: MODEL,
};

const app = express();
app.use(cors());
// Photos arrive base64-encoded in the JSON body, so the default 100kb limit is
// far too small.
app.use(express.json({ limit: '25mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, model: MODEL });
});

app.post('/analyze/text', async (req, res) => {
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  if (!description) {
    res.status(400).json({ error: 'Send a non-empty "description".' });
    return;
  }
  if (description.length > 2000) {
    res.status(400).json({ error: 'That description is too long — keep it under 2000 characters.' });
    return;
  }

  try {
    res.json(await analyzeText(config, description));
  } catch (err) {
    handleError(res, err);
  }
});

app.post('/analyze/photo', async (req, res) => {
  const image = typeof req.body?.image === 'string' ? req.body.image : '';
  const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType : 'image/jpeg';
  const hint = typeof req.body?.hint === 'string' ? req.body.hint.trim() || undefined : undefined;

  if (!image) {
    res.status(400).json({ error: 'Send a base64-encoded "image".' });
    return;
  }

  try {
    // The app sends raw base64, but strip a data: prefix in case a browser client
    // sends the full data URI.
    const data = image.includes(',') ? image.slice(image.indexOf(',') + 1) : image;
    res.json(await analyzePhoto(config, data, mimeType, hint));
  } catch (err) {
    handleError(res, err);
  }
});

function handleError(res: express.Response, err: unknown): void {
  if (err instanceof Anthropic.RateLimitError) {
    res.status(429).json({ error: 'Rate limited by the Claude API. Wait a moment and try again.' });
    return;
  }
  if (err instanceof Anthropic.AuthenticationError) {
    res.status(401).json({ error: 'The ANTHROPIC_API_KEY on the server is missing or invalid.' });
    return;
  }
  if (err instanceof Anthropic.APIConnectionError) {
    res.status(502).json({ error: "The server couldn't reach the Claude API." });
    return;
  }

  const message = err instanceof Error ? err.message : 'Unknown error analyzing the meal.';
  console.error('[analyze]', err);
  res.status(500).json({ error: message });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Nutrition analyzer listening on http://0.0.0.0:${PORT} (model: ${MODEL})`);
  console.log('Point the app at http://<this-machine-LAN-IP>:' + PORT);
});
