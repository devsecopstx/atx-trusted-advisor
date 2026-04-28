import { preprocessXchatMarkdown } from "@/app/xchat/ui/xchat-markdown-preprocess";
import { getPersonaByIdCached, loadDefaultXchatPersonaForSessionDeduped } from "@/lib/server-request-cache";
import { getDefaultPersonaChatModelId } from "@/lib/xai-default-persona-model";
import { respondWithXai } from "@/lib/xai";
import { buildXchatSystemPrompt, XCHAT_SERVER_ROUTING_POLICY_BLOCK } from "@/modules/xchat/xchat-prompt-build";

type GenerateMarketingMarkdownInput = {
  roles: string[];
  sourceContent: string;
  destinationUrl: string;
  platforms: string[];
  personaId?: string;
};

export async function generateMarketingMarkdownWithXchat(
  input: GenerateMarketingMarkdownInput
): Promise<{ markdown: string; model: string; personaName: string }> {
  const defaultPersona = await loadDefaultXchatPersonaForSessionDeduped(input.roles);
  const requestedPersonaId = input.personaId?.trim();
  const requestedPersona = requestedPersonaId
    ? await getPersonaByIdCached(requestedPersonaId)
    : null;
  const persona = requestedPersona ?? defaultPersona;

  const personaSystem = persona?.systemPrompt?.trim();
  const systemPrompt = buildXchatSystemPrompt({
    personaSystem: personaSystem && personaSystem.length > 0 ? personaSystem : "",
    fallbackPersonaSystem:
      "You are xChat, creating concise, compliant social posts for atxFinance marketing operations.",
    ragContext: "",
    recentHistoryBlock: "",
    workspaceSnapshot: null,
    sessionToolInstructions: "",
    routingPolicyBlock: XCHAT_SERVER_ROUTING_POLICY_BLOCK,
    citationsEnabled: false
  });

  const modelRaw = typeof persona?.model === "string" ? persona.model.trim() : "";
  const model = modelRaw.length > 0 ? modelRaw : getDefaultPersonaChatModelId();

  const userPrompt = [
    "Generate post-ready markdown for social publishing.",
    `Platforms: ${input.platforms.join(", ") || "x"}.`,
    "Constraints:",
    "- Keep it concise and actionable.",
    "- No hashtags unless genuinely useful (max 2).",
    "- No markdown code fences.",
    "- End with a CTA line that references the destination URL conceptually (do not append raw URL here).",
    "- Focus on options profits: covered calls, protective puts, straddles, and scanner workflows.",
    "",
    "Draft source content:",
    input.sourceContent,
    "",
    `Destination URL: ${input.destinationUrl}`
  ].join("\n");

  const generated = await respondWithXai({
    model,
    systemPrompt,
    userPrompt,
    toolChoice: "none",
    maxTurns: 1
  });

  return {
    markdown: preprocessXchatMarkdown(generated.outputText),
    model: generated.model,
    personaName: persona?.name ?? "xchat-default"
  };
}
