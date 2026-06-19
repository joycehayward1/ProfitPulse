"use client";

import Link from "next/link";
import Image from "next/image";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logoupdated-transparent61926.png"
              alt="MyProfitPulse"
              width={900}
              height={200}
              className="h-28 md:h-32 w-auto"
              priority
            />
          </Link>
          <Link
            href="/"
            className="text-body-sm text-text-secondary hover:text-orange transition-colors"
          >
            &larr; Back to Home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-12 pb-20">
        <h1 className="font-display text-display text-text-primary mb-2">
          Privacy Policy
        </h1>
        <p className="text-body text-text-muted mb-10">
          Last updated: May 2026
        </p>

        <div className="space-y-8 text-body text-text-secondary leading-relaxed">
          {/* Introduction */}
          <section>
            <p>
              At MyProfitPulse, we take your privacy seriously. This Privacy Policy explains
              what data we collect, how we use it, who we share it with, and what rights
              you have. MyProfitPulse is operated by Fusion 4 Business (&quot;Company,&quot;
              &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), a company registered in Bermuda.
            </p>
            <p className="mt-3">
              By using MyProfitPulse at myprofitpulse.app, you agree to the practices
              described in this policy. If you don&apos;t agree, please don&apos;t use the
              Service.
            </p>
            <p className="mt-3">
              We&apos;ve written this in plain English. Jurisdiction-specific rights (EU,
              UK, California, Bermuda, other US states) appear in sections 11 through 14.
            </p>
          </section>

          {/* 1. What We Collect */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              1. What Data We Collect
            </h2>
            <p>We collect the following types of information:</p>

            <h3 className="text-heading-sm text-text-primary mt-4 mb-2">
              Account Information
            </h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Your name and email address</li>
              <li>Business name and industry</li>
              <li>Password (stored securely using one-way hashing&mdash;we can never see it)</li>
            </ul>

            <h3 className="text-heading-sm text-text-primary mt-4 mb-2">
              Financial Data
            </h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Revenue, expenses, profit, and cash flow figures</li>
              <li>Assets, liabilities, and accounts receivable</li>
              <li>Any other financial data you upload via spreadsheets or import from QuickBooks</li>
            </ul>
            <p className="mt-2">
              This data is provided voluntarily by you and is used solely to power your
              dashboard, health score, AI insights, and scenario analysis.{" "}
              <strong className="text-text-primary">
                We classify financial account information as &quot;sensitive personal
                information&quot;
              </strong>{" "}
              under applicable privacy laws and handle it accordingly (see § 12 for
              California-specific rights).
            </p>

            <h3 className="text-heading-sm text-text-primary mt-4 mb-2">
              Payment Information
            </h3>
            <p>
              When you subscribe, your payment card details are collected and processed
              directly by Authorize.net, our PCI DSS Level 1-compliant payment processor.{" "}
              <strong className="text-text-primary">
                Your card data never touches our servers.
              </strong>{" "}
              We only receive a transaction confirmation and a token for recurring billing.
            </p>

            <h3 className="text-heading-sm text-text-primary mt-4 mb-2">
              QuickBooks Integration (Optional)
            </h3>
            <p>
              If you connect QuickBooks Online, we receive financial data (transactions,
              balances, P&amp;L figures) from your QuickBooks account via Intuit&apos;s
              authorized OAuth flow. This data is treated identically to data you upload
              manually and is never shared with Intuit beyond what&apos;s required to
              maintain the connection.
            </p>

            <h3 className="text-heading-sm text-text-primary mt-4 mb-2">
              Usage Data
            </h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Pages visited and features used within MyProfitPulse</li>
              <li>Browser type, device type, and operating system</li>
              <li>IP address and approximate location (country level)</li>
              <li>Session timestamps</li>
            </ul>
          </section>

          {/* 2. How We Use Your Data */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              2. How We Use Your Data
            </h2>
            <p>We use your data for the following purposes:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                <strong className="text-text-primary">Providing the Service.</strong>{" "}
                Generating your financial health score, dashboard insights, scenario
                analysis, and AI-powered recommendations.
              </li>
              <li>
                <strong className="text-text-primary">Account Management.</strong>{" "}
                Authenticating your identity, managing your subscription, and processing
                payments.
              </li>
              <li>
                <strong className="text-text-primary">Communications.</strong> Sending
                transactional emails (password resets, billing confirmations, security
                notices) and, if you opt in, weekly financial summary emails and product
                updates.
              </li>
              <li>
                <strong className="text-text-primary">Improving the Service.</strong>{" "}
                Understanding how MyProfitPulse is used so we can fix bugs, improve
                features, and build a better product. Aggregate analytics only — never
                your specific financial figures.
              </li>
              <li>
                <strong className="text-text-primary">Security.</strong> Detecting and
                preventing fraud, abuse, unauthorized access, and other security threats.
              </li>
              <li>
                <strong className="text-text-primary">Legal compliance.</strong> Complying
                with applicable laws, regulations, court orders, and lawful requests from
                regulators.
              </li>
            </ul>
          </section>

          {/* 3. AI Processing */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              3. AI Processing and Automated Decision-Making
            </h2>
            <p>
              MyProfitPulse uses artificial intelligence (AI) to extract financial data from
              your uploaded spreadsheets and to generate insights, health scores, and
              scenario projections.
            </p>
            <p className="mt-3">
              <strong className="text-text-primary">How the AI works (at a high level).</strong>{" "}
              When you upload data or open your dashboard, your numbers are sent to
              language-model APIs (currently OpenAI and Anthropic, accessed through the
              InsForge AI Gateway). The models generate a written summary, a numerical
              health score, and recommendations based on the inputs you provided.
            </p>
            <p className="mt-3">Important things to know about our AI processing:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                AI processes your data solely to provide results to{" "}
                <strong className="text-text-primary">you</strong>. Output is not shared
                with or visible to other users.
              </li>
              <li>
                Your financial data is <strong className="text-text-primary">not</strong>{" "}
                used to train or improve AI models. It is processed on-demand under
                zero-data-retention agreements with our AI providers and is not retained
                by the AI system beyond what&apos;s needed to generate your immediate
                results.
              </li>
              <li>
                AI-generated insights are analytical tools, not financial advice. AI can
                produce inaccurate or incomplete results. Always verify before acting and
                consult a qualified professional for significant financial decisions.
              </li>
              <li>
                <strong className="text-text-primary">
                  The health score is informational, not consequential.
                </strong>{" "}
                We never use it to deny you service, deny credit, or make legal/significant
                decisions about you. You retain full control over what you do with the
                insights we surface.
              </li>
              <li>
                If you&apos;re an EU/UK resident and would like a human review of any
                automated output, see § 11.
              </li>
            </ul>
          </section>

          {/* 4. Third-Party Services */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              4. Third-Party Services (Sub-Processors)
            </h2>
            <p>
              We work with a small number of trusted third-party providers to deliver the
              Service. Each provider processes data only as needed to provide its specific
              service and is bound by data-protection terms.
            </p>
            <div className="mt-4 space-y-4">
              <div className="bg-surface-inset rounded-lg p-4">
                <p className="font-semibold text-text-primary">Authorize.net</p>
                <p className="text-body-sm mt-1">
                  Payment processing. PCI DSS Level 1 compliant. Handles all credit-card
                  transactions securely. We never store your card details.
                </p>
              </div>
              <div className="bg-surface-inset rounded-lg p-4">
                <p className="font-semibold text-text-primary">InsForge</p>
                <p className="text-body-sm mt-1">
                  Backend-as-a-Service. Provides our database, authentication, and AI
                  gateway infrastructure. Your data is stored encrypted in InsForge&apos;s
                  managed environment.
                </p>
              </div>
              <div className="bg-surface-inset rounded-lg p-4">
                <p className="font-semibold text-text-primary">OpenAI &amp; Anthropic (via InsForge AI Gateway)</p>
                <p className="text-body-sm mt-1">
                  AI language model providers. Used to generate insights, summaries, and
                  scenario analysis from your data. Operate under zero-data-retention
                  agreements — your data is not used to train models and is not retained
                  beyond the request.
                </p>
              </div>
              <div className="bg-surface-inset rounded-lg p-4">
                <p className="font-semibold text-text-primary">Intuit / QuickBooks (optional)</p>
                <p className="text-body-sm mt-1">
                  Used only if you choose to connect your QuickBooks Online account. We
                  receive read access to your accounting data via Intuit&apos;s OAuth API.
                  You can disconnect at any time from Settings.
                </p>
              </div>
              <div className="bg-surface-inset rounded-lg p-4">
                <p className="font-semibold text-text-primary">Resend</p>
                <p className="text-body-sm mt-1">
                  Email delivery service. Used to send transactional emails (account
                  verification, password resets, billing notifications) and optional
                  weekly summary emails.
                </p>
              </div>
              <div className="bg-surface-inset rounded-lg p-4">
                <p className="font-semibold text-text-primary">Vercel</p>
                <p className="text-body-sm mt-1">
                  Application hosting and content delivery. Handles incoming web traffic
                  and serves the application securely over HTTPS.
                </p>
              </div>
            </div>
            <p className="mt-4">
              We do not sell or rent your personal information to any third party.
            </p>
          </section>

          {/* 5. Data Security */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              5. Data Security and Breach Notification
            </h2>
            <p>We take reasonable technical and organizational measures to protect your data, including:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Encryption in transit (TLS/HTTPS for all connections)</li>
              <li>Encryption at rest for stored data</li>
              <li>Secure password hashing (your password is never stored in plain text)</li>
              <li>PCI DSS-compliant payment processing via Authorize.net</li>
              <li>Regular security reviews of our infrastructure</li>
              <li>Role-based access controls for our team</li>
            </ul>
            <p className="mt-3">
              No system is 100% secure. If we become aware of a data breach that affects
              your personal information, we will notify you and the relevant regulators
              within the timeframes required by law:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-1">
              <li>EU/UK users: within 72 hours of awareness (GDPR Article 33)</li>
              <li>Bermuda residents: without undue delay, consistent with PIPA</li>
              <li>California residents: as required by California breach notification law</li>
            </ul>
          </section>

          {/* 6. Data Retention */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              6. Data Retention
            </h2>
            <p>We retain your data as follows:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                <strong className="text-text-primary">Active accounts:</strong> Your data
                is retained for as long as your account is active and your subscription is
                current.
              </li>
              <li>
                <strong className="text-text-primary">After cancellation:</strong> If you
                cancel your subscription, your data is retained for 30 days in case you
                decide to resubscribe. After 30 days, financial data is deleted from our
                active systems.
              </li>
              <li>
                <strong className="text-text-primary">Account deletion:</strong> When you
                delete your account from Settings, we delete your personal information and
                financial data within 30 days. Some anonymized, aggregated data may be
                retained for analytics purposes.
              </li>
              <li>
                <strong className="text-text-primary">Billing records:</strong> Transaction
                records may be retained for up to 7 years as required by applicable
                financial regulations.
              </li>
              <li>
                <strong className="text-text-primary">Backups:</strong> Encrypted backups
                may persist for up to 90 days beyond active-system deletion before being
                overwritten in normal backup rotation.
              </li>
            </ul>
          </section>

          {/* 7. Your Rights (General) */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              7. Your Rights
            </h2>
            <p>Regardless of where you live, you have the following rights regarding your data:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                <strong className="text-text-primary">Access.</strong> You can view all
                your personal and financial data within MyProfitPulse at any time through
                your dashboard and Settings page.
              </li>
              <li>
                <strong className="text-text-primary">Correction.</strong> You can update
                your account information and re-upload corrected financial data at any
                time.
              </li>
              <li>
                <strong className="text-text-primary">Deletion.</strong> You can delete
                your account from the Settings page. This initiates removal of your data
                as described in the Data Retention section.
              </li>
              <li>
                <strong className="text-text-primary">Export.</strong> You can request a
                copy of your data by contacting us at{" "}
                <a
                  href="mailto:hello@myprofitpulse.app"
                  className="text-orange hover:underline"
                >
                  hello@myprofitpulse.app
                </a>
                . We&apos;ll provide your data in a portable format (CSV or JSON) within
                30 days.
              </li>
              <li>
                <strong className="text-text-primary">Opt Out of Emails.</strong> You can
                unsubscribe from weekly summary and product-update emails at any time from
                Settings. Transactional emails (billing, security) will continue as long
                as your account is active.
              </li>
            </ul>
            <p className="mt-3">
              Region-specific rights below (EU/UK, California, other US states, Bermuda)
              extend these baseline rights.
            </p>
          </section>

          {/* 8. Cookies */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              8. Cookies
            </h2>
            <p>
              We use minimal cookies&mdash;only what&apos;s necessary to keep the Service
              working:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                <strong className="text-text-primary">Session cookies:</strong> Used to
                keep you logged in during your browser session.
              </li>
              <li>
                <strong className="text-text-primary">Authentication tokens:</strong>{" "}
                Stored securely to maintain your logged-in state across visits.
              </li>
            </ul>
            <p className="mt-3">
              We do not use third-party advertising cookies, social-media cookies, or
              cross-site tracking. We do not participate in ad networks. Because we use
              only strictly necessary cookies, a cookie consent banner is not required
              under the EU ePrivacy Directive.
            </p>
          </section>

          {/* 9. Children's Privacy */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              9. Children&apos;s Privacy
            </h2>
            <p>
              MyProfitPulse is a business tool designed for adults. The Service is not
              intended for anyone under 18 years of age. We do not knowingly collect
              personal information from children. If we learn that we&apos;ve collected
              data from someone under 18, we will delete that information promptly.
              MyProfitPulse is not directed to children under 13, and we comply with COPPA
              by not knowingly collecting from anyone under that age.
            </p>
          </section>

          {/* 10. International Data Transfers */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              10. International Data Transfers
            </h2>
            <p>
              Fusion 4 Business is based in Bermuda. Our service providers process data
              in other jurisdictions, including the United States and the European Union.
              By using MyProfitPulse, you consent to your data being transferred to and
              processed in these locations.
            </p>
            <p className="mt-3">
              <strong className="text-text-primary">For EU and UK users:</strong> Bermuda
              has been recognized by the European Commission as providing an adequate
              level of data protection (since 2008), so transfers from the EU to Bermuda
              do not require additional safeguards. The UK has confirmed equivalent
              adequacy.
            </p>
            <p className="mt-3">
              Where data is transferred to providers outside Bermuda (e.g., US-based
              sub-processors), we rely on Standard Contractual Clauses, adequacy decisions,
              or other lawful transfer mechanisms as appropriate.
            </p>
          </section>

          {/* 11. EU/UK GDPR */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              11. For Users in the EU, UK, and EEA (GDPR / UK GDPR)
            </h2>
            <p>
              If you&apos;re located in the European Union, European Economic Area, or the
              United Kingdom, you have rights under the General Data Protection
              Regulation (GDPR) and UK GDPR:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                <strong className="text-text-primary">Legal Basis.</strong> We process
                your data based on:
                <ul className="list-circle pl-6 mt-2 space-y-1">
                  <li>
                    <em>Performance of contract</em> — providing the Service you signed
                    up for (covers account, financial-data processing, billing).
                  </li>
                  <li>
                    <em>Consent</em> — for optional weekly summary emails and product
                    updates (you can withdraw at any time in Settings).
                  </li>
                  <li>
                    <em>Legitimate interests</em> — for fraud prevention, security
                    monitoring, and product improvement using aggregate analytics.
                  </li>
                  <li>
                    <em>Legal obligation</em> — for retention of billing records and
                    response to lawful regulatory requests.
                  </li>
                </ul>
              </li>
              <li>
                <strong className="text-text-primary">
                  Right to Object to Automated Decision-Making (Article 22).
                </strong>{" "}
                MyProfitPulse uses AI to generate a financial health score and
                recommendations. While we have designed these to be informational and
                non-binding (we never use them to deny service or take adverse action),
                you have the right to request human review of any automated output by
                contacting us. We will arrange a human review within 30 days.
              </li>
              <li>
                <strong className="text-text-primary">Right to Restrict Processing.</strong>{" "}
                You can request that we limit how we use your data.
              </li>
              <li>
                <strong className="text-text-primary">Right to Data Portability.</strong>{" "}
                You can request a machine-readable copy of your data (CSV/JSON).
              </li>
              <li>
                <strong className="text-text-primary">Right to Object.</strong> You can
                object to data processing based on our legitimate interests.
              </li>
              <li>
                <strong className="text-text-primary">Right to Withdraw Consent.</strong>{" "}
                Where processing is based on consent (e.g., marketing emails), you can
                withdraw at any time without affecting prior lawful processing.
              </li>
              <li>
                <strong className="text-text-primary">Right to Lodge a Complaint.</strong>{" "}
                You can file a complaint with your local data protection authority. In
                the UK, that&apos;s the Information Commissioner&apos;s Office (ICO).
              </li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at{" "}
              <a
                href="mailto:hello@myprofitpulse.app"
                className="text-orange hover:underline"
              >
                hello@myprofitpulse.app
              </a>
              . We&apos;ll respond within 30 days (extendable to 90 days for complex
              requests, with notice).
            </p>
          </section>

          {/* 12. CCPA / CPRA */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              12. For California Residents (CCPA / CPRA)
            </h2>
            <p>
              If you&apos;re a California resident, the California Consumer Privacy Act,
              as amended by the California Privacy Rights Act, gives you specific rights.
              The regulations effective January 1, 2026 expand these.
            </p>

            <h3 className="text-heading-sm text-text-primary mt-4 mb-2">
              Sensitive Personal Information
            </h3>
            <p>
              We collect financial account information, which qualifies as &quot;Sensitive
              Personal Information&quot; (SPI) under the CPRA. We use SPI only for the
              purpose of providing the Service you signed up for (powering your
              dashboard, scoring, scenarios, and AI insights).{" "}
              <strong className="text-text-primary">
                We do not use SPI for inferences about your character, behavior,
                preferences, or for advertising.
              </strong>{" "}
              Because we limit SPI use to providing the requested service, we are not
              required to display a &quot;Limit the Use of My Sensitive Personal
              Information&quot; link — but the right itself is yours and you can exercise
              it by contacting us.
            </p>

            <h3 className="text-heading-sm text-text-primary mt-4 mb-2">
              Your California Privacy Rights
            </h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-text-primary">Right to Know.</strong> You can
                request details about what personal information we&apos;ve collected,
                used, disclosed, sold, or shared in the prior 12 months.
              </li>
              <li>
                <strong className="text-text-primary">Right to Delete.</strong> You can
                request deletion of your personal information (available via Settings or
                by contacting us).
              </li>
              <li>
                <strong className="text-text-primary">Right to Correct.</strong> You can
                request correction of inaccurate personal information.
              </li>
              <li>
                <strong className="text-text-primary">Right to Opt Out of Sale/Sharing.</strong>{" "}
                We do not sell your personal information and we do not share it for
                cross-context behavioral advertising. There is nothing to opt out of, but
                if our practices ever change we&apos;ll provide the required mechanism.
              </li>
              <li>
                <strong className="text-text-primary">Right to Limit SPI Use.</strong>{" "}
                See above.
              </li>
              <li>
                <strong className="text-text-primary">Right to Non-Discrimination.</strong>{" "}
                We will not discriminate against you for exercising your CCPA/CPRA rights.
              </li>
            </ul>
            <p className="mt-3">
              To exercise these rights, contact{" "}
              <a
                href="mailto:hello@myprofitpulse.app"
                className="text-orange hover:underline"
              >
                hello@myprofitpulse.app
              </a>
              . We verify identity using the email address on your account before
              fulfilling requests involving sensitive data.
            </p>
          </section>

          {/* 13. Other US State Privacy Laws */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              13. Other US State Privacy Laws
            </h2>
            <p>
              Residents of Virginia (VCDPA), Colorado (CPA), Connecticut (CTDPA), Utah
              (UCPA), and Texas (TDPSA) have similar rights to those described in § 12 —
              including access, correction, deletion, portability, and opt-out of certain
              processing. To exercise these rights, contact us at the email above. We
              comply with applicable state-law response timelines (typically 45 days,
              extendable to 90 with notice).
            </p>
            <p className="mt-3">
              We do not engage in &quot;targeted advertising,&quot; &quot;sale,&quot; or
              &quot;profiling for legal/significant decisions&quot; as defined under these
              laws.
            </p>
          </section>

          {/* 14. Bermuda PIPA */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              14. For Bermuda Residents (PIPA)
            </h2>
            <p>
              The Bermuda Personal Information Protection Act 2016 (PIPA) came into full
              force on January 1, 2025. As a Bermuda-based controller, we comply with
              PIPA for all individuals whose personal information we process. PIPA gives
              you the right to:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your information</li>
              <li>Request that processing be restricted in certain circumstances</li>
              <li>Withdraw consent where processing is based on consent</li>
              <li>Lodge a complaint with the Bermuda Office of the Privacy Commissioner</li>
            </ul>
            <p className="mt-3">
              Privacy Commissioner contact:{" "}
              <a
                href="https://www.privacy.bm"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange hover:underline"
              >
                privacy.bm
              </a>
              . You can also reach us at{" "}
              <a
                href="mailto:hello@myprofitpulse.app"
                className="text-orange hover:underline"
              >
                hello@myprofitpulse.app
              </a>
              .
            </p>
          </section>

          {/* 15. Changes */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              15. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. When we make
              significant changes, we&apos;ll notify you by email and through the Service
              at least 14 days before the changes take effect.
            </p>
            <p className="mt-3">
              The &quot;Last updated&quot; date at the top of this page indicates when this
              policy was last revised. We encourage you to review it periodically.
            </p>
          </section>

          {/* 16. Contact */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              16. Contact Us
            </h2>
            <p>
              If you have questions about this Privacy Policy or how we handle your data,
              reach out to us:
            </p>
            <div className="mt-3 bg-surface-inset rounded-lg p-5">
              <p className="font-semibold text-text-primary">Fusion 4 Business</p>
              <p className="mt-1">Bermuda</p>
              <p className="mt-1">
                Email:{" "}
                <a
                  href="mailto:hello@myprofitpulse.app"
                  className="text-orange hover:underline"
                >
                  hello@myprofitpulse.app
                </a>
              </p>
            </div>
            <p className="mt-4">
              For data-related requests (access, deletion, export, correction), please
              include &quot;Data Request&quot; in your email subject line so we can
              prioritize your inquiry. We respond within the timeframes required by your
              applicable jurisdiction (typically 30 days under GDPR/PIPA, 45 days under
              CCPA).
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-6">
        <div className="max-w-3xl mx-auto px-6 flex items-center justify-between text-caption text-text-muted">
          <p>&copy; 2026 Fusion 4 Business. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-orange transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-orange transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
