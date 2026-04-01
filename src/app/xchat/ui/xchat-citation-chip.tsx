"use client";

import Link from "next/link";

import { citationChipRenderable, resolveCitationPresentation } from "@/lib/xchat-citations";

type XchatCitationChipProps = {
  slug: string;
  label?: string;
};

export function XchatCitationChip({ slug, label }: XchatCitationChipProps) {
  if (!citationChipRenderable(slug, label)) {
    return null;
  }
  const { title, href, external } = resolveCitationPresentation(slug, label);

  const className = "xchat-citation-chip";

  if (href && !external) {
    return (
      <Link className={className} href={href} title={`Open ${title}`}>
        <span className="xchat-citation-chip__glyph" aria-hidden>
          ◈
        </span>
        <span className="xchat-citation-chip__text">{title}</span>
      </Link>
    );
  }

  if (href && external) {
    return (
      <a className={className} href={href} rel="noopener noreferrer" target="_blank" title={title}>
        <span className="xchat-citation-chip__glyph" aria-hidden>
          ◈
        </span>
        <span className="xchat-citation-chip__text">{title}</span>
      </a>
    );
  }

  return (
    <span className={`${className} xchat-citation-chip--static`} title={`Source: ${title}`}>
      <span className="xchat-citation-chip__glyph" aria-hidden>
        ◈
      </span>
      <span className="xchat-citation-chip__text">{title}</span>
    </span>
  );
}
