# xChat voice — dictation & Voice Mode

Operator and engineer reference for **composer mic dictation** (speech-to-text into the textarea) and **Voice Mode** (realtime speech-to-speech via xAI Voice Agent). User-facing behavior is summarized in **`XCHAT_BETA_CLIENT_UI_INSTRUCTIONS`** (`src/modules/xchat/xchat-prompt-build.ts`).

## Dictation (review before Send)

| Piece | Detail |
|-------|--------|
| **Path** | Browser **`MediaRecorder`** → **`POST /api/app-user/xchat/voice-transcribe`** (multipart **`audio`**, optional **`language`**) → xAI **`POST /v1/stt`** (`format=true`). **No** Web Speech API or JSON transcript proxy — xAI STT only. |
| **Client** | `src/app/xchat/ui/xchat-native-stt-client.ts` (handlers shared with `xchat-dictation-client.ts` types only when needed). |

## Voice Mode (realtime)

| Piece | Detail |
|-------|--------|
| **Token** | **`POST /api/app-user/xchat/voice-realtime/token`** (approved app user session). Body optional: **`model`** (`grok-voice-think-fast-1.0` \| `grok-voice-fast-1.0`), **`expiresAfterSeconds`** (60–3600). Response **`data.client_secret`**, **`data.realtime_ws_url`**, **`data.model`**, optional **`data.workspace_voice_context`** (server-built portfolio/watchlist snapshot text for **`session.update` instructions** — same source shape as typed xChat workspace block, capped). Server calls xAI **`POST …/realtime/client_secrets`** with **`XAI_API_KEY`** — key never sent to the browser. |
| **WebSocket** | Browser connects to **`data.realtime_ws_url`** with OpenAI-compatible subprotocols (**`realtime`**, **`openai-insecure-api-key.{secret}`**, **`openai-beta.realtime-v1`**) per xAI web voice cookbook. |
| **Session** | After **`session.created`** / **`conversation.created`**, client sends **`session.update`** (instructions, **`voice`** ∈ ara/eve/leo/rex/sal, PCM rates from **`AudioContext.sampleRate`**, **`turn_detection`**: **`server_vad`** or **`null`** for push-to-talk). |
| **Audio** | **`input_audio_buffer.append`** with base64 PCM16 chunks (~100 ms). Output: **`response.output_audio.delta`**; captions: **`conversation.item.input_audio_transcription.completed`**, **`response.output_audio_transcript.delta`**. |
| **UX** | **`VoiceModeSession`** (`src/app/xchat/voice/VoiceModeSession.tsx`) + **`useXchatVoiceRealtimeSession`**; composer waveform control (`xchat-composer-panel.tsx`). |

## Environment

Uses **`XAI_API_KEY`** and optional **`XAI_BASE_URL`** (default `https://api.x.ai/v1`). WS URL is derived from the same HTTP API base (`wss://…/v1/realtime?model=…`).

## Security & privacy

- No platform API key in client bundles; only short-lived client secrets from the token route.
- Operational logs should avoid raw audio; align voice telemetry with **[xchat-debug-logging.md](./xchat-debug-logging.md)** patterns when extending diagnostics.

## Tests

| Suite | Files |
|-------|--------|
| **Integration** | `tests/integration/xchat-voice-transcribe-route.test.ts`, `tests/integration/xchat-voice-realtime-token-route.test.ts` |
| **Unit** | `tests/unit/xai-voice-realtime.test.ts`, `tests/unit/xchat-voice-pcm.test.ts`, `tests/unit/xai-stt.test.ts` |

## Backlog (PLAN **703**)

Typed-chat **confirm-before-mutate**, Voice Agent **`session.tools`** parity with persona **`atx_function`**, optional streaming dictation STT, explicit audio retention policy — see **[PLAN.md](../PLAN.md)** product table.
