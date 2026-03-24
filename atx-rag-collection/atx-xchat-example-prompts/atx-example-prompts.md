<!-- App xChat example prompts / RAG sample text — not a Cursor agent. See ../README.md -->

Example user prompts for trusted family

Show my portfolio allocation
What are my top movers today

How's the weather today in Austin, TX.

I want to refresh my wheel around TSLA and SpaceX or related suppliers, what are the top ten companies or related , that have a high IV that may be good candidates to build a wheel with around TSLA?

please add NVDA to my watchlist

scenario for example;
key variables from csp-strategy-builder
Cash-Secured Put|RSI 47 |Vol 119% 🌪️(high)|Cash $576,000|Prob ITM – % OTM – %
✓ Premium now • Possible discount buy | ⚠ Cash secured • Assigned if ↓

Price$9.05
Strikes:-15% $7.69-10% $8.15-5% $8.60+5% $9.50+10% $9.96+15% $10.4150 MA:$8.39$9.87$11.35+20% $10.86
covered-call (cc)
prompt example;
You are selling 100 RDW calls to open with the strike price of $9.50 that expires Apr 10, 2026. This trade is expected to result in receiving a credit of $5,000.00. This trade has a 60% probability to be out of the money, which is below $9.50, at expiration. If assigned anytime, you have the obligation to sell (100) RDW at the strike price of $9.50, for a total of $95,000.00. Total obligation to sell shares if assigned: $95,000.00.

cash-secured-put (csp)
prompt example;
You are selling 100 RDW puts to open with the strike price of $9.00 that expires Apr 10, 2026. This trade is expected to result in receiving a credit of $5,500.00. This trade has a 51% probability to be out of the money, which is above $9.00, at expiration. Total obligation to put up cash if assigned: $90,000.00.