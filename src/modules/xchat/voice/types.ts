/** xChat Voice Mode — aligned with xAI Voice Agent built-ins + REST `voice` field. */

export type XchatVoicePresetId = "ara" | "eve" | "leo" | "rex" | "sal";

export const XCHAT_VOICE_PRESETS: readonly XchatVoicePresetId[] = ["eve", "ara", "rex", "sal", "leo"] as const;

export type XchatVoiceTurnMode = "vad" | "push";

export type XaiVoiceRealtimeModelId = "grok-voice-think-fast-1.0" | "grok-voice-fast-1.0";
