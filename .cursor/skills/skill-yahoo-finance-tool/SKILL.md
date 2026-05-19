---
name: skill-yahoo-finance-tool
description: Teach reliable live market data fetching via yfinance (price, chains, history, fundamentals). Use when the agent or code needs to call Yahoo Finance for TSLA or other tickers inside Cursor.
---

# Yahoo Finance Data Tool Skill

This skill teaches Cursor's Agent/Composer to reliably fetch current price, historical data, options chains, dividends, splits, fundamentals, and more for any ticker (default: TSLA) using the `yfinance` library.

## Core Guidelines (Always Follow)
- Import: `import yfinance as yf`
- Ticker variable: Use `{symbol}` placeholder (replace with TSLA or user-specified)
- Never assume data is up-to-date without fetching — always call `.info`, `.history()`, `.option_chain()`, etc. live
- Handle errors gracefully: Try/except for invalid tickers, no data, connection issues
- Return clean, structured output: price, volume, options strikes/premiums, key ratios, etc.
- For options: Focus on calls/puts relevant to wheel, covered calls, CSPs, LEAPs (e.g., 30–90 DTE, OTM/ITM)
- Always pair with full OIC disclaimer when discussing options trades

## Key Fetch Patterns (use these in code blocks)
1. Current price & basics
   ticker = yf.Ticker("{symbol}")
   info = ticker.info
   current_price = info.get('regularMarketPrice') or info.get('currentPrice')
   print(f"{symbol} last: ${current_price:.2f}")

2. Options chain (most requested for TSLA strategies)
   expirations = ticker.options
   chain = ticker.option_chain(expirations[nearest_30_60_dte_index])  # pick closest 30-60 days
   calls = chain.calls[['strike', 'lastPrice', 'bid', 'ask', 'impliedVolatility']]
   puts  = chain.puts[['strike', 'lastPrice', 'bid', 'ask', 'impliedVolatility']]

3. Historical data (for backtesting wheel/CC yields)
   hist = ticker.history(period="1y" or start="2025-01-01")
   print(hist.tail())

4. Fundamentals quick view
   print(ticker.info['trailingPE'], ticker.info['forwardPE'], ticker.info['marketCap'])

## Response Pattern (when user asks for data)
1. Fetch live data via yfinance
2. Show current TSLA price + relevant OTM/ITM strikes & premiums
3. Suggest outlook/risk-consistent strikes (e.g., -10% CSP strike, 5-10% OTM CC)
4. Include breakeven, max profit/loss, cash required
5. End with full OIC disclaimer

## Example Code Snippet to Copy-Paste
```python
import yfinance as yf

symbol = "TSLA"
ticker = yf.Ticker(symbol)

# Current price
price = ticker.info.get('regularMarketPrice') or ticker.info.get('currentPrice')
print(f"{symbol} current: ${price:.2f}")

# Nearest expiration ~45 days out
exp = sorted(ticker.options)[2]  # usually 3rd is ~30-60 DTE
chain = ticker.option_chain(exp)
puts = chain.puts
print("Sample OTM Puts (-8% to -12%):")
print(puts[puts['strike'].between(price*0.88, price*0.92)][['strike','lastPrice','bid','ask']])