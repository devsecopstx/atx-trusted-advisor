"use client";

import { useCallback, useRef, useState } from "react";

import { base64PCM16ToFloat32, float32ToPCM16Base64 } from "@/modules/xchat/voice/pcm";
import type { XchatVoicePresetId, XchatVoiceTurnMode } from "@/modules/xchat/voice/types";

const CHUNK_DURATION_MS = 100;
const SCRIPT_BUFFER_SIZE = 4096;

/** OpenAI-compatible subprotocols accepted by xAI Voice Agent (see xAI web voice cookbook). */
function realtimeWebSocketProtocols(ephemeralToken: string): string[] {
  return ["realtime", `openai-insecure-api-key.${ephemeralToken}`, "openai-beta.realtime-v1"];
}

type TokenResponse = {
  data?: {
    client_secret?: { value?: string; expires_at?: number };
    realtime_ws_url?: string;
    model?: string;
  };
};

function buildInstructions(personaLabel: string): string {
  return [
    `You are the xFinance voice advisor for persona "${personaLabel}".`,
    "Reply concisely for spoken delivery; spell tickers and numbers clearly.",
    "Educational software only — not personalized investment advice."
  ].join(" ");
}

type ConnOpts = {
  personaLabel: string;
  voice: XchatVoicePresetId;
  turnMode: XchatVoiceTurnMode;
};

export type XchatVoiceRealtimeStatus = "idle" | "connecting" | "live" | "error";

export function useXchatVoiceRealtimeSession() {
  const [status, setStatus] = useState<XchatVoiceRealtimeStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userCaption, setUserCaption] = useState("");
  const [assistantCaption, setAssistantCaption] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  /** Incremented on every `disconnect()` so stale socket `onclose` handlers no-op. */
  const generationRef = useRef(0);
  const sessionUpdateSentRef = useRef(false);
  const sessionConfiguredRef = useRef(false);
  const turnModeRef = useRef<XchatVoiceTurnMode>("vad");

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const playbackQueueRef = useRef<Float32Array[]>([]);
  const playingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const pendingFloatPartsRef = useRef<Float32Array[]>([]);
  const pendingSamplesRef = useRef(0);

  const stopPlaybackOnly = useCallback(() => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
        currentSourceRef.current.disconnect();
      } catch {
        /* already stopped */
      }
      currentSourceRef.current = null;
    }
    playbackQueueRef.current = [];
    playingRef.current = false;
  }, []);

  const playNextChunk = useCallback(() => {
    const ctx = audioContextRef.current;
    if (!ctx || playbackQueueRef.current.length === 0) {
      playingRef.current = false;
      currentSourceRef.current = null;
      return;
    }
    const chunk = playbackQueueRef.current.shift()!;
    const buffer = ctx.createBuffer(1, chunk.length, ctx.sampleRate);
    buffer.getChannelData(0).set(chunk);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    currentSourceRef.current = src;
    src.onended = () => {
      if (currentSourceRef.current === src) {
        currentSourceRef.current = null;
      }
      playNextChunk();
    };
    src.start();
  }, []);

  const enqueuePlayback = useCallback(
    (base64Pcm: string) => {
      try {
        const ctx = audioContextRef.current;
        if (!ctx) {
          return;
        }
        const f32 = base64PCM16ToFloat32(base64Pcm);
        playbackQueueRef.current.push(f32);
        if (!playingRef.current) {
          playingRef.current = true;
          playNextChunk();
        }
      } catch {
        /* ignore chunk */
      }
    },
    [playNextChunk]
  );

  const flushAppend = useCallback(
    (ws: WebSocket) => {
      const chunkSize =
        audioContextRef.current != null
          ? Math.floor((audioContextRef.current.sampleRate * CHUNK_DURATION_MS) / 1000)
          : 2400;
      while (pendingSamplesRef.current >= chunkSize) {
        const chunk = new Float32Array(chunkSize);
        let offset = 0;
        while (offset < chunkSize && pendingFloatPartsRef.current.length > 0) {
          const head = pendingFloatPartsRef.current[0]!;
          const need = chunkSize - offset;
          const avail = head.length;
          if (avail <= need) {
            chunk.set(head.subarray(0, avail), offset);
            offset += avail;
            pendingSamplesRef.current -= avail;
            pendingFloatPartsRef.current.shift();
          } else {
            chunk.set(head.subarray(0, need), offset);
            pendingFloatPartsRef.current[0] = head.subarray(need);
            pendingSamplesRef.current -= need;
            offset += need;
          }
        }
        const b64 = float32ToPCM16Base64(chunk);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: b64 }));
        }
      }
    },
    []
  );

  const stopMic = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => {
        t.stop();
      });
      mediaStreamRef.current = null;
    }
    pendingFloatPartsRef.current = [];
    pendingSamplesRef.current = 0;
  }, []);

  const startMic = useCallback(
    (ws: WebSocket) => {
      const ctx = audioContextRef.current;
      if (!ctx) {
        return;
      }
      stopMic();
      navigator.mediaDevices
        .getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        })
        .then((stream) => {
          mediaStreamRef.current = stream;
          const source = ctx.createMediaStreamSource(stream);
          sourceNodeRef.current = source;
          const processor = ctx.createScriptProcessor(SCRIPT_BUFFER_SIZE, 1, 1);
          processorRef.current = processor;
          processor.onaudioprocess = (event) => {
            if (ws.readyState !== WebSocket.OPEN || !sessionConfiguredRef.current) {
              return;
            }
            if (turnModeRef.current === "push") {
              return;
            }
            const input = event.inputBuffer.getChannelData(0);
            const copy = new Float32Array(input.length);
            copy.set(input);
            pendingFloatPartsRef.current.push(copy);
            pendingSamplesRef.current += copy.length;
            flushAppend(ws);
          };
          source.connect(processor);
          processor.connect(ctx.destination);
        })
        .catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : "microphone_unavailable";
          setErrorMessage(msg);
          setStatus("error");
        });
    },
    [flushAppend, stopMic]
  );

  const startMicPush = useCallback(
    (ws: WebSocket) => {
      const ctx = audioContextRef.current;
      if (!ctx) {
        return;
      }
      stopMic();
      void navigator.mediaDevices
        .getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        })
        .then((stream) => {
          mediaStreamRef.current = stream;
          const source = ctx.createMediaStreamSource(stream);
          sourceNodeRef.current = source;
          const processor = ctx.createScriptProcessor(SCRIPT_BUFFER_SIZE, 1, 1);
          processorRef.current = processor;
          processor.onaudioprocess = (event) => {
            if (ws.readyState !== WebSocket.OPEN || !sessionConfiguredRef.current) {
              return;
            }
            if (turnModeRef.current !== "push") {
              return;
            }
            const input = event.inputBuffer.getChannelData(0);
            const copy = new Float32Array(input.length);
            copy.set(input);
            pendingFloatPartsRef.current.push(copy);
            pendingSamplesRef.current += copy.length;
            flushAppend(ws);
          };
          source.connect(processor);
          processor.connect(ctx.destination);
        })
        .catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : "microphone_unavailable";
          setErrorMessage(msg);
          setStatus("error");
        });
    },
    [flushAppend, stopMic]
  );

  const teardownAudio = useCallback(() => {
    stopMic();
    stopPlaybackOnly();
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
  }, [stopMic, stopPlaybackOnly]);

  const disconnect = useCallback(() => {
    generationRef.current += 1;
    sessionConfiguredRef.current = false;
    sessionUpdateSentRef.current = false;
    const existing = wsRef.current;
    wsRef.current = null;
    existing?.close();
    teardownAudio();
    setStatus("idle");
  }, [teardownAudio]);

  const sendSessionUpdate = useCallback((ws: WebSocket, opts: ConnOpts) => {
    const ctx = audioContextRef.current;
    const rate = ctx?.sampleRate ?? 24000;
    ws.send(
      JSON.stringify({
        type: "session.update",
        session: {
          instructions: buildInstructions(opts.personaLabel),
          voice: opts.voice,
          audio: {
            input: { format: { type: "audio/pcm", rate } },
            output: { format: { type: "audio/pcm", rate } }
          },
          turn_detection: opts.turnMode === "vad" ? { type: "server_vad" } : null
        }
      })
    );
  }, []);

  const interruptAssistant = useCallback(() => {
    stopPlaybackOnly();
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "response.cancel" }));
    }
  }, [stopPlaybackOnly]);

  const handleServerEvent = useCallback(
    (raw: string) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return;
      }
      const type = typeof msg.type === "string" ? msg.type : "";
      const ws = wsRef.current;

      if (type === "input_audio_buffer.speech_started") {
        stopPlaybackOnly();
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "response.cancel" }));
        }
      }

      if (type === "response.output_audio.delta") {
        const delta = typeof msg.delta === "string" ? msg.delta : "";
        if (delta) {
          enqueuePlayback(delta);
        }
      }

      if (type === "response.output_audio_transcript.delta") {
        const delta = typeof msg.delta === "string" ? msg.delta : "";
        if (delta) {
          setAssistantCaption((c) => c + delta);
        }
      }

      if (type === "response.done") {
        setAssistantCaption((c) => (c.trim() ? `${c.trim()}\n\n` : c));
      }

      if (type === "conversation.item.input_audio_transcription.completed") {
        const transcript =
          typeof msg.transcript === "string"
            ? msg.transcript
            : typeof (msg as { item?: { transcript?: string } }).item?.transcript === "string"
              ? (msg as { item: { transcript: string } }).item.transcript
              : "";
        if (transcript.trim()) {
          setUserCaption((c) => {
            const next = c.trim() ? `${c.trim()}\n${transcript.trim()}` : transcript.trim();
            return `${next}\n`;
          });
        }
      }

      if (type === "error") {
        const errObj = msg.error as { message?: string } | undefined;
        const m = typeof errObj?.message === "string" ? errObj.message : "voice_realtime_error";
        setErrorMessage(m);
      }
    },
    [enqueuePlayback, stopPlaybackOnly]
  );

  const connect = useCallback(
    async (opts: ConnOpts) => {
      disconnect();
      turnModeRef.current = opts.turnMode;
      setStatus("connecting");
      setErrorMessage(null);
      setUserCaption("");
      setAssistantCaption("");
      sessionConfiguredRef.current = false;
      sessionUpdateSentRef.current = false;

      try {
        const tokenRes = await fetch("/api/app-user/xchat/voice-realtime/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiresAfterSeconds: 600 })
        });
        const payload = (await tokenRes.json().catch(() => ({}))) as TokenResponse;
        if (!tokenRes.ok) {
          throw new Error(
            typeof (payload as { error?: string }).error === "string"
              ? (payload as { error: string }).error
              : "token_denied"
          );
        }
        const secret = payload.data?.client_secret?.value?.trim();
        const wsUrl = payload.data?.realtime_ws_url?.trim();
        if (!secret || !wsUrl) {
          throw new Error("token_payload_invalid");
        }

        const AudioCtx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) {
          throw new Error("audio_context_unsupported");
        }
        audioContextRef.current = new AudioCtx();
        if (audioContextRef.current.state === "suspended") {
          await audioContextRef.current.resume();
        }

        const socket = new WebSocket(wsUrl, realtimeWebSocketProtocols(secret));
        const sessionGen = generationRef.current;
        wsRef.current = socket;

        socket.onopen = () => {
          /* wait for session.created / conversation.created */
        };

        socket.onmessage = (event) => {
          if (wsRef.current !== socket) {
            return;
          }
          const data = typeof event.data === "string" ? event.data : "";
          if (!data) {
            return;
          }
          try {
            const parsed = JSON.parse(data) as { type?: string };
            const t = parsed.type ?? "";
            if (
              !sessionUpdateSentRef.current &&
              (t === "conversation.created" || t === "session.created")
            ) {
              sessionUpdateSentRef.current = true;
              sendSessionUpdate(socket, opts);
            }
            if (t === "session.updated") {
              sessionConfiguredRef.current = true;
              setStatus("live");
              if (opts.turnMode === "vad") {
                startMic(socket);
              }
            }
          } catch {
            /* fall through */
          }
          handleServerEvent(data);
        };

        socket.onerror = () => {
          if (wsRef.current !== socket) {
            return;
          }
          setErrorMessage("WebSocket error");
          setStatus("error");
        };

        socket.onclose = () => {
          if (sessionGen !== generationRef.current) {
            return;
          }
          if (wsRef.current !== socket) {
            return;
          }
          sessionConfiguredRef.current = false;
          sessionUpdateSentRef.current = false;
          stopMic();
          wsRef.current = null;
          setStatus((s) => (s === "connecting" || s === "live" ? "error" : "idle"));
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "connect_failed";
        setErrorMessage(msg);
        setStatus("error");
        teardownAudio();
      }
    },
    [disconnect, handleServerEvent, sendSessionUpdate, startMic, stopMic, teardownAudio]
  );

  /** Push-to-talk: hold to stream PCM; release to commit and request a response. */
  const pushPointerDown = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !sessionConfiguredRef.current) {
      return;
    }
    if (turnModeRef.current !== "push") {
      return;
    }
    interruptAssistant();
    pendingFloatPartsRef.current = [];
    pendingSamplesRef.current = 0;
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
    }
    startMicPush(ws);
  }, [interruptAssistant, startMicPush]);

  const pushPointerUp = useCallback(() => {
    const ws = wsRef.current;
    stopMic();
    if (!ws || ws.readyState !== WebSocket.OPEN || !sessionConfiguredRef.current) {
      return;
    }
    if (turnModeRef.current !== "push") {
      return;
    }
    flushAppend(ws);
    ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    ws.send(JSON.stringify({ type: "response.create" }));
  }, [flushAppend, stopMic]);

  return {
    status,
    errorMessage,
    userCaption,
    assistantCaption,
    connect,
    disconnect,
    interruptAssistant,
    pushPointerDown,
    pushPointerUp
  };
}
