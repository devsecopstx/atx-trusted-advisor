"use client";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

/**
 * Heavy chunk: Prism core + language defs + theme objects. Loaded only when
 * markdown contains a fenced code block (see `XchatLazySyntaxHighlighter` in
 * `xchat-markdown-body.tsx`). Keep this file thin so its dynamic chunk maps
 * 1:1 to the highlighter cost.
 */
export type XchatPrismHighlighterProps = {
  language: string;
  value: string;
  xfSoft: boolean;
};

export function XchatPrismHighlighter({ language, value, xfSoft }: XchatPrismHighlighterProps) {
  const style = xfSoft ? oneLight : oneDark;
  return (
    <SyntaxHighlighter
      className="xchat-md-code-block-wrap"
      customStyle={{
        margin: "0.65rem 0",
        borderRadius: "8px",
        fontSize: "0.8rem",
        lineHeight: 1.45
      }}
      language={language}
      PreTag="div"
      style={style}
    >
      {value}
    </SyntaxHighlighter>
  );
}
