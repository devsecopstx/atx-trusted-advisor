import { GlobalFooter } from "@/app/ui/global-footer";
import { XchatRouteSkeleton } from "@/app/xchat/ui/xchat-route-skeleton";

export default function XchatLoading() {
  return (
    <div className="xchat-shell">
      <div className="xchat-body px-4 py-6 md:px-8">
        <XchatRouteSkeleton />
      </div>
      <GlobalFooter />
    </div>
  );
}
