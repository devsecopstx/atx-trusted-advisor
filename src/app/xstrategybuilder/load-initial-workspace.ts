import type { SessionUser } from "@/lib/auth";
import { caughtErrorMessage } from "@/lib/caught-error";
import { buildPortfolioSummaryPayload } from "@/lib/portfolio-api-response";
import {
    getDefaultPortfolio,
    provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";

import type { XsbInitialWorkspace } from "./workspace-types";

export async function loadXsbInitialWorkspace(session: SessionUser): Promise<XsbInitialWorkspace> {
  try {
    let portfolio = await getDefaultPortfolio(session.userId, {
      tenantId: session.tenantId
    });
    if (!portfolio?._id) {
      const provisioned = await provisionDefaultPortfolioForUser({
        userId: session.userId,
        tenantId: session.tenantId,
        watchlistSymbols: ["TSLA"]
      });
      portfolio = provisioned.portfolio;
    }
    if (!portfolio?._id) {
      return { status: "error", message: "Default portfolio not found" };
    }

    const data = await buildPortfolioSummaryPayload(session, portfolio);
    return {
      status: "ready",
      portfolio: {
        _id: data._id,
        name: data.name,
        isDefault: data.isDefault,
        accounts: data.accounts.map((a) => ({
          _id: a._id,
          name: a.name,
          accountRef: a.accountRef,
          brokerType: a.brokerType,
          balance: a.balance
        }))
      }
    };
  } catch (error) {
    return { status: "error", message: caughtErrorMessage(error) };
  }
}
