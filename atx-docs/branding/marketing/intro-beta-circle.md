# aTxFinance Beta Circle Intro (Institutional / Advisory)

This file is a SendGrid-ready template spec for onboarding advisory and institutional users.

## Subject options

- Early Access: aTxFinance Institutional Advisory Console
- Your Advisory Beta Access Is Ready - aTxFinance
- Institutional Beta Invite: aTxFinance

## Preheader

No Atoms Moved. Just Gains Earned. Institutional tools, controlled access.

## Dynamic template variables

- `first_name`
- `login_url`
- `environment_label`
- `support_email`
- `founder_name`
- `x_handle`

## Plain-text version

Hi {{first_name}},

You are in the aTxFinance beta circle.

Once you register, I will review and approve your access as admin. After a quick intro call, you are part of the early aTxFinance advisory group.

No fluff. We are building practical institutional workflows for advisory teams that need clear signal, controlled access, and fast iteration.

What you can do right now:
- Go to: {{login_url}}
- Sign in with X and submit your access request
- After approval, access:
  - xChat advisory workflows
  - Portfolio and watchlist surfaces
  - Admin-governed access and feedback loop

This is early access. Expect rapid updates based on your direct feedback.

Reply to this email and tell us:
- What is genuinely useful
- What is confusing or missing
- What you would require for team rollout

If anything breaks, contact {{support_email}}.

{{founder_name}}
Founder, aTxFinance
Austin, TX
{{x_handle}}

## SendGrid Dynamic Template HTML (with watermark)

Email clients do not reliably support `var(--xf-*)` or external stylesheets. Inline hex below intentionally mirrors `atx-docs/design-system/atxfinance-brand-kit.css` (`--xf-bg-900` / marketing canvas `#050505`, card surface `#0b0b0b`, body text `--xf-text-100` `#f6f8fc`, link accent `--xf-gain-green` `#39ff14`, border near slate-800 `#1f2937`).

```html
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#050505;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050505;">
      <tr>
        <td align="center" style="padding:24px;">
          <table
            role="presentation"
            width="640"
            cellpadding="0"
            cellspacing="0"
            style="
              width:640px;
              max-width:640px;
              background:#0b0b0b url('https://assets.atxfinance.com/brand/atx-watermark.png') center/420px no-repeat;
              border:1px solid #1f2937;
              border-radius:12px;
            "
          >
            <tr>
              <td style="padding:28px;font-family:Arial,Helvetica,sans-serif;color:#f6f8fc;line-height:1.6;">
                <p style="margin:0 0 12px;">Hi {{first_name}},</p>
                <p style="margin:0 0 12px;">
                  You are in the <strong>aTxFinance beta circle</strong>.
                </p>
                <p style="margin:0 0 12px;">
                  Once you register, I will review and approve your access as admin. After a quick intro call, you are part of the early aTxFinance advisory group.
                </p>
                <p style="margin:0 0 12px;">
                  No Atoms Moved. Just Gains Earned.
                </p>
                <p style="margin:0 0 8px;"><strong>What you can do right now:</strong></p>
                <ul style="margin:0 0 12px 18px;padding:0;">
                  <li>Go to: <a href="{{login_url}}" style="color:#39ff14;">{{login_url}}</a></li>
                  <li>Sign in with X and submit your access request</li>
                  <li>After approval: xChat, portfolio/watchlist, admin-governed workflows</li>
                </ul>
                <p style="margin:0 0 12px;">
                  Environment: <strong>{{environment_label}}</strong>
                </p>
                <p style="margin:0 0 12px;">
                  Reply with what works, what is missing, and what you need for team rollout.
                </p>
                <p style="margin:0 0 12px;">
                  Support: <a href="mailto:{{support_email}}" style="color:#39ff14;">{{support_email}}</a>
                </p>
                <p style="margin:0;">
                  {{founder_name}}<br />
                  Founder, aTxFinance<br />
                  Austin, TX<br />
                  {{x_handle}}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## SendGrid API payload example

```json
{
  "from": { "email": "support@atxfinance.com", "name": "aTxFinance" },
  "template_id": "d-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "personalizations": [
    {
      "to": [{ "email": "advisor@firm.com", "name": "Jane Doe" }],
      "dynamic_template_data": {
        "first_name": "Jane",
        "login_url": "https://fintech-advisor.ai",
        "environment_label": "Production",
        "support_email": "support@atxfinance.com",
        "founder_name": "Samuel Perez",
        "x_handle": "@AtxBogart"
      }
    }
  ],
  "categories": ["institutional-beta", "advisory-onboarding"]
}
```