import Link from "next/link";

import type { AdvisoryResourcePillar } from "@/lib/marketing/advisory-resource-pillars";

import { AboutPillarIcon } from "./about-pillar-icons";

type AboutPillarCardsProps = {
  pillars: readonly AdvisoryResourcePillar[];
};

export function AboutPillarCards({ pillars }: AboutPillarCardsProps) {
  return (
    <ul className="resources-about-pillars-cards">
      {pillars.map((item, i) => (
        <li key={item.href}>
          <Link className="resources-about-pillar-card" href={item.href}>
            <div className="resources-about-pillar-card__top">
              <span className="resources-about-pillar-card__num">{String(i + 1).padStart(2, "0")}</span>
              <span className="resources-about-pillar-card__icon-wrap">
                <AboutPillarIcon pillarIndex={i} />
              </span>
            </div>
            <h3 className="resources-about-pillar-card__title">{item.label}</h3>
            <p className="resources-about-pillar-card__blurb">{item.blurb}</p>
            <span className="resources-about-pillar-card__cta">
              Read article <span aria-hidden>→</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
