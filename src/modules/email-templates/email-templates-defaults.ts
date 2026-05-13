import type {
    CreateEmailTemplatePayload,
    EmailTemplateSlug
} from "@/modules/email-templates/types";

const WEEKLY_BODY = `# {{portfolio.name}} — Weekly digest

**Period:** {{period.start}} → {{period.end}}

**Total value:** {{totalValue}}
**Week change:** {{weekChange}}

## Narrative

{{narrative}}

{{#hasTopMovers}}
## Top movers

{{#topMovers}}
- **{{symbol}}** — {{changePct}}
{{/topMovers}}
{{/hasTopMovers}}

{{#hasEvents}}
## Events this week

{{#events}}
- **{{title}}**{{#symbol}} ({{symbol}}){{/symbol}} — {{body}}
{{/events}}
{{/hasEvents}}

{{#hasPositions}}
## Top positions

{{#positions}}
- {{symbol}} — {{qty}} units · {{marketValue}}
{{/positions}}
{{/hasPositions}}

---

_Automated weekly summary from aTx⚡Finance. Not financial advice._`;

const DAILY_BODY = `# {{portfolio.name}} — Daily desk note

**As of:** {{period.end}}

**Total value:** {{totalValue}}
**Day change:** {{dayChange}}

{{narrative}}

{{#hasEvents}}
## Today's alerts

{{#events}}
- **{{title}}**{{#symbol}} ({{symbol}}){{/symbol}} — {{body}}
{{/events}}
{{/hasEvents}}

---

_Automated daily desk note from aTx⚡Finance. Not financial advice._`;

const WEEKLY_SUBJECT = "{{portfolio.name}} — Weekly digest ({{period.start}} → {{period.end}})";
const DAILY_SUBJECT = "{{portfolio.name}} — Daily desk note · {{period.end}}";

export function listGlobalEmailTemplateSeedRows(): CreateEmailTemplatePayload[] {
  return [
    {
      slug: "portfolio-digest-weekly" satisfies EmailTemplateSlug,
      version: "1.0",
      tenantId: null,
      subject: WEEKLY_SUBJECT,
      body: WEEKLY_BODY,
      active: true,
      defaultCadence: "weekly"
    },
    {
      slug: "portfolio-digest-daily" satisfies EmailTemplateSlug,
      version: "1.0",
      tenantId: null,
      subject: DAILY_SUBJECT,
      body: DAILY_BODY,
      active: true,
      defaultCadence: "daily"
    }
  ];
}
