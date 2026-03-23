1. Implementation pattern (backend / agent logic)

- Store session state in DB (or Redis) keyed by userId + conversationId  
`{ userId, outlook?, risk?, capital?, step: 'outlook' | 'risk' | 'generate' }`
- On each message:
  1. Load state
  2. If missing field → return next question + choices
  3. If all present → call Grok with filled template prompt
  4. Update state (e.g. save outlook = "neutral")
  5. If user says “change outlook” → reset that field and restart from there

**Why this works best**  

- One question at a time = low cognitive load  
- Numbered choices = fast replies (user types "2" or "medium")  
- Stateful = remembers previous answers across turns  
- Fallback: if user gives free-form answer, parse it (simple keyword match or send to Grok for extraction)

**Minimal code skeleton (pseudo)**

```ts
async function handleStrategyMessage(userId: string, message: string) {
const state = await getStrategyState(userId);

if (state.step === 'generate') {
 return generateFinalStrategy(state.inputs);
}

// Try to extract from free-form message
const extracted = tryExtractField(message, state.step);
if (extracted) {
 await updateState(userId, { [state.step]: extracted });
 return askNextQuestion(state.step + 1);
}

// Otherwise ask clearly
return getQuestionForStep(state.step);
}


