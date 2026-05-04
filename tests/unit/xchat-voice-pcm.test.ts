import { describe, expect, it } from "vitest";

import { base64PCM16ToFloat32, float32ToPCM16Base64 } from "@/modules/xchat/voice/pcm";

describe("xchat voice pcm", () => {
  it("roundtrips silence", () => {
    const samples = new Float32Array(240);
    samples.fill(0);
    const b64 = float32ToPCM16Base64(samples);
    const back = base64PCM16ToFloat32(b64);
    expect(back.length).toBe(240);
    for (let i = 0; i < back.length; i += 1) {
      expect(Math.abs(back[i] ?? 0)).toBeLessThan(1e-6);
    }
  });

  it("roundtrips a simple waveform within PCM16 range", () => {
    const samples = new Float32Array([0, 0.5, -0.25, 1, -1]);
    const back = base64PCM16ToFloat32(float32ToPCM16Base64(samples));
    expect(back.length).toBe(5);
    expect(back[0]).toBeCloseTo(0, 5);
    expect(back[1]).toBeCloseTo(0.5, 2);
    expect(back[2]).toBeCloseTo(-0.25, 2);
    expect(back[3]).toBeCloseTo(1, 2);
    expect(back[4]).toBeCloseTo(-1, 2);
  });
});
