import cors from 'cors';
import express from 'express';

import { createAnalyzer } from './analyzer.js';
import { AnalyzerError } from './schema.js';

const PORT = Number(process.env.PORT ?? 8787);

let analyzer;
try {
  analyzer = createAnalyzer();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

const app = express();
app.use(cors());
// Photos arrive base64-encoded in the JSON body, so the default 100kb limit is
// far too small.
app.use(express.json({ limit: '25mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, provider: analyzer.provider, model: analyzer.model });
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
    res.json(await analyzer.analyzeText(description));
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
    // The app sends raw base64, but strip a data: prefix in case a browser
    // client sends the full data URI.
    const data = image.includes(',') ? image.slice(image.indexOf(',') + 1) : image;
    res.json(await analyzer.analyzePhoto(data, mimeType, hint));
  } catch (err) {
    handleError(res, err);
  }
});

function handleError(res: express.Response, err: unknown): void {
  if (err instanceof AnalyzerError) {
    if (err.status >= 500) console.error('[analyze]', err.message);
    res.status(err.status).json({ error: err.message });
    return;
  }

  console.error('[analyze]', err);
  const message = err instanceof Error ? err.message : 'Unknown error analyzing the meal.';
  res.status(500).json({ error: message });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `Nutrition analyzer listening on http://0.0.0.0:${PORT} (${analyzer.provider}: ${analyzer.model})`,
  );
  console.log(`Point the app at http://<this-machine-LAN-IP>:${PORT}`);
});
