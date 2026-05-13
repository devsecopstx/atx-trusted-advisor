import {
    renderMarkdownEmail,
    renderMarkdownToPlainText
} from "@/modules/email-templates/markdown-render";
import { renderMustache } from "@/modules/email-templates/mustache-render";
import type { EmailTemplateRenderContext } from "@/modules/email-templates/types";

export type RenderedEmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

/**
 * End-to-end render: Mustache-substitute `subject` (raw, no HTML escape) and `body` (HTML-escape
 * variable values), then run our Markdown subset on the body to produce branded HTML + plain text.
 *
 * Variable values are HTML-escaped during Mustache step so `<script>` from a portfolio name cannot
 * inject into the rendered email.
 */
export function renderEmailTemplate(input: {
  subject: string;
  body: string;
  context: EmailTemplateRenderContext;
}): RenderedEmailTemplate {
  const ctxRecord = input.context as unknown as Record<string, unknown>;
  const renderedSubject = renderMustache(input.subject, ctxRecord, { rawByDefault: true }).trim();
  const renderedMarkdown = renderMustache(input.body, ctxRecord);
  const html = renderMarkdownEmail({ subject: renderedSubject, markdown: renderedMarkdown });
  const text = renderMarkdownToPlainText(renderedMarkdown);
  return { subject: renderedSubject, html, text };
}
