import { redirect } from "next/navigation";

import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { getSessionUser } from "@/lib/auth";

import "../../xchat/xchat.css";
import "../xstrategybuilder.css";
import { StrategyOptionsConsole } from "./strategy-options-console";

type StrategyOptionsPageProps = {
  searchParams?: Promise<{ symbol?: string }>;
};

export default async function StrategyOptionsPage({ searchParams }: StrategyOptionsPageProps) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/xchat");
  }
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialSymbol =
    typeof resolvedSearchParams?.symbol === "string" && resolvedSearchParams.symbol.trim().length > 0
      ? resolvedSearchParams.symbol.trim().toUpperCase()
      : undefined;

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="xstrategybuilder" feedbackPageLabel="xStrategyBuilder" session={session} />
      <StrategyOptionsConsole initialSymbol={initialSymbol} />
    </div>
  );
}
