---
id: xfinance-strategy-poor-mans-covered-call
name: xfinance-strategy-poor-mans-covered-call
description: Poor Man's Covered Call structure using 2027 LEAP exposure plus short OTM calls for leveraged income.
---

# xFinance Strategy: Poor Man's Covered Call

## How Commonly Used

High

## Strategy

Buy a 2027 LEAP call and sell short OTM calls on TSLA; target leveraged income toward long-term growth goals.

## Risk Profile

Moderate-Aggressive (LEAP leverage)

## Guardrails

- Validate LEAP delta/depth before short-call overlays.
- Monitor time decay and IV regime shifts each roll cycle.
- Enforce roll/defense triggers if short leg approaches ITM early.
