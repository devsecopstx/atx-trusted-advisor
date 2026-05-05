import Link from "next/link";
import type { SVGProps } from "react";

import { LucideBookOpenIcon, LucideMonitorIcon } from "@/app/ui/lucide-product-icons";
import { RailSidebarZapIcon } from "@/app/ui/rail-sidebar-zap-icon";
import type { ResourceGuideSection, ResourceGuideSectionIcon } from "@/lib/marketing/resource-guides-catalog";

function WheelCycleIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className} {...props}>
      <path
        d="M21 12a9 9 0 0 0-9-9 9 9 0 0 0-6.36 2.64L3 10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
      <path d="M3 5v5h5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} />
      <path
        d="M3 12a9 9 0 0 0 9 9 9 9 0 0 0 6.36-2.64L21 14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
      <path d="M21 19v-5h-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} />
    </svg>
  );
}

function ResourceGuidePanelIcon({
  icon,
  className
}: {
  icon: ResourceGuideSectionIcon;
  className?: string;
}) {
  const cls = ["resources-guides-hub__panel-icon-svg", className].filter(Boolean).join(" ");
  switch (icon) {
    case "platform":
      return <LucideMonitorIcon className={cls} />;
    case "xchat":
      return <RailSidebarZapIcon className={cls} size="disclosure" />;
    case "wheel":
      return <WheelCycleIcon className={cls} />;
    case "playbooks":
      return <LucideBookOpenIcon className={cls} />;
  }
}

export function ResourceGuidesHubPanels({ sections }: { sections: readonly ResourceGuideSection[] }) {
  return (
    <div className="resources-guides-hub__panel-grid">
      {sections.map((section) => (
        <section
          key={section.id}
          className={`resources-guides-hub__panel resources-guides-hub__panel--${section.icon}`}
          id={section.id}
          aria-labelledby={`resources-guides-hub-${section.id}-title`}
        >
          <div className="resources-guides-hub__panel-header">
            <div className="resources-guides-hub__panel-icon-wrap" aria-hidden>
              <ResourceGuidePanelIcon icon={section.icon} />
            </div>
            <div className="resources-guides-hub__panel-headings">
              <h2 className="resources-guides-hub__panel-title" id={`resources-guides-hub-${section.id}-title`}>
                {section.heading}
              </h2>
              <p className="resources-guides-hub__panel-subtitle">{section.subtitle}</p>
            </div>
          </div>

          <ul className="resources-guides-hub__link-list">
            {section.links.map((link) => (
              <li key={link.href}>
                <Link className="resources-guides-hub__link" href={link.href}>
                  <span className="resources-guides-hub__link-body">
                    <span className="resources-guides-hub__link-title">{link.title}</span>
                    <span className="resources-guides-hub__link-desc">{link.description}</span>
                  </span>
                  <span className="resources-guides-hub__link-chevron" aria-hidden>
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
