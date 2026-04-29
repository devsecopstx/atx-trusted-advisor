import { describe, expect, it } from "vitest";

import { parseDeskWellnessTaggedOutput } from "@/modules/portfolio/desk-wellness-xai-brief";

describe("parseDeskWellnessTaggedOutput", () => {
  it("parses minimal tagged shape", () => {
    const raw = `<<<WEATHER>>>
72°F and partly cloudy in Austin.
<<<WELLNESS>>>
Stand and stretch every hour.`;
    expect(parseDeskWellnessTaggedOutput(raw)).toEqual({
      weatherLine: "72°F and partly cloudy in Austin.",
      wellnessLine: "Stand and stretch every hour."
    });
  });

  it("trims outer whitespace and collapses inner spaces", () => {
    const raw = `
  <<<WEATHER>>>
  partly   cloudy,   65°F
  <<<WELLNESS>>>
  drink   water
  `;
    expect(parseDeskWellnessTaggedOutput(raw)).toEqual({
      weatherLine: "partly cloudy, 65°F",
      wellnessLine: "drink water"
    });
  });

  it("returns null when WEATHER tag is missing", () => {
    expect(parseDeskWellnessTaggedOutput("<<<WELLNESS>>>only")).toBeNull();
  });

  it("returns null when WELLNESS tag is missing", () => {
    expect(parseDeskWellnessTaggedOutput("<<<WEATHER>>>only")).toBeNull();
  });

  it("returns null when WELLNESS appears before WEATHER", () => {
    const raw = `<<<WELLNESS>>>first
<<<WEATHER>>>second`;
    expect(parseDeskWellnessTaggedOutput(raw)).toBeNull();
  });

  it("returns null when weather segment is empty", () => {
    const raw = `<<<WEATHER>>>
<<<WELLNESS>>>
ok`;
    expect(parseDeskWellnessTaggedOutput(raw)).toBeNull();
  });

  it("returns null when wellness segment is empty", () => {
    const raw = `<<<WEATHER>>>
ok
<<<WELLNESS>>>`;
    expect(parseDeskWellnessTaggedOutput(raw)).toBeNull();
  });
});
