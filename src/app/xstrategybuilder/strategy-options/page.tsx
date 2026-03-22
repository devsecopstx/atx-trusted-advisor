import { redirect } from "next/navigation";

import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { getSessionUser } from "@/lib/auth";

import "../../xchat/xchat.css";
import "../../xcoach/xcoach.css";
import { StrategyOptionsConsole } from "./strategy-options-console";

export default async function StrategyOptionsPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/xstrategybuilder/strategy-options");
  }

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="xstrategybuilder" feedbackPageLabel="xStrategyBuilder" session={session} />
      <StrategyOptionsConsole />
    </div>
  );
}
