"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

import { preprocessXchatMarkdown } from "@/app/xchat/ui/xchat-markdown-preprocess";

type XchatMarkdownBodyProps = {
  content: string;
  className?: string;
};

const markdownComponents: Components = {
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
  code({ className, children, inline, ...rest }) {
    const text = String(children).replace(/\n$/, "");
    if (!inline) {
      const match = /language-(\w+)/.exec(className ?? "");
      const lang = match?.[1] ?? "text";
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
