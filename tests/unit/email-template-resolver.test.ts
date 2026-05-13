import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const repoMocks = vi.hoisted(() => ({
  findActiveEmailTemplate: vi.fn(),
  getPortfolioEmailPreference: vi.fn()
}));

vi.mock("@/modules/email-templates/email-templates-repository", () => ({
  findActiveEmailTemplate: repoMocks.findActiveEmailTemplate
}));
vi.mock("@/modules/email-templates/portfolio-email-preferences-repository", () => ({
  getPortfolioEmailPreference: repoMocks.getPortfolioEmailPreference
}));

import { resolveEffectiveEmailTemplate } from "@/modules/email-templates/email-template-resolver";

const tenantId = new ObjectId("507f1f77bcf86cd799439011");
const portfolioId = new ObjectId("507f1f77bcf86cd799439022");

const baseTemplate = {
  _id: new ObjectId("507f1f77bcf86cd7994390a1"),
  slug: "portfolio-digest-weekly" as const,
  version: "1.0",
  tenantId: null,
  subject: "Default subject {{portfolio.name}}",
  body: "# Default body",
  active: true,
  defaultCadence: "weekly" as const,
  createdAt: new Date(),
  updatedAt: new Date()
};

describe("resolveEffectiveEmailTemplate", () => {
  beforeEach(() => {
    repoMocks.findActiveEmailTemplate.mockReset();
    repoMocks.getPortfolioEmailPreference.mockReset();
  });

  it("returns null when no template exists at any tier", async () => {
    repoMocks.findActiveEmailTemplate.mockResolvedValue(null);
    repoMocks.getPortfolioEmailPreference.mockResolvedValue(null);
    const result = await resolveEffectiveEmailTemplate({
      slug: "portfolio-digest-weekly",
      tenantId,
      portfolioId
    });
    expect(result).toBeNull();
  });

  it("falls back to template subject/body/cadence when no preference exists", async () => {
    repoMocks.findActiveEmailTemplate.mockResolvedValue(baseTemplate);
    repoMocks.getPortfolioEmailPreference.mockResolvedValue(null);
    const result = await resolveEffectiveEmailTemplate({
      slug: "portfolio-digest-weekly",
      tenantId,
      portfolioId
    });
    expect(result).not.toBeNull();
    expect(result!.subject).toBe(baseTemplate.subject);
    expect(result!.body).toBe(baseTemplate.body);
    expect(result!.cadence).toBe("weekly");
    expect(result!.enabled).toBe(false);
    expect(result!.sources).toEqual({
      subject: "template",
      body: "template",
      cadence: "template"
    });
  });

  it("merges portfolio overrides on top of template", async () => {
    repoMocks.findActiveEmailTemplate.mockResolvedValue(baseTemplate);
    repoMocks.getPortfolioEmailPreference.mockResolvedValue({
      _id: new ObjectId("507f1f77bcf86cd7994390b1"),
      tenantId,
      portfolioId,
      templateSlug: "portfolio-digest-weekly",
      enabled: true,
      cadenceOverride: "daily",
      subjectOverride: "Custom subject",
      bodyOverride: "# Custom body",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const result = await resolveEffectiveEmailTemplate({
      slug: "portfolio-digest-weekly",
      tenantId,
      portfolioId
    });
    expect(result).not.toBeNull();
    expect(result!.subject).toBe("Custom subject");
    expect(result!.body).toBe("# Custom body");
    expect(result!.cadence).toBe("daily");
    expect(result!.enabled).toBe(true);
    expect(result!.sources).toEqual({
      subject: "portfolio_override",
      body: "portfolio_override",
      cadence: "portfolio_override"
    });
  });

  it("ignores empty-string overrides (treats as cleared)", async () => {
    repoMocks.findActiveEmailTemplate.mockResolvedValue(baseTemplate);
    repoMocks.getPortfolioEmailPreference.mockResolvedValue({
      _id: new ObjectId("507f1f77bcf86cd7994390b1"),
      tenantId,
      portfolioId,
      templateSlug: "portfolio-digest-weekly",
      enabled: true,
      subjectOverride: "   ",
      bodyOverride: "",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const result = await resolveEffectiveEmailTemplate({
      slug: "portfolio-digest-weekly",
      tenantId,
      portfolioId
    });
    expect(result!.subject).toBe(baseTemplate.subject);
    expect(result!.body).toBe(baseTemplate.body);
    expect(result!.sources.subject).toBe("template");
    expect(result!.sources.body).toBe("template");
  });
});
