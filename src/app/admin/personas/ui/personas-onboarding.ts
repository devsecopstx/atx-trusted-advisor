export type PersonaFormState = {
  name: string;
  systemPrompt: string;
  overridePrompt: string;
  xaiCollectionId: string;
  xaiCollectionName: string;
  model: string;
  temperature: string;
  enableRag: boolean;
  defaultScope: string;
  xapiMode: "responses" | "chat_completions";
  xapiToolChoice: "auto" | "required" | "none";
  xapiMaxTurns: string;
  xapiToolsJson: string;
};

export type XaiCollectionInventoryOption = {
  id: string;
  name?: string;
  stats: {
    documentCount: number | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
};

export const DEFAULT_XPERSONA_TEST_SYSTEM_PROMPT =
  "You are The Architect, an elite administrative agent with full access to the xAI ecosystem. You have a multi-layered toolset including Web Search, X (Twitter) Search, a Python Code Sandbox, and Private Collection Search.";

export const EMPTY_CREATE_FORM: PersonaFormState = {
  name: "",
  systemPrompt: DEFAULT_XPERSONA_TEST_SYSTEM_PROMPT,
  overridePrompt: "",
  xaiCollectionId: "",
  xaiCollectionName: "",
  model: "grok-4-1-fast",
  temperature: "0.2",
  enableRag: true,
  defaultScope: "global",
  xapiMode: "responses",
  xapiToolChoice: "auto",
  xapiMaxTurns: "5",
  xapiToolsJson: "[]"
};

export function applySelectedCollectionToPersonaForm(
  form: PersonaFormState,
  collections: XaiCollectionInventoryOption[],
  collectionId: string
): PersonaFormState {
  const selectedCollection = collections.find((collection) => collection.id === collectionId);
  if (!selectedCollection) {
    if (!collectionId) {
      return {
        ...form,
        xaiCollectionId: "",
        xaiCollectionName: ""
      };
    }
    return {
      ...form,
      xaiCollectionId: collectionId
    };
  }

  return {
    ...form,
    xaiCollectionId: collectionId,
    xaiCollectionName: selectedCollection.name ?? ""
  };
}
