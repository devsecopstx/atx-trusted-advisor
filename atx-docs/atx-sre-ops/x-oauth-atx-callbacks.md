# X OAuth — Add atx Callback URLs

Add these callback URLs in your X app developer settings:

**URLs to add:**

- `https://staging.atx.fintech-advisor.ai/api/auth/x/callback`
- `https://atx.fintech-advisor.ai/api/auth/x/callback`

**Where:** [developer.x.com](https://developer.x.com) → Your app → User authentication settings → Callback URLs

**Optional:** Remove old `core` callbacks after cutover:

- ~~`https://staging.core.fintech-advisor.ai/api/auth/x/callback`~~
- ~~`https://core.fintech-advisor.ai/api/auth/x/callback`~~
