import type { SessionUser } from "@/lib/auth";
import { caughtErrorMessage } from "@/lib/caught-error";
import { buildPortfolioSummaryPayload } from "@/lib/portfolio-api-response";
import { getDefaultPortfolio } from "@/modules/core-admin/repository";

import type { XsbInitialWorkspace } from "./workspace-types";

export async function loadXsbInitialWorkspace(session: SessionUser): Promise<XsbInitialWorkspace> {
  try {
    const portfolio = await getDefaultPortfolio(session.userId, {
      tenantId: session.tenantId
    });
    if (!portfolio?._id) {
      return {
        status: "error",
        message:
          "No workspace book is assigned yet. Your workspace administrator must set your default portfolio in the admin console before xStrategyBuilder can use book context, outlook, and risk."
      };
    }

    const data = await buildPortfolioSummaryPayload(session, portfolio);
    return {
      status: "ready",
      portfolio: {
        _id: data._id,
        name: data.name,
        isDefault: data.isDefault,
        scoringFactors: data.scoringFactors,
        accounts: data.accounts.map((a) => ({
          _id: a._id,
          name: a.name,
          accountRef: a.accountRef,
          brokerType: a.brokerType,
          balance: a.balance,
          riskProfile: a.riskProfile,
          outlook: a.outlook
        }))
      }
    };
  } catch (error) {
    return { status: "error", message: caughtErrorMessage(error) };
  }
}
