How to Add Prompts for the User (Implementation Rules)
When any of these are missing, respond immediately with a question instead of calling Grok:























## watchlist nl example

Missing FieldExample Server Response (one question only)default_account"Which account should I use as default?
1. IRA-Edge
2. Individual-TOD
3. Brokerage"default_portfolio"Which portfolio do you want to analyze?
1. Main
2. Growth
3. Income"outlook"What's your outlook on the market / symbol?
1. Bullish
2. Neutral
3. Bearish"risk"What's your risk tolerance?
1. Low (conservative)
2. Medium
3. High"watchlist (add item)If user says "add NVDA to my watchlist" → parse it, add to TEAM_XAI, then reply: "Added NVDA to watchlist. Anything else?"


Key Rules for Good UX

Always ask one question at a time
Use numbered choices when possible (user can reply with "1" or "bullish")
Support natural language fallback ("add NVDA to my watchlist" → detect intent, add it, confirm)
Persist every answer in TEAM_XAI collection (as structured fields + chat history)
Only call Grok when all required inputs are filled

Summary of the Design

Server always checks for missing inputs before calling Grok.
Returns a structured prompt_question response when something is missing.
Handles natural language commands (like “add NVDA…”) immediately.
Only calls Grok when all required inputs are present.
Everything is persisted in the single TEAM_XAI defined  collection.
