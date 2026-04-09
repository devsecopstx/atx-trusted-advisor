"use client";

import type { CSSProperties, HTMLAttributes, ReactNode, TableHTMLAttributes } from "react";
import { useMemo } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
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

function createMarkdownComponents(prismStyle: Record<string, CSSProperties>): Components {
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
          return (
            <SyntaxHighlighter
              className="xchat-md-code-block-wrap"
              customStyle={{
                margin: "0.65rem 0",
                borderRadius: "8px",
                fontSize: "0.8rem",
                lineHeight: 1.45
              }}
              language="json"
              PreTag="div"
              style={prismStyle}
            >
              {text}
            </SyntaxHighlighter>
          );
        }
        return (
          <SyntaxHighlighter
            className="xchat-md-code-block-wrap"
            customStyle={{
              margin: "0.65rem 0",
              borderRadius: "8px",
              fontSize: "0.8rem",
              lineHeight: 1.45
            }}
            language={lang}
            PreTag="div"
            style={prismStyle}
          >
            {text}
          </SyntaxHighlighter>
        );
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
  const prismStyle = xfSoft ? oneLight : oneDark;
  const components = useMemo(() => createMarkdownComponents(prismStyle), [prismStyle]);
  const cleaned = useMemo(() => preprocessXchatMarkdown(content), [content]);

  return (
    <div className={className ?? "xchat-markdown"}>
      <ReactMarkdown components={components} rehypePlugins={[rehypeSanitize]} remarkPlugins={[remarkGfm]}>
        {cleaned}
      </ReactMarkdown>
    </div>
  );
}
