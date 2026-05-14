import { preprocessXchatMarkdown } from "@/app/xchat/ui/xchat-markdown-preprocess";
import { getPersonaByIdCached, loadDefaultXchatPersonaForSessionDeduped } from "@/lib/server-request-cache";
import { respondWithXai } from "@/lib/xai";
import { getDefaultPersonaChatModelId } from "@/lib/xai-default-persona-model";
import { personaXapiToolsToXaiRequestTools } from "@/lib/xai-tools";
import {
    ensureSuperAgentDefaultTools,
    mergeXchatHostedToolBaseline,
    normalizePersonaXapiConfig
} from "@/modules/xchat/types";
import { buildXchatSystemPrompt, XCHAT_SERVER_ROUTING_POLICY_BLOCK } from "@/modules/xchat/xchat-prompt-build";

type GenerateMarketingMarkdownInput = {
  roles: string[];
  sourceContent: string;
  generationPrompt?: string;
  destinationUrl: string;
  platforms: string[];
  personaId?: string;
};

function applyGenerationPromptVariables(
  promptTemplate: string,
  input: Pick<
    GenerateMarketingMarkdownInput,
    "sourceContent" | "destinationUrl" | "platforms"
  >
): string {
  return promptTemplate
    .replaceAll("{{source_content}}", input.sourceContent)
    .replaceAll("{{destination_url}}", input.destinationUrl)
    .replaceAll("{{platforms}}", input.platforms.join(", ") || "x");
}

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
    personaOverrideInstructions: persona?.overridePrompt ?? null,
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
  const xapiConfig = mergeXchatHostedToolBaseline(
    ensureSuperAgentDefaultTools(normalizePersonaXapiConfig(persona?.xapi), persona?.name)
  );
  const tools = personaXapiToolsToXaiRequestTools(xapiConfig.tools);

  const promptTemplate = input.generationPrompt?.trim();
  const userPrompt =
    promptTemplate && promptTemplate.length > 0
      ? applyGenerationPromptVariables(promptTemplate, input)
      : [
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

  let generated: Awaited<ReturnType<typeof respondWithXai>>;
  try {
    generated = await respondWithXai({
      model,
      systemPrompt,
      userPrompt,
      tools,
      toolChoice: xapiConfig.toolChoice,
      maxTurns: xapiConfig.maxTurns
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const emptyResponse =
      message.includes("xAI responses returned an empty response") ||
      message.includes("returned an empty response");
    if (!emptyResponse) {
      throw error;
    }
    generated = await respondWithXai({
      model,
      systemPrompt,
      userPrompt,
      toolChoice: "none",
      maxTurns: 1
    });
  }

  return {
    markdown: preprocessXchatMarkdown(generated.outputText),
    model: generated.model,
    personaName: persona?.name ?? "xchat-default"
  };
}
