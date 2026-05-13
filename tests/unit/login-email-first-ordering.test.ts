import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Pins the email-first hierarchy on the public sign-in surfaces so the email +
 * password form always renders before the OAuth shortcuts (Google + X). If
 * this test breaks, restore the order or update both surfaces together —
 * never let one surface drift to OAuth-first.
 *
 * Surfaces:
 *  - `/login` page (`src/app/login/page.tsx`)
 *  - xChat guest panel default flow (`src/app/xchat/ui/xchat-guest-panel.tsx`)
 */

const ROOT = resolve(__dirname, "../..");

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

describe("login page — email + password is primary, OAuth is secondary", () => {
  const source = readSource("src/app/login/page.tsx");

  it("renders <EmailLoginPanel /> before <LoginOAuthSection />", () => {
    const emailPanelIdx = source.indexOf("<EmailLoginPanel ");
    const oauthSectionIdx = source.indexOf("<LoginOAuthSection ");
    expect(emailPanelIdx).toBeGreaterThanOrEqual(0);
    expect(oauthSectionIdx).toBeGreaterThan(emailPanelIdx);
  });

  it("uses the secondary 'or continue with' divider label", () => {
    expect(source).toMatch(/<LoginOAuthDivider\s+label="or continue with"/);
  });
});

describe("LoginOAuthSection — secondary visual weight", () => {
  const source = readSource("src/app/login/ui/login-oauth-section.tsx");

  it("uses secondary CTA styling for both providers", () => {
    expect(source).toMatch(/cta cta-secondary login-oauth-secondary-btn login-google-btn/);
    expect(source).toMatch(/cta cta-secondary login-oauth-secondary-btn login-oauth-x/);
  });

  it("does not promote any OAuth provider to a primary CTA", () => {
    expect(source).not.toMatch(/cta cta-primary[^"]*login-oauth/);
    expect(source).not.toMatch(/cta-oauth-google/);
  });
});

describe("EmailLoginPanel — username or email copy", () => {
  const source = readSource("src/app/login/ui/email-login-panel.tsx");

  it("labels the primary identifier field as username or email", () => {
    expect(source).toMatch(/Username or email/);
    expect(source).toMatch(/Use your username or email, or continue with Google or X/);
  });

  it("uses a text input with username autocomplete instead of forcing email-only input", () => {
    expect(source).toMatch(/type="text"/);
    expect(source).toMatch(/autoComplete="username"/);
    expect(source).not.toMatch(/type="email"/);
  });

  it("the 'Sign up' link points at /signup (not /xchat) for the dedicated create-account page", () => {
    expect(source).toMatch(/href="\/signup"/);
    expect(source).not.toMatch(/href="\/xchat"[\s\S]*Sign up/);
  });
});

describe("/signup page — tastytrade-style account creation flow", () => {
  const pageSource = readSource("src/app/signup/page.tsx");
  const formSource = readSource("src/app/signup/ui/signup-form.tsx");

  it("page mounts the SignupForm under the shared LoginPageHeader", () => {
    expect(pageSource).toMatch(/<LoginPageHeader \/>/);
    expect(pageSource).toMatch(/<SignupForm \/>/);
  });

  it("form posts to the existing public access-requests endpoint", () => {
    expect(formSource).toMatch(/\/api\/access-requests\/public/);
  });

  it("country select defaults to US (DEFAULT_COUNTRY_CODE) and lists curated options", () => {
    expect(formSource).toMatch(/from "@\/lib\/country-options"/);
    expect(formSource).toMatch(/useState<string>\(DEFAULT_COUNTRY_CODE\)/);
    expect(formSource).toMatch(/COUNTRY_OPTIONS\.map/);
  });

  it("form copy mirrors tastytrade welcome heading + 'Already have an account? Log in here' link", () => {
    expect(formSource).toMatch(/Welcome to aTx Trusted Advisor/);
    expect(formSource).toMatch(/Let&apos;s get started/);
    expect(formSource).toMatch(/Already have an account\?/);
    expect(formSource).toMatch(/href="\/login"[\s\S]*?Log in here/);
  });

  it("requires letters-and-numbers username and a 12+ char password before submitting", () => {
    expect(formSource).toMatch(/USERNAME_PATTERN/);
    expect(formSource).toMatch(/MIN_PASSWORD_LENGTH = 12/);
  });

  it("renders the ATX Advisor Terms + Privacy disclaimer above the login link", () => {
    expect(formSource).toMatch(
      /By continuing, you agree to ATX Advisor&apos;s[\s\S]*?href="\/legal\/terms"[\s\S]*?Terms of Service[\s\S]*?href="\/legal\/privacy"[\s\S]*?Privacy Policy/
    );
    const disclaimerIdx = formSource.indexOf("By continuing, you agree to ATX Advisor");
    const loginLinkIdx = formSource.indexOf("Already have an account?");
    expect(disclaimerIdx).toBeGreaterThan(0);
    expect(loginLinkIdx).toBeGreaterThan(disclaimerIdx);
  });
});

describe("xChat guest panel — default flow is email-first", () => {
  const source = readSource("src/app/xchat/ui/xchat-guest-panel.tsx");

  it("primary CTA is the email + password sign-in link", () => {
    expect(source).toMatch(
      /cta-primary[^"]*xchat-guest-actions__cta--email-primary[\s\S]*?Sign in with email \+ password/
    );
  });

  it("OAuth providers are rendered inside the secondary 'Or continue with' row", () => {
    const dividerIdx = source.indexOf("xchat-guest-divider--secondary");
    const oauthRowIdx = source.indexOf("xchat-guest-oauth-row--secondary");
    const emailPrimaryIdx = source.indexOf("xchat-guest-actions__cta--email-primary");
    expect(dividerIdx).toBeGreaterThan(emailPrimaryIdx);
    expect(oauthRowIdx).toBeGreaterThan(dividerIdx);
  });

  it("default-flow hint copy mentions email + password as the primary path", () => {
    expect(source).toMatch(/Sign in with your email and password\./);
  });
});
