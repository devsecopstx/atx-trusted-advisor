"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { useMemo } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { XchatCitationChip } from "@/app/xchat/ui/xchat-citation-chip";
import { preprocessXchatMarkdown } from "@/app/xchat/ui/xchat-markdown-preprocess";
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

/**
 * react-markdown can emit fenced `code` inside `p` when the model's markdown is loose;
 * SyntaxHighlighter renders a `<div>` (PreTag), which is invalid inside `<p>` and breaks hydration.
 * Use `div` for paragraphs and pre-wrappers so block code / highlighter output stays valid.
 */
const markdownComponents: Components = {
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
            style={oneDark}
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
          style={oneDark}
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

export function XchatMarkdownBody({ content, className }: XchatMarkdownBodyProps) {
  const cleaned = useMemo(() => preprocessXchatMarkdown(content), [content]);

  return (
    <div className={className ?? "xchat-markdown"}>
      <ReactMarkdown
        components={markdownComponents}
        rehypePlugins={[rehypeSanitize]}
        remarkPlugins={[remarkGfm]}
      >
        {cleaned}
      </ReactMarkdown>
    </div>
  );
}
