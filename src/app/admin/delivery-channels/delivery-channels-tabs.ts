export const DELIVERY_CHANNELS_TABS = [
  { id: "channels", label: "Channels" },
  { id: "xoptions", label: "xOptions API test" },
  { id: "xchat-api", label: "xChat API test" },
  { id: "test-post-x", label: "Test post to X" }
] as const;

export type DeliveryChannelsTabId = (typeof DELIVERY_CHANNELS_TABS)[number]["id"];

const TAB_IDS = new Set<string>(DELIVERY_CHANNELS_TABS.map((t) => t.id));

export function parseDeliveryChannelsTab(value: string | null | undefined): DeliveryChannelsTabId {
  const raw = (value ?? "").trim();
  if (TAB_IDS.has(raw)) {
    return raw as DeliveryChannelsTabId;
  }
  return "channels";
}
