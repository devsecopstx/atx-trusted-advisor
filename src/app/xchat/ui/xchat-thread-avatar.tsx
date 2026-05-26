"use client";

import { useTenantShellBranding } from "@/app/ui/tenant-branding-context";

export type XchatThreadAvatarProps = {
  role: "user" | "ai";
  userAvatarUrl?: string | null;
  userDisplayName?: string | null;
};

function initialsFromLabel(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function XchatThreadAvatar({ role, userAvatarUrl, userDisplayName }: XchatThreadAvatarProps) {
  const tenant = useTenantShellBranding();
  const tenantLabel = tenant?.xchatBrandName?.trim() || tenant?.displayName?.trim() || "Advisor";

  if (role === "user") {
    const userSrc = userAvatarUrl?.trim();
    if (userSrc) {
      return (
        <div className="xchat-thread-avatar xchat-thread-avatar--user" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element -- OAuth avatar URL */}
          <img alt="" className="xchat-thread-avatar__img" height={36} src={userSrc} width={36} />
        </div>
      );
    }
    const userInitials = initialsFromLabel(userDisplayName?.trim() || "You");
    return (
      <div
        className="xchat-thread-avatar xchat-thread-avatar--user xchat-thread-avatar--initials"
        aria-hidden
      >
        <span>{userInitials}</span>
      </div>
    );
  }

  const logoSrc = tenant?.logoUrl?.trim();
  if (logoSrc) {
    return (
      <div className="xchat-thread-avatar xchat-thread-avatar--ai" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- tenant logo from preferences */}
        <img alt="" className="xchat-thread-avatar__img" height={36} src={logoSrc} width={36} />
      </div>
    );
  }

  return (
    <div
      className="xchat-thread-avatar xchat-thread-avatar--ai xchat-thread-avatar--initials"
      aria-hidden
      title={tenantLabel}
    >
      <span>{initialsFromLabel(tenantLabel)}</span>
    </div>
  );
}
