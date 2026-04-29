/**
 * Reasonable default legal copy for early production releases.
 * Operators should have counsel review and localize (jurisdiction, entity name, contact).
 */

const EFFECTIVE_NOTE = "Effective as of March 22, 2026. This summary is provided for transparency; it is not legal advice.";

/** App / product name used in Imprint (plain text; wordmark may use ⚡ elsewhere). */
const PRODUCT_APP_NAME = "aTx Advisor";
/** User-facing product name in in-app legal stubs (matches chrome / marketing). */
const PRODUCT_PUBLIC_NAME = "aTx Trusted Advisory";
const VULNERABILITY_TIPS =
  "Include clear reproduction steps, impact level, affected route(s), and proof-of-concept details where possible. Do not include private keys or credentials in reports.";

export function LegalImprintContent() {
  return (
    <div className="legal-prose">
      <p className="legal-stub-lead">
        <strong>Effective as of March 22, 2026</strong>
        <br />
        This summary is provided for transparency only. It is not legal, financial, tax, or investment advice.
      </p>
      <h2>Service Provider</h2>
      <p>
        {PRODUCT_APP_NAME} operates the {PRODUCT_PUBLIC_NAME} platform and associated product surfaces,
        including xChat, portfolio workflows, and related admin interfaces.
      </p>
      <h2>Scope of Publication</h2>
      <p>
        This Imprint applies to all information and services published within the {PRODUCT_PUBLIC_NAME} web application
        and its official product domains used for access, onboarding, and support.
      </p>
      <h2>Contact and Legal Notices</h2>
      <p>
        Use the designated contact path in your onboarding, account settings, or support workflow for all legal notices
        and operational requests.
      </p>
      <h2>Intended Use &amp; Regulatory Notice</h2>
      <p>
        {PRODUCT_PUBLIC_NAME} is designed exclusively for approved professionals and authorized users. Availability,
        features, and product scope may vary by role, jurisdiction, and operator policy.
      </p>
      <h2>Content Responsibility</h2>
      <p>
        We prepare platform information with reasonable care. However, we cannot guarantee that all content is complete,
        current, or suitable for every jurisdiction without independent local professional review.
      </p>
      <h2>Intellectual Property Notice</h2>
      <p>
        All names, marks, software components, designs, and other product materials within the Service are protected by
        applicable intellectual property laws and contractual rights. Unauthorized use is strictly prohibited.
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
        aTx⚡Finance (“we,” “us,” “our”) operates the {PRODUCT_PUBLIC_NAME} web application and related
        services (the “Service”). The Service is operated for professionals and approved users; access may
        be limited by account type or invitation.
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
      <p className="legal-stub-subtitle">{PRODUCT_PUBLIC_NAME}</p>
      <p className="legal-stub-effective">Effective as of March 22, 2026</p>
      <h2>Agreement</h2>
      <p>
        By accessing or using {PRODUCT_PUBLIC_NAME} (the {`\u201c`}Service{`\u201d`}), you agree to these Terms. If you do
        not agree, you may not use the Service.
      </p>
      <h2>The Service</h2>
      <p>
        {PRODUCT_PUBLIC_NAME} is a software platform that provides tools to help high-net-worth families and their
        advisors consolidate, track, analyze, and report on portfolios. This includes dashboards, reporting,
        collaboration features, and AI-assisted chat.
      </p>
      <h2>Not Financial, Legal, or Tax Advice</h2>
      <p>The Service and any content it generates (including AI chat responses) are for informational and operational purposes only.</p>
      <p>
        {PRODUCT_PUBLIC_NAME} is not a financial advisor, wealth manager, tax advisor, or law firm.
      </p>
      <p>We do not provide investment, financial, tax, legal, or any other professional advice. Nothing on the platform creates a fiduciary or advisory relationship.</p>
      <p>
        You are solely responsible for all your investment, tax, legal, and financial decisions. You should consult your
        own qualified professionals before making any decisions based on information from the Service.
      </p>
      <h2>Eligibility</h2>
      <p>
        You must be at least 18 years old and have the authority to enter into this agreement. You are responsible for
        keeping your account credentials secure and for all activity under your account.
      </p>
      <h2>Acceptable Use</h2>
      <p>You agree not to misuse the Service, including:</p>
      <ul>
        <li>Violating any laws or third-party rights</li>
        <li>Attempting to hack, probe, or overload the Service</li>
        <li>Reverse engineering or copying the Service (except as permitted by law)</li>
        <li>Transmitting malware, spam, or unlawful content</li>
      </ul>
      <h2>Third-Party Services</h2>
      <p>
        The Service uses third-party data sources, APIs, and AI models. We are not responsible for their availability,
        accuracy, or terms.
      </p>
      <h2>Intellectual Property &amp; License</h2>
      <p>
        We (and our licensors) own all rights to the Service. We grant you a limited, non-exclusive, non-transferable
        license to use the Service solely for your own internal portfolio management and reporting purposes.
      </p>
      <p>
        You retain ownership of the data you upload, but you give us permission to host, process, and display it as
        needed to provide the Service.
      </p>
      <h2>Disclaimer of Warranties</h2>
      <p>
        The Service is provided {`\u201c`}AS IS{`\u201d`} and {`\u201c`}AS AVAILABLE{`\u201d`} without any warranties, express or implied.
      </p>
      <h2>Limitation of Liability</h2>
      <p>
        To the fullest extent permitted by law, {PRODUCT_PUBLIC_NAME} and its suppliers will not be liable for any
        indirect, incidental, special, or consequential damages.
      </p>
      <p>
        Our total liability to you will not exceed the greater of (a) the total amount you paid for the Service in the
        twelve months before the claim arose, or (b) one thousand U.S. dollars (US $1,000).
      </p>
      <h2>Indemnity</h2>
      <p>
        You agree to indemnify and defend us against any claims, losses, or damages arising from your use of the Service,
        your content, or your violation of these Terms.
      </p>
      <h2>Termination</h2>
      <p>
        You may stop using the Service at any time. We may suspend or terminate your access if you breach these Terms or
        for security/legal reasons.
      </p>
      <h2>Governing Law</h2>
      <p>
        These Terms are governed by the laws of the State of Texas. Any disputes will be resolved in the courts located in
        Travis County, Texas.
      </p>
      <h2>Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. Continued use of the Service after the changes take effect means you
        accept the new Terms.
      </p>
      <h2>Contact</h2>
      <p>
        If you have questions about these Terms, please contact us through the support channel provided in your account
        or onboarding materials.
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
        We welcome responsible security reports related to {PRODUCT_PUBLIC_NAME}. If you believe you found a
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
