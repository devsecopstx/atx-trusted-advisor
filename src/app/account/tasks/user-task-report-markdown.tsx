"use client";

import { cleanUserTaskLlmOutput } from "@/lib/clean-user-task-llm-output";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

export type UserTaskReportMarkdownProps = {
  text: string;
  className?: string;
};

/**
 * Sanitized Markdown from user-task / desk automation output (GFM + HTML sanitize).
 * Caller should pass text already cleaned server-side ({@link cleanUserTaskLlmOutput}).
 */
export function UserTaskReportMarkdown({ text, className }: UserTaskReportMarkdownProps) {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  const cleaned = cleanUserTaskLlmOutput(trimmed);
  if (!cleaned) {
    return null;
  }
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {cleaned}
      </ReactMarkdown>
    </div>
  );
}
