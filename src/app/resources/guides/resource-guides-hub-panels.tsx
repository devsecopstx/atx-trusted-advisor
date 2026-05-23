import Link from "next/link";

import {
    ResourceGuideGroupIcon,
    ResourceGuideLinkIcon,
    ResourceGuideSectionPanelIcon
} from "@/app/resources/guides/resource-guides-hub-icons";
import {
    RESOURCE_GUIDE_GROUPS,
    type ResourceGuideGroupId,
    type ResourceGuideSection
} from "@/lib/marketing/resource-guides-catalog";

function sectionsForGroup(
  sections: readonly ResourceGuideSection[],
  groupId: ResourceGuideGroupId
): ResourceGuideSection[] {
  return sections.filter((section) => section.group === groupId);
}

function GuidePanel({ section }: { section: ResourceGuideSection }) {
  return (
    <section
      className={`resources-guides-hub__panel resources-guides-hub__panel--${section.icon}`}
      id={section.id}
      aria-labelledby={`resources-guides-hub-${section.id}-title`}
    >
      <div className="resources-guides-hub__panel-header">
        <div className="resources-guides-hub__panel-icon-wrap" aria-hidden>
          <ResourceGuideSectionPanelIcon icon={section.icon} />
        </div>
        <div className="resources-guides-hub__panel-headings">
          <div className="resources-guides-hub__panel-title-row">
            <h3 className="resources-guides-hub__panel-title" id={`resources-guides-hub-${section.id}-title`}>
              {section.heading}
            </h3>
            <span className="resources-guides-hub__panel-count" aria-label={`${section.links.length} guides`}>
              {section.links.length}
            </span>
          </div>
          <p className="resources-guides-hub__panel-subtitle">{section.subtitle}</p>
        </div>
      </div>

      <ul className="resources-guides-hub__link-list">
        {section.links.map((link) => (
          <li key={link.href}>
            <Link className="resources-guides-hub__link" href={link.href}>
              <span className="resources-guides-hub__link-icon-wrap" aria-hidden>
                <ResourceGuideLinkIcon className="resources-guides-hub__link-icon-svg" href={link.href} />
              </span>
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
  );
}

export function ResourceGuidesHubPanels({ sections }: { sections: readonly ResourceGuideSection[] }) {
  return (
    <div className="resources-guides-hub__groups">
      {RESOURCE_GUIDE_GROUPS.map((group) => {
        const groupSections = sectionsForGroup(sections, group.id);
        if (groupSections.length === 0) {
          return null;
        }

        return (
          <div className={`resources-guides-hub__group resources-guides-hub__group--${group.id}`} key={group.id}>
            <header className="resources-guides-hub__group-header">
              <div className="resources-guides-hub__group-icon-wrap" aria-hidden>
                <ResourceGuideGroupIcon groupId={group.id} />
              </div>
              <div className="resources-guides-hub__group-copy">
                <p className="resources-guides-hub__group-eyebrow">{group.eyebrow}</p>
                <h2 className="resources-guides-hub__group-title">{group.title}</h2>
                <p className="resources-guides-hub__group-desc">{group.description}</p>
              </div>
            </header>

            <div className="resources-guides-hub__panel-grid">
              {groupSections.map((section) => (
                <GuidePanel key={section.id} section={section} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
