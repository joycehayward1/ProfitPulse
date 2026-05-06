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
              src="/full-logo.png"
              alt="ProfitPulse"
              width={140}
              height={32}
              className="h-8 w-auto"
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
              At ProfitPulse, we take your privacy seriously. This Privacy Policy explains
              what data we collect, how we use it, and what rights you have. ProfitPulse
              is operated by Fusion 4 Business (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), a
              company registered in Bermuda.
            </p>
            <p className="mt-3">
              By using ProfitPulse at myprofitpulse.app, you agree to the practices
              described in this policy. If you don&apos;t agree, please don&apos;t use the Service.
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
              <li>Revenue, expenses, and cash flow figures</li>
              <li>Assets and liabilities</li>
              <li>Any other financial data you upload via spreadsheets</li>
            </ul>
            <p className="mt-2">
              This data is uploaded voluntarily by you and is used solely to power your
              dashboard, health score, and scenario analysis.
            </p>

            <h3 className="text-heading-sm text-text-primary mt-4 mb-2">
              Payment Information
            </h3>
            <p>
              When you subscribe, your payment card details are collected and processed
              directly by Authorize.net, our PCI DSS-compliant payment processor.{" "}
              <strong className="text-text-primary">
                Your card data never touches our servers.
              </strong>{" "}
              We only receive a transaction confirmation and a token for recurring billing.
            </p>

            <h3 className="text-heading-sm text-text-primary mt-4 mb-2">
              Usage Data
            </h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Pages visited and features used within ProfitPulse</li>
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
                transactional emails (password resets, billing confirmations) and, if you
                opt in, weekly financial summary emails.
              </li>
              <li>
                <strong className="text-text-primary">Improving the Service.</strong>{" "}
                Understanding how ProfitPulse is used so we can fix bugs, improve
                features, and build a better product.
              </li>
              <li>
                <strong className="text-text-primary">Security.</strong> Detecting and
                preventing fraud, abuse, and unauthorized access.
              </li>
            </ul>
          </section>

          {/* 3. AI Processing */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              3. AI Processing of Financial Data
            </h2>
            <p>
              ProfitPulse uses artificial intelligence to extract financial data from your
              uploaded spreadsheets and to generate insights, health scores, and scenario
              projections.
            </p>
            <p className="mt-3">Here&apos;s what you should know about our AI processing:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                AI processes your data solely to provide results to{" "}
                <strong className="text-text-primary">you</strong>. It is not shared with
                or visible to other users.
              </li>
              <li>
                Your financial data is <strong className="text-text-primary">not</strong>{" "}
                used to train or improve AI models. It is processed on-demand and not
                retained by the AI system beyond what&apos;s needed to generate your results.
              </li>
              <li>
                AI-generated insights are analytical tools, not financial advice. Always
                consult a qualified professional for important financial decisions.
              </li>
            </ul>
          </section>

          {/* 4. Third-Party Services */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              4. Third-Party Services
            </h2>
            <p>
              We work with a small number of trusted third-party providers to deliver the
              Service:
            </p>
            <div className="mt-4 space-y-4">
              <div className="bg-surface-inset rounded-lg p-4">
                <p className="font-semibold text-text-primary">Authorize.net</p>
                <p className="text-body-sm mt-1">
                  Payment processing. PCI DSS Level 1 compliant. Handles all credit card
                  transactions securely. We never store your card details.
                </p>
              </div>
              <div className="bg-surface-inset rounded-lg p-4">
                <p className="font-semibold text-text-primary">InsForge</p>
                <p className="text-body-sm mt-1">
                  Backend-as-a-Service. Provides our database, authentication, and AI
                  gateway infrastructure. Your data is stored securely in InsForge&apos;s
                  managed environment.
                </p>
              </div>
              <div className="bg-surface-inset rounded-lg p-4">
                <p className="font-semibold text-text-primary">Resend</p>
                <p className="text-body-sm mt-1">
                  Email delivery service. Used to send transactional emails (account
                  verification, password resets, billing notifications) and optional weekly
                  summary emails.
                </p>
              </div>
            </div>
            <p className="mt-4">
              Each provider processes data only as needed to provide their specific
              service. We do not sell or share your data with any other third parties.
            </p>
          </section>

          {/* 5. Data Security */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              5. Data Security
            </h2>
            <p>We take reasonable measures to protect your data, including:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Encryption in transit (TLS/HTTPS for all connections)</li>
              <li>Encryption at rest for stored data</li>
              <li>Secure password hashing (your password is never stored in plain text)</li>
              <li>PCI DSS-compliant payment processing via Authorize.net</li>
              <li>Regular security reviews of our infrastructure</li>
              <li>Role-based access controls for our team</li>
            </ul>
            <p className="mt-3">
              No system is 100% secure. While we do our best to protect your data, we
              cannot guarantee absolute security. If we become aware of a data breach that
              affects your personal information, we will notify you promptly.
            </p>
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
                decide to resubscribe. After 30 days, financial data is deleted.
              </li>
              <li>
                <strong className="text-text-primary">Account deletion:</strong> When you
                delete your account from Settings, we delete your personal information and
                financial data within 30 days. Some anonymized, aggregated data may be
                retained for analytics purposes.
              </li>
              <li>
                <strong className="text-text-primary">Billing records:</strong>{" "}
                Transaction records may be retained for up to 7 years as required by
                applicable financial regulations.
              </li>
            </ul>
          </section>

          {/* 7. Your Rights */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              7. Your Rights
            </h2>
            <p>You have the following rights regarding your data:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                <strong className="text-text-primary">Access.</strong> You can view all
                your personal and financial data within ProfitPulse at any time through
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
                  href="mailto:hello@contact.myprofitpulse.app"
                  className="text-orange hover:underline"
                >
                  hello@contact.myprofitpulse.app
                </a>
                . We&apos;ll provide your data in a portable format within 30 days.
              </li>
              <li>
                <strong className="text-text-primary">Opt Out of Emails.</strong> You can
                unsubscribe from weekly summary emails at any time. Transactional emails
                (billing, security) will continue as long as your account is active.
              </li>
            </ul>
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
              We do not use third-party tracking cookies, advertising cookies, or social
              media cookies. We do not participate in ad networks or cross-site tracking.
            </p>
          </section>

          {/* 9. Children's Privacy */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              9. Children&apos;s Privacy
            </h2>
            <p>
              ProfitPulse is a business tool designed for adults. The Service is not
              intended for anyone under 18 years of age. We do not knowingly collect
              personal information from children. If we learn that we&apos;ve collected data
              from someone under 18, we will delete that information promptly.
            </p>
          </section>

          {/* 10. International Data Transfers */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              10. International Data Transfers
            </h2>
            <p>
              Fusion 4 Business is based in Bermuda. Our service providers may process
              data in other jurisdictions (including the United States). By using
              ProfitPulse, you consent to your data being transferred to and processed in
              these locations.
            </p>
            <p className="mt-3">
              We ensure that all third-party providers maintain appropriate security
              standards and handle your data in accordance with this Privacy Policy.
            </p>
          </section>

          {/* 11. GDPR */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              11. For Users in the European Economic Area (GDPR)
            </h2>
            <p>
              If you&apos;re located in the EEA, you have additional rights under the General
              Data Protection Regulation (GDPR):
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                <strong className="text-text-primary">Legal Basis.</strong> We process
                your data based on: (a) your consent when you create an account, (b)
                performance of our contract with you (providing the Service), and (c) our
                legitimate interests in improving and securing the Service.
              </li>
              <li>
                <strong className="text-text-primary">Right to Restrict Processing.</strong>{" "}
                You can request that we limit how we use your data.
              </li>
              <li>
                <strong className="text-text-primary">Right to Data Portability.</strong>{" "}
                You can request a machine-readable copy of your data.
              </li>
              <li>
                <strong className="text-text-primary">Right to Object.</strong> You can
                object to data processing based on our legitimate interests.
              </li>
              <li>
                <strong className="text-text-primary">Right to Lodge a Complaint.</strong>{" "}
                You have the right to file a complaint with your local data protection
                authority.
              </li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at{" "}
              <a
                href="mailto:hello@contact.myprofitpulse.app"
                className="text-orange hover:underline"
              >
                hello@contact.myprofitpulse.app
              </a>
              .
            </p>
          </section>

          {/* 12. CCPA */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              12. For California Residents (CCPA)
            </h2>
            <p>
              If you&apos;re a California resident, the California Consumer Privacy Act (CCPA)
              gives you specific rights:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                <strong className="text-text-primary">Right to Know.</strong> You can
                request details about what personal information we&apos;ve collected about you
                and how we&apos;ve used it.
              </li>
              <li>
                <strong className="text-text-primary">Right to Delete.</strong> You can
                request deletion of your personal information (available via Settings or by
                contacting us).
              </li>
              <li>
                <strong className="text-text-primary">Right to Non-Discrimination.</strong>{" "}
                We will not discriminate against you for exercising your CCPA rights.
              </li>
              <li>
                <strong className="text-text-primary">No Sale of Data.</strong> We do not
                sell your personal information. We have never sold personal information and
                have no plans to do so.
              </li>
            </ul>
          </section>

          {/* 13. Changes */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              13. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. When we make
              significant changes, we&apos;ll notify you by email or through the Service at
              least 14 days before the changes take effect.
            </p>
            <p className="mt-3">
              The &quot;Last updated&quot; date at the top of this page indicates when this
              policy was last revised. We encourage you to review it periodically.
            </p>
          </section>

          {/* 14. Contact */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              14. Contact Us
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
                  href="mailto:hello@contact.myprofitpulse.app"
                  className="text-orange hover:underline"
                >
                  hello@contact.myprofitpulse.app
                </a>
              </p>
            </div>
            <p className="mt-4">
              For data-related requests (access, deletion, export), please include
              &quot;Data Request&quot; in your email subject line so we can prioritize your
              inquiry.
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
