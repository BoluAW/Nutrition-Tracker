# Nutrition Tracker

Snap a photo of your food or just type what you ate — the AI works out the calories and protein.
Also tracks water, and nudges you with reminders so you actually hit your daily goals.

Two pieces:

| Folder    | What it is                                                                     |
| --------- | ------------------------------------------------------------------------------ |
| `app/`    | The phone app (Expo / React Native, iOS + Android)                              |
| `server/` | A small Node server that calls the Claude API and returns the nutrition estimate |

The server exists so your API key stays on your computer instead of shipping inside the app.

## What it does

- **Log food with a photo.** Take a picture, the AI identifies what's on the plate, estimates portions, and returns calories, protein, carbs and fat — broken down per item, with a note about the biggest assumption it made.
- **Log food by typing.** "Large bowl of chilli con carne with rice" works just as well as a photo.
- **Adjust before saving.** The estimate lands in a preview screen with ±50 kcal and ±5g protein buttons, so you can correct a portion the AI misjudged.
- **Water tracker.** Tap a glass, big glass, bottle or large bottle; a filling-glass gauge shows how close you are to your goal.
- **Reminders.** Meal nudges at times you pick, water nudges on an interval, and an evening check-in that tells you how much protein and how many calories you have left. The reminder text is rebuilt whenever your totals change, so it's accurate when it fires.
- **History.** The last seven days with calorie, protein and water bars, expandable into the individual entries.

Everything you log is stored on the phone. Photos go to your own server for the estimate and aren't stored there.

## Setup

### 1. Start the server

```sh
cd server
npm install
cp .env.example .env      # then paste an API key into .env
npm run dev
```

The analyzer runs on either **Google Gemini** or **Anthropic Claude** — set one key in
`.env` and it uses that one:

| Provider   | Key in `.env`       | Get one at                                                                    | Cost                     |
| ---------- | ------------------- | ----------------------------------------------------------------------------- | ------------------------ |
| **Gemini** | `GEMINI_API_KEY`    | [aistudio.google.com/apikey](https://aistudio.google.com/apikey)              | Free tier, no card       |
| **Claude** | `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/settings/keys)           | Paid, from ~$5 of credit |

Gemini's free tier is capped per minute and per day, which is far more than personal meal
logging needs. Claude costs a few cents a meal and is better at the genuinely hard part —
judging portion sizes from a photo.

Set both keys and you can flip `PROVIDER=gemini` / `PROVIDER=claude` to compare them on the
same meal.

It listens on port `8787`. You'll need this machine's address on your local network — not
`localhost`, since the phone has to reach it:

```sh
# macOS
ipconfig getifaddr en0
# Linux
hostname -I | awk '{print $1}'
```

That gives you something like `192.168.1.20`, so your server URL is `http://192.168.1.20:8787`.

### 2. Run the app

```sh
cd app
npm install
npx expo start
```

Install **Expo Go** on your phone, scan the QR code, and the app opens. Then go to
**Settings → AI analyzer**, paste the server URL, and tap **Test connection**.

While you're in Settings, set your calorie, protein and water goals, and pick your reminder
times. Tap **Apply reminder schedule** — the app will ask for notification permission the first
time.

### 3. Log something

Tap **Log**, take a photo of your next meal, and it'll come back with an estimate to confirm.

## Notes

- **Reminders are local notifications**, scheduled on the phone. They fire whether or not the app
  is open and don't need the server running — but they do need the app installed and permission
  granted. On Android, notification permission is requested at runtime; if you deny it, flip the
  switch in Settings again to re-prompt.
- **Expo Go vs a real build.** Everything here works in Expo Go for day-to-day personal use. If you
  want a standalone app on your home screen that doesn't need Expo Go, run
  `npx eas build --profile preview --platform android` (or `ios`) — you'll need a free Expo
  account.
- **The estimates are estimates.** The AI is good at recognising food and reasonable at portions,
  but it can't see the oil in the pan. Treat the numbers as close-enough for tracking trends, and
  use the adjust buttons when you know better.
- **Model.** Defaults are `gemini-flash-latest` and `claude-opus-5`. Override with `GEMINI_MODEL`
  or `ANTHROPIC_MODEL` in `server/.env`. The Gemini default is deliberately an alias rather than a
  pinned version — Google retires specific model ids for new API keys without much warning, and
  `-latest` keeps working through that.
- **Adding another provider** is one file in `server/src/providers/` implementing the `Analyzer`
  interface from `server/src/schema.ts`. The phone app talks to a fixed JSON contract, so it needs
  no changes.
