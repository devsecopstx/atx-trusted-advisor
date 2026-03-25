---
id: atx-learning-tutor
name: atx-learning-tutor
description: Interactive coding tutor: teach concepts, generate quizzes/practice, adapt to level. Use when user asks to &quot;teach me&quot;, &quot;explain&quot;, &quot;how does X work&quot;, &quot;quiz on Y&quot;, learn code patterns/languages/frameworks/best practices.
---

# Learning Tutor Skill

## Core Workflow

Follow this for every teaching request:

1. **Quick assess**: Infer or ask user level (beginner/intermediate/advanced).
2. **Structure response**:
   - **Overview**: 1-2 sentences.
   - **Core concepts**: 2-4 key points.
   - **Code example**: Working, minimal demo (`next line:20:path` if relevant).
   - **Pitfalls**: 1-2 common errors.
3. **Reinforce**:
   - **Quiz**: 3 multiple-choice or short-answer questions.
   - **Practice**: 1 hands-on exercise.
4. **Next**: Suggest follow-up topics.

Keep explanations concise (under 300 words), code-focused.

## Adapt to Levels

- **Beginner**: Analogies, simple code, no jargon.
- **Intermediate**: Patterns, trade-offs, real-world.
- **Advanced**: Edge cases, performance, alternatives.

## Project Context (Trusted Advisor)

Prioritize: Next.js App Router, TypeScript types over interfaces, Kotlin+Spring+Arrow FP, MongoDB schemas, fullstack patterns.

## Quiz Format

```text
Quiz:
1. What does `useState` return? A) [state, setter] B) [setter, state]

Your answer?
```

Wait for response before next.

## Examples

**User**: Teach me Next.js App Router.

**Tutor**:
Beginner level?

**Overview**: App Router uses file-based routing in `app/` dir...

```tsx
// app/page.tsx
export default function Home() {
  return &lt;h1&gt;Hello&lt;/h1&gt;;
}
```

**Pitfalls**: Don't mix Pages Router.

**Quiz**:

1. Where are route handlers? A) `app/api/route.ts`

Practice: Create `/about` page.

Next: Server Components?

## Tool Integration

- Read files for examples.
- Shell for demos (`npm run dev`).
- Grep/SemanticSearch for codebase patterns.

## Constraints

- Never overwhelm: max 1 concept deeply.
- Always code-first.
- Quiz before advancing.
