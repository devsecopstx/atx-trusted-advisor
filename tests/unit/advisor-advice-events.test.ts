import { describe, expect, it } from "vitest";

import {
    isSubstantiveAdvisorAdviceResponse,
    shouldPersistAdvisorAdviceArchive
} from "@/modules/compliance/advisor-advice-events";

describe("advisor advice events", () => {
  it("persists only for advisor role without global_admin", () => {
    expect(shouldPersistAdvisorAdviceArchive(["advisor"])).toBe(true);
    expect(shouldPersistAdvisorAdviceArchive(["operator"])).toBe(false);
    expect(shouldPersistAdvisorAdviceArchive(["viewer"])).toBe(false);
    expect(shouldPersistAdvisorAdviceArchive(["global_admin"])).toBe(false);
    expect(shouldPersistAdvisorAdviceArchive(["global_admin", "advisor"])).toBe(false);
  });

  it("skips non-advice boilerplate responses", () => {
    expect(isSubstantiveAdvisorAdviceResponse("I could not run the options scan right now.")).toBe(
      false
    );
    expect(
      isSubstantiveAdvisorAdviceResponse("Understood, staying in chat. I will continue in normal chat mode.")
    ).toBe(false);
    expect(isSubstantiveAdvisorAdviceResponse("## Covered call ideas\n- TSLA")).toBe(true);
  });
});
