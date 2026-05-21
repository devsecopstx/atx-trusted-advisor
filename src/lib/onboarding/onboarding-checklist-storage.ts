import {
    ONBOARDING_CHECKLIST_STEP_IDS,
    type OnboardingChecklistStepId,
} from "@/lib/onboarding/onboarding-checklist-steps";

export const ONBOARDING_CHECKLIST_STORAGE_KEY_PREFIX = "xf_onboarding_checklist_v1";

export type OnboardingChecklistPersistedState = {
  completedStepIds: OnboardingChecklistStepId[];
  updatedAt: string;
};

export function buildOnboardingChecklistStorageKey(userId: string | null): string {
  if (userId?.trim()) {
    return `${ONBOARDING_CHECKLIST_STORAGE_KEY_PREFIX}:${userId.trim()}`;
  }
  return ONBOARDING_CHECKLIST_STORAGE_KEY_PREFIX;
}

export function parseOnboardingChecklistState(raw: string | null): OnboardingChecklistPersistedState {
  if (!raw) {
    return { completedStepIds: [], updatedAt: "" };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingChecklistPersistedState>;
    const completedStepIds = Array.isArray(parsed.completedStepIds)
      ? parsed.completedStepIds.filter((id): id is OnboardingChecklistStepId =>
          ONBOARDING_CHECKLIST_STEP_IDS.includes(id as OnboardingChecklistStepId),
        )
      : [];
    return {
      completedStepIds,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return { completedStepIds: [], updatedAt: "" };
  }
}

export function readOnboardingChecklistState(userId: string | null): OnboardingChecklistPersistedState {
  if (typeof window === "undefined") {
    return { completedStepIds: [], updatedAt: "" };
  }
  try {
    return parseOnboardingChecklistState(
      window.localStorage.getItem(buildOnboardingChecklistStorageKey(userId)),
    );
  } catch {
    return { completedStepIds: [], updatedAt: "" };
  }
}

export function writeOnboardingChecklistState(
  userId: string | null,
  completedStepIds: OnboardingChecklistStepId[],
): void {
  if (typeof window === "undefined") {
    return;
  }
  const payload: OnboardingChecklistPersistedState = {
    completedStepIds,
    updatedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(
      buildOnboardingChecklistStorageKey(userId),
      JSON.stringify(payload),
    );
  } catch {
    // ignore quota / private mode
  }
}

export function toggleOnboardingStepCompletion(
  userId: string | null,
  stepId: OnboardingChecklistStepId,
  completed: boolean,
): OnboardingChecklistStepId[] {
  const current = readOnboardingChecklistState(userId);
  const set = new Set(current.completedStepIds);
  if (completed) {
    set.add(stepId);
  } else {
    set.delete(stepId);
  }
  const next = ONBOARDING_CHECKLIST_STEP_IDS.filter((id) => set.has(id));
  writeOnboardingChecklistState(userId, next);
  return next;
}
