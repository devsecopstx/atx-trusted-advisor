/**
 * Reasonable default legal copy for early production releases.
 * Operators should have counsel review and localize (jurisdiction, entity name, contact).
 */

const EFFECTIVE_NOTE = "Effective as of March 22, 2026. This summary is provided for transparency; it is not legal advice.";

const LEGAL_ENTITY = "aTx⚡Finance";
const LEGAL_CONTACT_NOTE =
  "Use the contact path in your onboarding, account, or access-request workflow for legal notices and operational requests.";
const VULNERABILITY_TIPS =
  "Include clear reproduction steps, impact level, affected route(s), and proof-of-concept details where possible. Do not include private keys or credentials in reports.";

export function LegalImprintContent() {
  return (
    <div className="legal-prose">
      <p className="legal-stub-lead">{EFFECTIVE_NOTE}</p>
      <h2>Service provider</h2>
      <p>
        {LEGAL_ENTITY} operates the atxFinance platform and associated product surfaces, including xChat,
        portfolio workflows, and related admin interfaces.
      </p>
      <h2>Scope of publication</h2>
      <p>
        This imprint applies to information published within the atxFinance web application and official
        product domains used for access, onboarding, and support.
      </p>
      <h2>Contact and legal notices</h2>
      <p>{LEGAL_CONTACT_NOTE}</p>
      <h2>Regulatory and professional use</h2>
      <p>
        atxFinance is designed for approved professionals and authorized users. Availability and product
        scope may differ by role, jurisdiction, and operator policy.
      </p>
      <h2>Content responsibility</h2>
      <p>
        We prepare platform information with reasonable care, but cannot guarantee all content is complete,
        current, or suitable for every jurisdiction without local legal review.
      </p>
      <h2>Intellectual property notice</h2>
      <p>
        Names, marks, software components, and product materials within the Service are protected by
        applicable intellectual property laws and contractual rights.
      </p>
    </div>
  );
}

export function LegalPrivacyContent() {
  return (
    <div className="legal-prose">
      <p className="legal-stub-lead">{EFFECTIVE_NOTE}</p>
      <h2>Who we are</h2>
      <p>
        aTx⚡Finance (“we,” “us,” “our”) operates the atxFinance web application and related services
        (the “Service”). The Service is operated for professionals and approved users; access may be
        limited by account type or invitation.
      </p>
      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account and identity:</strong> identifiers you provide when signing in (for example,
          through our authentication provider), profile or role fields we store to operate the product,
          and audit-related metadata required for admin workflows.
        </li>
        <li>
          <strong>Usage and content:</strong> messages, prompts, and outputs processed through
          features such as xChat, portfolio and watchlist data you choose to enter, and technical
          logs needed to run and secure the Service.
        </li>
        <li>
          <strong>Device and technical data:</strong> IP address, browser or client type, timestamps,
          and similar diagnostics typical for hosted web applications.
        </li>
      </ul>
      <h2>How we use information</h2>
      <p>We use information to:</p>
      <ul>
        <li>Provide, operate, maintain, and improve the Service;</li>
        <li>Authenticate users, enforce access rules, and protect against abuse or fraud;</li>
        <li>Respond to support requests and comply with applicable law;</li>
        <li>
          Invoke configured AI and data providers (for example, model and retrieval vendors) solely
          as needed to fulfill features you use.
        </li>
      </ul>
      <h2>AI and automated processing</h2>
      <p>
        Where you use AI-powered features, your prompts and related context may be transmitted to
        third-party model providers under our agreements with those providers. Outputs are generated
        automatically and may be incorrect or incomplete. The Service does not provide personalized
        investment, legal, or tax advice.
      </p>
      <h2>Sharing and subprocessors</h2>
      <p>
        We use infrastructure and service providers (for example, cloud hosting, databases, secrets
        management, and AI APIs) to run the Service. They process data on our instructions and under
        appropriate contractual safeguards. We do not sell your personal information.
      </p>
      <h2>Retention</h2>
      <p>
        We retain information only as long as needed for the purposes above, to meet legal
        obligations, or to resolve disputes. Retention periods depend on the data type and product
        settings (for example, chat or audit logs).
      </p>
      <h2>Your choices and rights</h2>
      <p>
        Depending on your location, you may have rights to access, correct, delete, or export certain
        information, or to object to or restrict certain processing. Contact us using the channel
        described in your account or onboarding materials. We may need to verify your request.
      </p>
      <h2>Security</h2>
      <p>
        We implement administrative, technical, and organizational measures appropriate to the
        nature of the Service. No method of transmission or storage is completely secure.
      </p>
      <h2>Children</h2>
      <p>The Service is not directed to children under 16, and we do not knowingly collect their data.</p>
      <h2>International users</h2>
      <p>
        If you access the Service from outside the United States, your information may be processed in
        the United States or other jurisdictions where we or our providers operate.
      </p>
      <h2>Changes</h2>
      <p>
        We may update this policy from time to time. We will post the updated version on this page and
        revise the effective date when appropriate.
      </p>
      <h2>Contact</h2>
      <p>
        For privacy inquiries, use the contact path provided in your account, access request, or
        operator runbook. For security issues, see <strong>Report a vulnerability</strong> in the
        footer.
      </p>
    </div>
  );
}

export function LegalTermsContent() {
  return (
    <div className="legal-prose">
      <p className="legal-stub-lead">{EFFECTIVE_NOTE}</p>
      <h2>Agreement</h2>
      <p>
        By accessing or using the atxFinance web application and related services (the “Service”),
        you agree to these Terms of Service. If you do not agree, do not use the Service.
      </p>
      <h2>The Service</h2>
      <p>
        The Service provides tools and interfaces for portfolio-related workflows, AI-assisted chat
        (including integrations with third-party model providers), and administrative features for
        approved accounts. Features, availability, and limits may change. We may suspend or modify the
        Service for maintenance, security, or business reasons.
      </p>
      <h2>Eligibility and accounts</h2>
      <p>
        You must have authority to enter this agreement. You are responsible for safeguarding your
        credentials and for activity under your account. You must provide accurate information where
        requested. We may refuse or revoke access that violates these Terms or our policies.
      </p>
      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service in violation of law or third-party rights;</li>
        <li>Attempt to probe, scan, or test vulnerabilities except through our coordinated disclosure process;</li>
        <li>Interfere with or overload the Service, or circumvent access controls;</li>
        <li>Use the Service to transmit malware, spam, or unlawful content;</li>
        <li>Reverse engineer or copy the Service except where permitted by law.</li>
      </ul>
      <h2>Not financial, legal, or tax advice</h2>
      <p>
        The Service and any AI-generated content are for informational and operational purposes only.
        They are <strong>not</strong> investment, legal, tax, or professional advice. You are solely
        responsible for your decisions. Past performance does not guarantee future results.
      </p>
      <h2>Third-party services</h2>
      <p>
        The Service may rely on third-party APIs, data sources, and infrastructure. Their terms and
        availability may affect your use. We are not responsible for third-party services outside our
        reasonable control.
      </p>
      <h2>Intellectual property</h2>
      <p>
        We and our licensors retain rights in the Service, branding, and software. Subject to these
        Terms, we grant you a limited, non-exclusive, non-transferable right to use the Service for
        your internal or permitted business purposes. You retain rights in content you submit; you
        grant us a license to host and process it to operate the Service.
      </p>
      <h2>Disclaimer of warranties</h2>
      <p>
        THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE,” WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
        IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
      </p>
      <h2>Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE AND OUR AFFILIATES AND SUPPLIERS WILL NOT BE LIABLE
        FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF
        PROFITS, DATA, OR GOODWILL. OUR AGGREGATE LIABILITY FOR CLAIMS ARISING OUT OF THE SERVICE WILL
        NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID US FOR THE SERVICE IN THE TWELVE MONTHS
        BEFORE THE CLAIM OR (B) ONE HUNDRED U.S. DOLLARS (US $100), EXCEPT WHERE PROHIBITED BY LAW.
      </p>
      <h2>Indemnity</h2>
      <p>
        You will defend and indemnify us against claims arising from your use of the Service, your
        content, or your violation of these Terms, subject to applicable law.
      </p>
      <h2>Termination</h2>
      <p>
        You may stop using the Service at any time. We may suspend or terminate access for breach,
        risk, or legal compliance. Provisions that by nature should survive will survive termination.
      </p>
      <h2>Governing law</h2>
      <p>
        These Terms are governed by the laws of the State of Delaware, USA, excluding conflict-of-law
        rules, unless a different governing law is required by your jurisdiction. Courts in Delaware
        (or another forum we specify in writing) may have exclusive jurisdiction, subject to mandatory
        consumer protections where applicable.
      </p>
      <h2>Changes</h2>
      <p>
        We may update these Terms. Continued use after changes become effective constitutes acceptance
        of the revised Terms where permitted by law.
      </p>
      <h2>Contact</h2>
      <p>
        For questions about these Terms, use the contact path provided in your account or onboarding
        materials.
      </p>
    </div>
  );
}

export function LegalSecurityContent() {
  return (
    <div className="legal-prose">
      <p className="legal-stub-lead">{EFFECTIVE_NOTE}</p>
      <h2>Security program</h2>
      <p>
        We maintain administrative, technical, and organizational controls appropriate for a hosted
        financial workflow platform, including access controls, logging, and environment-level secret
        management.
      </p>
      <h2>Access controls</h2>
      <p>
        Access to privileged surfaces is role-restricted. Administrative routes are limited to authorized
        operators and protected by authentication and session controls.
      </p>
      <h2>Data handling and encryption</h2>
      <p>
        Data is protected in transit using standard transport encryption. Infrastructure and persistence
        protections are applied according to provider capabilities and operational policy.
      </p>
      <h2>Monitoring and response</h2>
      <p>
        We monitor operational health and security-relevant failures. Where required, incidents are triaged,
        contained, and remediated through documented runbooks and post-incident review.
      </p>
      <h2>Shared responsibility</h2>
      <p>
        Users are responsible for account hygiene, prompt-level data minimization, and safeguarding access
        credentials. Do not submit highly sensitive data unless explicitly approved by your organization.
      </p>
      <h2>Questions</h2>
      <p>
        For security posture questions, use the support or operator contact path in your onboarding
        workflow. For active vulnerabilities, use the dedicated reporting page linked below.
      </p>
    </div>
  );
}

export function LegalVulnerabilityContent() {
  return (
    <div className="legal-prose">
      <p className="legal-stub-lead">{EFFECTIVE_NOTE}</p>
      <h2>Report a vulnerability</h2>
      <p>
        We welcome responsible security reports related to atxFinance. If you believe you found a
        vulnerability, report it privately through approved support or security channels.
      </p>
      <h2>Responsible disclosure expectations</h2>
      <ul>
        <li>Avoid actions that degrade service availability or compromise user data.</li>
        <li>Do not access data that is not yours or exceed authorized test boundaries.</li>
        <li>Provide reasonable time for investigation and remediation before public disclosure.</li>
      </ul>
      <h2>What to include in a report</h2>
      <p>{VULNERABILITY_TIPS}</p>
      <h2>Safe harbor intent</h2>
      <p>
        We do not pursue legal action for good-faith, coordinated research performed within these
        expectations and applicable law. This statement does not authorize unlawful testing.
      </p>
      <h2>Response process</h2>
      <p>
        Reports are triaged by severity. We aim to acknowledge receipt promptly, request details if needed,
        and communicate remediation progress when appropriate.
      </p>
    </div>
  );
}
