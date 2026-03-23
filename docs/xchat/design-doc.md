flowchart TD
    A[User Message<br>e.g. \"TSLA strategy\"] --> B{Load or Create Session State<br>DB: StrategySession[userId, convId]}

    B --> C{All required inputs collected?<br>outlook, risk, horizon, etc.}

    C -- Yes --> D[Build final prompt from state<br>+ call Grok /api/xchat/ask<br>or /api/xstrategy/generate]

    D --> E[Return structured strategy response<br>with trades, greeks, P/L, rationale]

    C -- No --> F[Determine next missing field<br>based on current step]

    F --> G[Generate single targeted question<br>with numbered choices<br>e.g. \"1. Bullish  2. Neutral  3. Bearish\"]

    G --> H[Send question to user<br>+ update state.step]

    H --> I[User replies<br>e.g. \"2\" or \"neutral outlook\"]

    I --> J[Parse reply<br>keyword match / number / Grok extraction fallback]

    J --> K[Save extracted value to state<br>e.g. outlook = \"neutral\"]

    K --> B