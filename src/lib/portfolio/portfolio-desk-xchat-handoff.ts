"use client";

import { collapseWorkspaceProductRail } from "@/lib/workspace-product-rail-storage";
import {
    writeXchatPendingComposerHandoff,
    XCHAT_PORTFOLIOS_DESK_ADVISOR_PERSONA_NAME
} from "@/lib/xchat/xchat-pending-prompt";

export function writePortfolioDeskXchatHandoff(prompt: string): void {
  collapseWorkspaceProductRail();
  writeXchatPendingComposerHandoff({
    prompt,
    personaName: XCHAT_PORTFOLIOS_DESK_ADVISOR_PERSONA_NAME
  });
}
