"use client";

import type { XchatConversationProps } from "@/app/xchat/ui/xchat-conversation";
import nextDynamic from "next/dynamic";

import "./xchat-thread.css";

import { XchatConversationLoadingChrome } from "./ui/xchat-conversation-loading-chrome";

const XchatConversationLazy = nextDynamic(
  () => import("./ui/xchat-conversation").then((m) => ({ default: m.XchatConversation })),
  {
    ssr: false,
    loading: () => <XchatConversationLoadingChrome />
  }
);

export function XchatConversationMount(props: XchatConversationProps) {
  return <XchatConversationLazy {...props} />;
}
