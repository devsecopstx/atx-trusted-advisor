import type { ReactNode, SVGProps } from "react";

import { LucideBookOpenIcon, LucideMonitorIcon } from "@/app/ui/lucide-product-icons";
import { RailSidebarZapIcon } from "@/app/ui/rail-sidebar-zap-icon";
import type { ResourceGuideGroupId, ResourceGuideSectionIcon } from "@/lib/marketing/resource-guides-catalog";

type IconProps = SVGProps<SVGSVGElement>;

function GuideIconBase({ className, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className} {...props}>
      {children}
    </svg>
  );
}

export function GuideLayersIcon({ className, ...props }: IconProps) {
  return (
    <GuideIconBase className={className} {...props}>
      <path
        d="M12 2 2 7l10 5 10-5-10-5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
      <path d="m2 12 10 5 10-5" stroke="currentColor" strokeLinejoin="round" strokeWidth={1.75} />
      <path d="m2 17 10 5 10-5" stroke="currentColor" strokeLinejoin="round" strokeWidth={1.75} />
    </GuideIconBase>
  );
}

export function GuideWheelIcon({ className, ...props }: IconProps) {
  return (
    <GuideIconBase className={className} {...props}>
      <path
        d="M21 12a9 9 0 1 1-9-9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={1.75}
      />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" strokeLinecap="round" strokeWidth={1.75} />
      <path d="M7.5 7.5 9.6 9.6M14.4 14.4l2.1 2.1M16.5 7.5l-2.1 2.1M9.6 14.4 7.5 16.5" stroke="currentColor" strokeLinecap="round" strokeWidth={1.75} />
      <circle cx="12" cy="12" r="2.25" stroke="currentColor" strokeWidth={1.75} />
    </GuideIconBase>
  );
}

export function GuideLibraryIcon({ className, ...props }: IconProps) {
  return (
    <GuideIconBase className={className} {...props}>
      <path
        d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={1.75}
      />
      <path
        d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
      <path d="M8 7h8M8 11h6" stroke="currentColor" strokeLinecap="round" strokeWidth={1.75} />
    </GuideIconBase>
  );
}

export function GuideChecklistIcon({ className, ...props }: IconProps) {
  return (
    <GuideIconBase className={className} {...props}>
      <rect height="16" rx="2" width="14" x="5" y="4" stroke="currentColor" strokeWidth={1.75} />
      <path d="M9 9h6M9 13h4" stroke="currentColor" strokeLinecap="round" strokeWidth={1.75} />
      <path d="m3 9 2 2 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} />
    </GuideIconBase>
  );
}

export function GuideInfoIcon({ className, ...props }: IconProps) {
  return (
    <GuideIconBase className={className} {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={1.75} />
      <path d="M12 10v6M12 7h.01" stroke="currentColor" strokeLinecap="round" strokeWidth={1.75} />
    </GuideIconBase>
  );
}

export function GuideFlowIcon({ className, ...props }: IconProps) {
  return (
    <GuideIconBase className={className} {...props}>
      <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth={1.75} />
      <circle cx="18" cy="12" r="2.5" stroke="currentColor" strokeWidth={1.75} />
      <circle cx="8" cy="18" r="2.5" stroke="currentColor" strokeWidth={1.75} />
      <path d="M8.2 7.8 15.8 10.2M15.8 13.8 9.8 16.2" stroke="currentColor" strokeLinecap="round" strokeWidth={1.75} />
    </GuideIconBase>
  );
}

export function GuideSparkIcon({ className, ...props }: IconProps) {
  return (
    <GuideIconBase className={className} {...props}>
      <path
        d="m12 3 1.4 4.3H18l-3.6 2.6 1.4 4.3L12 11.6 8.2 14.2l1.4-4.3L6 7.3h4.6L12 3Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
      <path d="M19 5v2M20 6h-2M5 19v2M6 20H4" stroke="currentColor" strokeLinecap="round" strokeWidth={1.75} />
    </GuideIconBase>
  );
}

export function GuideRocketIcon({ className, ...props }: IconProps) {
  return (
    <GuideIconBase className={className} {...props}>
      <path
        d="M12 14.5V20M8 18l4 2 4-2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
      <path
        d="M12 3c-2.5 2.8-3.5 5.8-3.5 8.5a3.5 3.5 0 0 0 7 0C15.5 8.8 14.5 5.8 12 3Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
    </GuideIconBase>
  );
}

export function GuidePromptIcon({ className, ...props }: IconProps) {
  return (
    <GuideIconBase className={className} {...props}>
      <path
        d="M7 8h10M7 12h6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={1.75}
      />
      <path
        d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
    </GuideIconBase>
  );
}

export function GuideQuantIcon({ className, ...props }: IconProps) {
  return (
    <GuideIconBase className={className} {...props}>
      <path d="M4 20V4M4 20h16" stroke="currentColor" strokeLinecap="round" strokeWidth={1.75} />
      <path
        d="M7 16c2-5 4-7 6-7s4 2 6 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
      <path d="M9 12h6" stroke="currentColor" strokeLinecap="round" strokeWidth={1.75} />
    </GuideIconBase>
  );
}

export function GuideCompareIcon({ className, ...props }: IconProps) {
  return (
    <GuideIconBase className={className} {...props}>
      <path d="M8 8h8v8H8z" stroke="currentColor" strokeLinejoin="round" strokeWidth={1.75} />
      <path d="M4 4v16M20 4v16" stroke="currentColor" strokeLinecap="round" strokeWidth={1.75} />
    </GuideIconBase>
  );
}

export function GuideIncomeIcon({ className, ...props }: IconProps) {
  return (
    <GuideIconBase className={className} {...props}>
      <path d="M4 18V6M20 18V6" stroke="currentColor" strokeLinecap="round" strokeWidth={1.75} />
      <path d="M8 14l3-3 3 2 4-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} />
    </GuideIconBase>
  );
}

export function GuideShieldIcon({ className, ...props }: IconProps) {
  return (
    <GuideIconBase className={className} {...props}>
      <path
        d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} />
    </GuideIconBase>
  );
}

export function GuideBriefcaseIcon({ className, ...props }: IconProps) {
  return (
    <GuideIconBase className={className} {...props}>
      <rect height="12" rx="2" width="16" x="4" y="8" stroke="currentColor" strokeWidth={1.75} />
      <path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth={1.75} />
      <path d="M4 13h16" stroke="currentColor" strokeWidth={1.75} />
    </GuideIconBase>
  );
}

export function GuideHandoffIcon({ className, ...props }: IconProps) {
  return (
    <GuideIconBase className={className} {...props}>
      <path d="M8 12h8M14 8l4 4-4 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} />
      <path d="M4 6v12" stroke="currentColor" strokeLinecap="round" strokeWidth={1.75} />
    </GuideIconBase>
  );
}

export function GuideArticleIcon({ className, ...props }: IconProps) {
  return (
    <GuideIconBase className={className} {...props}>
      <path
        d="M7 4h10a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
      <path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" strokeLinecap="round" strokeWidth={1.75} />
    </GuideIconBase>
  );
}

type GuideIconComponent = (props: IconProps) => ReactNode;

const LINK_ICON_BY_HREF: Record<string, GuideIconComponent> = {
  "/resources/onboarding-checklist": GuideChecklistIcon,
  "/resources/about": GuideInfoIcon,
  "/resources/decision-workflow": GuideFlowIcon,
  "/resources/secret-sauce": GuideSparkIcon,
  "/resources/getting-started": GuideRocketIcon,
  "/resources/top-10-hnwi-xchat-prompts": GuidePromptIcon,
  "/resources/quant-trader-guide": GuideQuantIcon,
  "/resources/building-wheel": GuideWheelIcon,
  "/resources/building-wheel/wheel-vs-iron-condor": GuideCompareIcon,
  "/resources/2026-options-income-playbook": GuideIncomeIcon,
  "/resources/how-xai-spots-better-wheels": GuideSparkIcon,
  "/resources/cash-secured-puts-mastery": GuideShieldIcon,
  "/resources/covered-calls-2026-balanced-income": GuideIncomeIcon,
  "/resources/leap-options-playbook": GuideRocketIcon,
  "/resources/multi-portfolio-management-hnwi": GuideBriefcaseIcon,
  "/resources/options-risk-management-frameworks": GuideShieldIcon,
  "/resources/from-xchat-to-broker-ibkr": GuideHandoffIcon
};

export function ResourceGuideLinkIcon({ href, className }: { href: string; className?: string }) {
  const Icon = LINK_ICON_BY_HREF[href] ?? GuideArticleIcon;
  return <Icon className={className} />;
}

export function ResourceGuideSectionPanelIcon({
  icon,
  className
}: {
  icon: ResourceGuideSectionIcon;
  className?: string;
}) {
  const cls = ["resources-guides-hub__panel-icon-svg", className].filter(Boolean).join(" ");
  switch (icon) {
    case "platform":
      return <GuideLayersIcon className={cls} />;
    case "xchat":
      return <RailSidebarZapIcon className={cls} size="disclosure" />;
    case "wheel":
      return <GuideWheelIcon className={cls} />;
    case "playbooks":
      return <GuideLibraryIcon className={cls} />;
  }
}

export function ResourceGuideGroupIcon({
  groupId,
  className
}: {
  groupId: ResourceGuideGroupId;
  className?: string;
}) {
  const cls = ["resources-guides-hub__group-icon-svg", className].filter(Boolean).join(" ");
  switch (groupId) {
    case "foundation":
      return <LucideMonitorIcon className={cls} />;
    case "prompts":
      return <RailSidebarZapIcon className={cls} size="disclosure" />;
    case "income":
      return <GuideWheelIcon className={cls} />;
    case "library":
      return <LucideBookOpenIcon className={cls} />;
  }
}

export function ResourceGuideJumpIcon({
  icon,
  className
}: {
  icon: ResourceGuideSectionIcon;
  className?: string;
}) {
  return <ResourceGuideSectionPanelIcon icon={icon} className={className} />;
}
