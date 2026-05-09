"use client";

import nextDynamic from "next/dynamic";
import type { HTMLAttributes, ReactNode, TableHTMLAttributes } from "react";
import { useMemo } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { XchatCitationChip } from "@/app/xchat/ui/xchat-citation-chip";
import { preprocessXchatMarkdown } from "@/app/xchat/ui/xchat-markdown-preprocess";
import { useXfUiSoft } from "@/lib/use-xf-ui-soft";
import {
    citationChipRenderable,
    parseInlineXfChipCode,
    parseXfCitationFenceJson
} from "@/lib/xchat-citations";

/**
 * Perf: `react-syntax-highlighter` Prism + `oneDark`/`oneLight` style sheets are
 * one of the largest single contributions to the xChat bundle (well over 100 KB
 * gzipped between Prism core, language defs, and the JSON theme objects), but
 * the vast majority of assistant messages contain no fenced code blocks. Lazy
 * load the highlighter chunk via `next/dynamic` so it only ships when the first
 * code fence renders. Plain markdown messages (the common case) get the small
 * `react-markdown` core only.
 */
const XchatLazySyntaxHighlighter = nextDynamic(
  () => import("@/app/xchat/ui/xchat-prism-highlighter").then((m) => ({ default: m.XchatPrismHighlighter })),
  {
    ssr: false,
    loading: () => (
      <pre className="xchat-md-code-block-wrap xchat-md-code-block-wrap--loading">
        <code />
      </pre>
    )
  }
);

type XchatMarkdownBodyProps = {
  content: string;
  className?: string;
};

type MdCodeProps = HTMLAttributes<HTMLElement> & { inline?: boolean };

function mdInlineCodePlainText(children: ReactNode): string {
  if (children == null || typeof children === "boolean") {
    return "";
  }
  if (typeof children === "string") {
    return children;
  }
  if (typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(mdInlineCodePlainText).join("");
  }
  return "";
}

function createMarkdownComponents(xfSoft: boolean): Components {
  return {
    p({ children, className }) {
      return <div className={className ? `xchat-md-p ${className}` : "xchat-md-p"}>{children}</div>;
    },
    pre({ children, className }) {
      return (
        <div className={className ? `xchat-md-pre-wrap ${className}` : "xchat-md-pre-wrap"}>{children}</div>
      );
    },
    a({ href, children, ...rest }) {
      return (
        <a
          className="xchat-md-a"
          href={href ?? "#"}
          rel="noopener noreferrer"
          target="_blank"
          {...rest}
        >
          {children}
        </a>
      );
    },
    table({ children, ...rest }: TableHTMLAttributes<HTMLTableElement>) {
      return (
        <div className="xchat-md-table-wrap">
          <table {...rest}>{children}</table>
        </div>
      );
    },
    code({ className, children, inline, ...rest }: MdCodeProps) {
      const text = mdInlineCodePlainText(children).replace(/\n$/, "");
      if (!inline) {
        const match = /language-(\w+)/.exec(className ?? "");
        const lang = match?.[1] ?? "text";
        if (lang === "xf-citation") {
          const parsed = parseXfCitationFenceJson(text);
          if (parsed) {
            if (!citationChipRenderable(parsed.slug, parsed.label)) {
              return null;
            }
            return (
              <div className="xchat-citation-fence">
                <XchatCitationChip label={parsed.label} slug={parsed.slug} />
              </div>
            );
          }
          return <XchatLazySyntaxHighlighter language="json" value={text} xfSoft={xfSoft} />;
        }
        return <XchatLazySyntaxHighlighter language={lang} value={text} xfSoft={xfSoft} />;
      }
      const chip = parseInlineXfChipCode(text);
      if (chip) {
        return <XchatCitationChip label={chip.label} slug={chip.slug} />;
      }
      return (
        <code className="xchat-md-code-inline" {...rest}>
          {children}
        </code>
      );
    }
  };
}

export function XchatMarkdownBody({ content, className }: XchatMarkdownBodyProps) {
  const xfSoft = useXfUiSoft();
  const components = useMemo(() => createMarkdownComponents(xfSoft), [xfSoft]);
  const cleaned = useMemo(() => preprocessXchatMarkdown(content), [content]);

  return (
    <div className={className ?? "xchat-markdown"}>
      <ReactMarkdown components={components} rehypePlugins={[rehypeSanitize]} remarkPlugins={[remarkGfm]}>
        {cleaned}
      </ReactMarkdown>
    </div>
  );
}
