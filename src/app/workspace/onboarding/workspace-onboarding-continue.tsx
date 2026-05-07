"use client";

import { useRouter } from "next/navigation";

import { XCHAT_PENDING_PROMPT_STORAGE_KEY } from "@/lib/xchat/xchat-pending-prompt";

type WorkspaceOnboardingContinueProps = {
  composerDraft: string;
  className?: string;
};

export function WorkspaceOnboardingContinue({ composerDraft, className }: WorkspaceOnboardingContinueProps) {
  const router = useRouter();

  return (
    <button
      className={className}
      type="button"
      onClick={() => {
        try {
          sessionStorage.setItem(XCHAT_PENDING_PROMPT_STORAGE_KEY, composerDraft);
        } catch {
          /* ignore */
        }
        router.push("/xchat?rail=xchat&item=composer");
      }}
    >
      Continue to xChat
    </button>
  );
}
