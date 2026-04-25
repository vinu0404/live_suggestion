# Live Meeting Copilot

A 3-column meeting copilot web app built with `Next.js App Router + TypeScript` and Groq:

- Left: live mic capture and transcript chunks
- Middle: exactly 3 fresh live suggestions every refresh
- Right: streamed detailed answers in a continuous chat

The app is stateless on the server. Transcript, suggestion batches, chat history, rolling memory, and latency metrics live in the browser session only. The Groq API key is never hard-coded and is stored only in `sessionStorage`.

## Stack

- `Next.js 16`
- `React 19`
- `TypeScript`
- `Groq Whisper Large V3` for transcription
- `Groq openai/gpt-oss-120b` for live suggestions, rolling memory, and chat
- `Vitest` for unit and mocked route tests
- `Playwright` for end-to-end UI flow tests

## Features

- Start/stop microphone with `getUserMedia` + `MediaRecorder`
- 1-second audio slices merged into a 30-second logical chunk
- Auto-refresh countdown with manual refresh that flushes pending audio first
- Transcript chunking with timestamped append behavior
- Suggestion generation with:
  - recent transcript window
  - rolling meeting memory
  - last two suggestion batches to avoid repetition
  - one retry if duplicates show up
- Click a suggestion to seed streamed chat
- Ask direct chat questions in the same session
- Export full session as JSON:
  - transcript
  - suggestion batches
  - chat history
  - rolling memory
  - latency metrics
  - captured failures
- Settings drawer for:
  - Groq API key
  - prompts
  - context windows
  - refresh interval
  - reasoning effort
  - token caps

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Start the app:

```bash
npm run dev
```

3. Open `http://localhost:3000`

4. Open `Settings`, paste your Groq API key, and validate it.

No `.env` file is required because the user supplies the API key inside the UI.

## API Routes

- `POST /api/validate-key`
  - checks whether the pasted Groq key can access the required models
- `POST /api/transcribe`
  - sends an audio chunk to Groq Whisper Large V3
- `POST /api/suggestions`
  - generates exactly 3 structured live suggestions
- `POST /api/memory`
  - refreshes the rolling meeting memory in the background
- `POST /api/chat`
  - proxies a streamed chat completion response from Groq

## Tests

Run unit and mocked route tests:

```bash
npm test
```

Run the production build:

```bash
npm run build
```

Run the Playwright suite:

```bash
npm run test:e2e
```

If Playwright browsers are not installed yet, run:

```bash
npx playwright install
```

## Deployed To Vercel:

[live_link](https://live-meeting-copilot-theta.vercel.app)

## Notes

- Transcript/chat data intentionally reset on page reload.
- The API key persists only for the current browser tab session via `sessionStorage`.
