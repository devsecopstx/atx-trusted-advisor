import { XchatRouteSkeleton } from "@/app/xchat/ui/xchat-route-skeleton";

export default function XchatLoading() {
  return (
    <div className="xchat-shell flex min-h-0 flex-col overflow-hidden">
      <div className="workspace-product-sticky-top sticky top-0 z-50 flex shrink-0 flex-col bg-[var(--xf-bg-800)]">
        <div className="xchat-header">
          <div className="h-9 w-full max-w-[min(100%,420px)] animate-pulse rounded-md bg-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)]" />
        </div>
      </div>
      <div className="xchat-body flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-6 md:px-8">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <XchatRouteSkeleton />
        </div>
      </div>
    </div>
  );
}
