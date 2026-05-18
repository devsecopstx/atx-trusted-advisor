import { XchatConversationLoadingChrome } from "@/app/xchat/ui/xchat-conversation-loading-chrome";

import "./xchat-thread.css";

/** Static shell placeholder while the dynamic xChat segment resolves (force-dynamic data still streams in). */
export default function XchatLoading() {
  return (
    <div className="xchat-shell flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <XchatConversationLoadingChrome />
    </div>
  );
}
