import { Capacitor } from "@capacitor/core";

/** True when running inside a Capacitor native shell (iOS/Android), not mobile Safari alone. */
export function isCapacitorNativePlatform(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return Capacitor.isNativePlatform();
}
