import { describe, expect, it } from "vitest";

import {
    clearXchatSpeechPlaybackIfMessage,
    getXchatSpeechPlaybackActiveMessageId,
    setXchatSpeechPlaybackActiveMessageId,
    subscribeXchatSpeechPlayback
} from "@/app/xchat/ui/xchat-speech-playback-store";

describe("xchat-speech-playback-store", () => {
  it("tracks active message id and notifies subscribers", () => {
    let calls = 0;
    const unsub = subscribeXchatSpeechPlayback(() => {
      calls += 1;
    });

    expect(getXchatSpeechPlaybackActiveMessageId()).toBe(null);

    setXchatSpeechPlaybackActiveMessageId("m1");
    expect(getXchatSpeechPlaybackActiveMessageId()).toBe("m1");
    expect(calls).toBe(1);

    setXchatSpeechPlaybackActiveMessageId("m2");
    expect(getXchatSpeechPlaybackActiveMessageId()).toBe("m2");
    expect(calls).toBe(2);

    clearXchatSpeechPlaybackIfMessage("m1");
    expect(getXchatSpeechPlaybackActiveMessageId()).toBe("m2");

    clearXchatSpeechPlaybackIfMessage("m2");
    expect(getXchatSpeechPlaybackActiveMessageId()).toBe(null);
    expect(calls).toBe(3);

    unsub();
  });
});
