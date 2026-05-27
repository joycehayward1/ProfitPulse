"use client";

import Link from "next/link";
import Image from "next/image";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/full-logo.png"
              alt="ProfitPulse"
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
          Terms of Service &amp; End User License Agreement
        </h1>
        <p className="text-body text-text-muted mb-10">
          Last updated: May 2026
        </p>

        <div className="space-y-8 text-body text-text-secondary leading-relaxed">
          {/* Introduction */}
          <section>
            <p>
              Welcome to ProfitPulse. These Terms of Service (&quot;Terms&quot;) and End User
              License Agreement (&quot;EULA&quot;) govern your use of the ProfitPulse platform at
              myprofitpulse.app (&quot;Service&quot; or &quot;Application&quot;), operated by Fusion 4
              Business (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), a company registered in
              Bermuda.
            </p>
            <p className="mt-3">
              By creating an account, connecting QuickBooks, or using ProfitPulse, you
              agree to these Terms and the EULA below. If you don&apos;t agree, please
              don&apos;t use the Service.
            </p>
            <p className="mt-3">
              We&apos;ve tried to write these in plain English. If anything is unclear,
              email us at{" "}
              <a
                href="mailto:hello@myprofitpulse.app"
                className="text-orange hover:underline"
              >
                hello@myprofitpulse.app
              </a>
              .
            </p>
          </section>

          {/* End User License Agreement (EULA) */}
          <section id="eula">
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              End User License Agreement (EULA)
            </h2>
            <p>
              This End User License Agreement is a legally binding agreement between you
              (&quot;User,&quot; &quot;you,&quot; or &quot;your&quot;) and Fusion 4 Business for your use of the
              ProfitPulse software application, including any QuickBooks Online integration
              features (collectively, the &quot;Application&quot;). By installing, accessing,
              registering for, or using the Application, you acknowledge that you have read,
              understood, and agree to be bound by this EULA and our{" "}
              <Link href="/privacy" className="text-orange hover:underline">
                Privacy Policy
              </Link>
              .
            </p>

            <h3 className="font-display text-body font-semibold text-text-primary mt-6 mb-2">
              A. License Grant
            </h3>
            <p>
              The Application is licensed, not sold. Subject to your compliance with these
              Terms and payment of applicable subscription fees, Fusion 4 Business grants you
              a personal, limited, non-exclusive, non-transferable, revocable license to
              access and use the Application solely for your internal business operations
              during your active subscription period. This license does not permit you to
              sublicense, resell, rent, lease, or distribute the Application to third
              parties.
            </p>

            <h3 className="font-display text-body font-semibold text-text-primary mt-6 mb-2">
              B. Restrictions
            </h3>
            <p>You may not, and may not permit others to:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                Copy, modify, adapt, translate, reverse-engineer, decompile, or disassemble
                any portion of the Application except as permitted by applicable law
              </li>
              <li>
                Use the Application to build a competing product or service, or to access
                the Application through unauthorized automated means
              </li>
              <li>
                Remove, alter, or obscure any proprietary notices on or within the
                Application
              </li>
              <li>
                Use Intuit, QuickBooks, or other third-party trademarks in a way that
                suggests endorsement, affiliation, or sponsorship by those parties
              </li>
            </ul>

            <h3 className="font-display text-body font-semibold text-text-primary mt-6 mb-2">
              C. QuickBooks Online Integration and Data Authorization
            </h3>
            <p>
              If you choose to connect ProfitPulse to QuickBooks Online, you authorize
              Fusion 4 Business to access, retrieve, store, process, and display accounting
              and financial data from your connected QuickBooks company on your behalf,
              solely to provide the Application&apos;s features (such as dashboards, insights,
              and reporting). This authorization is granted through Intuit&apos;s OAuth 2.0
              consent flow and is limited to the scopes you approve at connection time
              (currently the QuickBooks Online Accounting scope).
            </p>
            <p className="mt-3">
              You acknowledge that Intuit or its service providers may transfer data
              between QuickBooks Online and ProfitPulse to enable this integration. You
              represent that you have the authority to connect the QuickBooks company and
              to grant this access on behalf of that business.
            </p>
            <p className="mt-3">
              <strong className="text-text-primary">Revoking access.</strong> You may
              disconnect QuickBooks at any time from your ProfitPulse Settings page, which
              stops future data syncs and removes stored OAuth tokens from our systems. You
              may also revoke ProfitPulse&apos;s access from your Intuit account or QuickBooks
              App Center settings. Disconnecting may limit or disable features that depend
              on QuickBooks data. Data previously imported into ProfitPulse remains in your
              account until you delete it or close your account.
            </p>
            <p className="mt-3">
              For details on how we collect, use, store, and protect QuickBooks data, see
              our{" "}
              <Link href="/privacy" className="text-orange hover:underline">
                Privacy Policy
              </Link>
              .
            </p>

            <h3 className="font-display text-body font-semibold text-text-primary mt-6 mb-2">
              D. Third-Party Services (Including Intuit)
            </h3>
            <p>
              The Application may integrate with third-party services such as QuickBooks
              Online (provided by Intuit Inc.), payment processors, and hosting providers.
              Your use of those services is governed by the third party&apos;s own terms and
              privacy policies, including{" "}
              <a
                href="https://www.intuit.com/legal/terms/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange hover:underline"
              >
                Intuit&apos;s Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="https://www.intuit.com/privacy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange hover:underline"
              >
                Intuit&apos;s Privacy Statement
              </a>
              . You agree to comply with all applicable third-party terms when using the
              Application.
            </p>
            <p className="mt-3">
              <strong className="text-text-primary">
                ProfitPulse is an independent application and is not affiliated with,
                sponsored by, or endorsed by Intuit Inc.
              </strong>{" "}
              QuickBooks and Intuit are registered trademarks of Intuit Inc. Fusion 4
              Business is solely responsible for the Application and its support.
            </p>

            <h3 className="font-display text-body font-semibold text-text-primary mt-6 mb-2">
              E. Support and Maintenance
            </h3>
            <p>
              Support and maintenance for the Application are provided exclusively by Fusion
              4 Business, not by Intuit. For assistance, contact us at{" "}
              <a
                href="mailto:hello@myprofitpulse.app"
                className="text-orange hover:underline"
              >
                hello@myprofitpulse.app
              </a>
              . We do not guarantee uninterrupted availability of the Application or any
              third-party integration.
            </p>

            <h3 className="font-display text-body font-semibold text-text-primary mt-6 mb-2">
              F. Disclaimer of Warranties
            </h3>
            <p>
              THE APPLICATION IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES
              OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING IMPLIED WARRANTIES OF
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO
              NOT WARRANT THAT THE APPLICATION OR QUICKBOOKS INTEGRATION WILL BE ERROR-FREE,
              UNINTERRUPTED, OR ACCURATE. INTUIT MAKES NO WARRANTIES REGARDING THE
              APPLICATION AND IS NOT RESPONSIBLE FOR ITS PERFORMANCE.
            </p>

            <h3 className="font-display text-body font-semibold text-text-primary mt-6 mb-2">
              G. Limitation of Liability
            </h3>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, FUSION 4 BUSINESS SHALL NOT BE LIABLE
              FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
              OR FOR ANY LOSS OF PROFITS, REVENUE, DATA, OR BUSINESS OPPORTUNITIES, ARISING
              FROM YOUR USE OF OR INABILITY TO USE THE APPLICATION — INCLUDING ISSUES
              RELATED TO QUICKBOOKS CONNECTIVITY, DATA SYNC, OR THIRD-PARTY OUTAGES. OUR
              TOTAL LIABILITY FOR ANY CLAIM ARISING FROM THIS EULA OR THE APPLICATION SHALL
              NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE
              CLAIM.
            </p>
            <p className="mt-3">
              You acknowledge that Intuit Inc. and its affiliates are third-party
              beneficiaries of the disclaimers and limitations in this EULA and may enforce
              these provisions directly against you.
            </p>

            <h3 className="font-display text-body font-semibold text-text-primary mt-6 mb-2">
              H. Term and Termination
            </h3>
            <p>
              This EULA takes effect when you first access or use the Application and
              continues until your subscription ends or we terminate your access. We may
              suspend or terminate your license if you breach these Terms, fail to pay
              applicable fees, or use the Application in a manner that could harm us, other
              users, or third parties. Upon termination, you must stop using the Application
              and we may revoke your QuickBooks connection tokens.
            </p>

            <h3 className="font-display text-body font-semibold text-text-primary mt-6 mb-2">
              I. Updates to This EULA
            </h3>
            <p>
              We may update this EULA from time to time. Material changes will be posted on
              this page with an updated &quot;Last updated&quot; date and, where appropriate,
              communicated by email. Your continued use of the Application after changes
              become effective constitutes acceptance of the revised EULA.
            </p>
          </section>

          {/* 1. Account Registration */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              1. Account Registration and Eligibility
            </h2>
            <p>
              To use ProfitPulse, you must create an account with accurate, complete
              information. You must be at least 18 years old and have the legal authority
              to enter into these Terms. If you&apos;re using ProfitPulse on behalf of a
              business, you represent that you have the authority to bind that business to
              these Terms.
            </p>
            <p className="mt-3">
              You&apos;re responsible for keeping your login credentials secure. If you
              suspect unauthorized access to your account, contact us immediately at{" "}
              <a
                href="mailto:hello@myprofitpulse.app"
                className="text-orange hover:underline"
              >
                hello@myprofitpulse.app
              </a>
              . We&apos;re not liable for any loss resulting from unauthorized use of your
              account.
            </p>
          </section>

          {/* 2. Subscription and Billing */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              2. Subscription and Billing
            </h2>
            <p>ProfitPulse is a paid subscription service. Here&apos;s how billing works:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                <strong className="text-text-primary">Free Trial.</strong> New accounts
                receive a 7-day free trial with full access to all features. We collect
                your payment method at signup but do not charge it until the trial ends.
                You can cancel any time during the trial and you will not be charged.
              </li>
              <li>
                <strong className="text-text-primary">Pricing.</strong> After your trial,
                you&apos;ll be billed at $59.99/month or $599.88/year, depending on the plan
                you choose. All prices are in U.S. dollars unless stated otherwise.
              </li>
              <li>
                <strong className="text-text-primary">Auto-Renewal.</strong> Subscriptions
                renew automatically at the end of each billing cycle. You&apos;ll be charged
                using the payment method on file unless you cancel before the renewal date.
                We&apos;ll send a billing receipt by email after each successful charge.
              </li>
              <li>
                <strong className="text-text-primary">Failed Payments.</strong> If a charge
                fails, we&apos;ll retry over the following 7 days and send you reminder
                emails. If payment isn&apos;t recovered, we may suspend access until the
                balance is paid. Repeated non-payment may result in account termination.
              </li>
              <li>
                <strong className="text-text-primary">Cancellation.</strong> You can cancel
                your subscription at any time from your account Settings. When you cancel,
                you&apos;ll retain access until the end of your current billing period. We do
                not issue prorated refunds for unused time.
              </li>
              <li>
                <strong className="text-text-primary">Price Changes.</strong> We may adjust
                pricing with at least 30 days&apos; notice by email. Continued use after the
                change becomes effective constitutes acceptance of the new pricing. If you
                don&apos;t agree, you can cancel before the new price takes effect.
              </li>
            </ul>
          </section>

          {/* 3. Payment Processing and PCI Compliance */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              3. Payment Processing and PCI Compliance
            </h2>
            <p>
              All payments are processed by Authorize.net, a PCI DSS Level 1-compliant
              payment processor.{" "}
              <strong className="text-text-primary">
                Your credit card details are entered into a form served directly by
                Authorize.net and never touch our servers.
              </strong>{" "}
              We receive only a transaction confirmation and a secure token for processing
              future renewals.
            </p>
            <p className="mt-3">
              <strong className="text-text-primary">Chargebacks.</strong> If you initiate
              a chargeback rather than contacting us for a refund or cancellation, we
              reserve the right to suspend your account pending resolution. We&apos;re happy
              to resolve billing concerns directly — email us before disputing a charge
              with your card issuer.
            </p>
          </section>

          {/* 4. Refund Policy */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              4. Refund Policy
            </h2>
            <p>
              <strong className="text-text-primary">All sales are final.</strong> Because
              you have a 7-day free trial before your first charge, we do not issue
              refunds for subscription payments — including unused time, mid-cycle
              cancellations, or accidental renewals. You can cancel at any time and you
              will not be billed again.
            </p>
            <p className="mt-3">
              If you believe you were charged in error or are experiencing a technical
              issue that prevents you from using the Service, contact{" "}
              <a
                href="mailto:hello@myprofitpulse.app"
                className="text-orange hover:underline"
              >
                hello@myprofitpulse.app
              </a>{" "}
              and we&apos;ll work with you in good faith to make it right.
            </p>
          </section>

          {/* 5. Acceptable Use */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              5. Acceptable Use
            </h2>
            <p>
              You agree to use ProfitPulse only for its intended purpose: analyzing and
              understanding your own business&apos;s financial data. You may not:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Use the Service for any illegal or unauthorized purpose</li>
              <li>Attempt to gain unauthorized access to our systems or other users&apos; accounts</li>
              <li>Upload malicious files, viruses, or harmful code</li>
              <li>Reverse-engineer, decompile, or disassemble any part of the Service</li>
              <li>Use automated tools (bots, scrapers) to access the Service without our permission</li>
              <li>Resell, sublicense, or redistribute the Service to third parties</li>
              <li>Interfere with or disrupt the integrity or performance of the Service</li>
              <li>
                Upload personal information about anyone other than yourself or your own
                business without their authorization — including client lists,
                health-related details, or other people&apos;s identifiable financial data
              </li>
            </ul>
          </section>

          {/* 6. Your Data and Ownership */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              6. Your Data and Ownership
            </h2>
            <p>
              You retain full ownership of all financial data and business information you
              upload to ProfitPulse. By uploading data, you grant us a limited license to
              process, analyze, and display that data solely to provide the Service to you.
            </p>
            <p className="mt-3">
              We do not sell your data to third parties. We do not use your financial data
              to train AI models. For full details on how we handle your information, see
              our{" "}
              <Link href="/privacy" className="text-orange hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
            <p className="mt-3">
              <strong className="text-text-primary">Data export on termination.</strong>{" "}
              When you cancel or delete your account, you can request a copy of your data
              in a portable format (CSV/JSON) within 30 days of termination by emailing{" "}
              <a
                href="mailto:hello@myprofitpulse.app"
                className="text-orange hover:underline"
              >
                hello@myprofitpulse.app
              </a>
              . After 30 days, deleted data may no longer be recoverable.
            </p>
          </section>

          {/* 7. QuickBooks / Intuit Integration */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              7. QuickBooks / Intuit Integration
            </h2>
            <p>
              ProfitPulse offers an optional integration with QuickBooks Online. The legal
              terms governing that integration — including your data authorization, right to
              disconnect, third-party disclaimers, and Intuit third-party beneficiary
              provisions — are set out in the{" "}
              <a href="#eula" className="text-orange hover:underline">
                End User License Agreement (EULA)
              </a>{" "}
              above.
            </p>
            <p className="mt-3">
              In summary: connecting QuickBooks allows ProfitPulse to sync accounting data
              to power your dashboard. You can disconnect at any time from Settings or from
              your Intuit account. ProfitPulse is not affiliated with or endorsed by Intuit.
            </p>
          </section>

          {/* 8. AI Insights — Not Financial Advice */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              8. AI Insights — Not Financial Advice
            </h2>
            <p>
              <strong className="text-text-primary">
                ProfitPulse provides financial insights and analysis tools. It does not
                provide financial, tax, legal, or investment advice. No fiduciary or
                advisory relationship is created by your use of the Service.
              </strong>
            </p>
            <p className="mt-3">
              The health scores, scenarios, projections, and recommendations generated by
              ProfitPulse are produced by automated systems including artificial
              intelligence. They are based on the data you provide and on general
              best-practice principles. They are intended as informational tools — not as
              the basis for significant financial decisions.
            </p>
            <p className="mt-3">
              <strong className="text-text-primary">AI output may be wrong.</strong> AI
              systems can produce inaccurate, incomplete, or misleading results. You are
              responsible for verifying any AI-generated insight before acting on it. We
              recommend consulting with a qualified financial professional for specific
              financial decisions. We are not responsible for decisions made based on
              ProfitPulse&apos;s output.
            </p>
            <p className="mt-3">
              You own the AI-generated output that ProfitPulse displays in your account.
              You may use it for your own business purposes. You may not redistribute
              ProfitPulse-generated output as your own commercial product.
            </p>
          </section>

          {/* 9. Intellectual Property */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              9. Intellectual Property
            </h2>
            <p>
              The ProfitPulse platform&mdash;including its design, code, features, logo,
              brand, content, and proprietary algorithms&mdash;is owned by Fusion 4
              Business and protected by intellectual property laws. These Terms don&apos;t
              transfer any ownership rights to you.
            </p>
            <p className="mt-3">
              Your subscription grants you a personal, non-exclusive, non-transferable,
              revocable license to use ProfitPulse for your business during your active
              subscription period.
            </p>
          </section>

          {/* 10. Service Availability */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              10. Service Availability
            </h2>
            <p>
              We work hard to keep ProfitPulse available and performant, but we don&apos;t
              guarantee uninterrupted service. The Service may occasionally be unavailable
              due to maintenance, infrastructure issues, third-party outages (e.g., our
              hosting provider or payment processor), or events outside our reasonable
              control.
            </p>
            <p className="mt-3">
              The Service is provided &quot;as is&quot; and &quot;as available&quot; without
              warranties of any kind, whether express or implied, including but not
              limited to implied warranties of merchantability, fitness for a particular
              purpose, and non-infringement.
            </p>
          </section>

          {/* 11. Limitation of Liability */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              11. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by law, Fusion 4 Business and its
              directors, employees, agents, and service providers shall not be liable for
              any indirect, incidental, special, consequential, exemplary, or punitive
              damages arising from your use of ProfitPulse — including, but not limited
              to, loss of profits, loss of revenue, loss of business opportunities, loss
              of goodwill, or loss of data.
            </p>
            <p className="mt-3">
              Our total cumulative liability for any claim arising from or related to the
              Service shall not exceed the amount you paid us in the 12 months preceding
              the event giving rise to the claim.
            </p>
          </section>

          {/* 12. Indemnification */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              12. Indemnification
            </h2>
            <p>
              You agree to indemnify, defend, and hold harmless Fusion 4 Business and its
              affiliates from any claims, damages, losses, liabilities, or expenses
              (including reasonable legal fees) arising from: (a) your use of the Service,
              (b) your violation of these Terms, (c) your violation of any third
              party&apos;s rights, or (d) any data you upload that you didn&apos;t have
              authorization to share.
            </p>
          </section>

          {/* 13. Termination */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              13. Termination
            </h2>
            <p>
              You can delete your account at any time from the Settings page. Upon
              deletion, we will remove your personal and financial data in accordance with
              our Privacy Policy.
            </p>
            <p className="mt-3">
              We reserve the right to suspend or terminate your account if you violate
              these Terms, fail to pay, or use the Service in a way that could harm us,
              other users, or third parties. Where reasonably possible, we will provide
              notice and an opportunity to cure before taking action.
            </p>
            <p className="mt-3">
              Sections that by their nature should survive termination — including
              Refund Policy, Data Ownership, Limitation of Liability, Indemnification,
              and Governing Law — will remain in effect after your account is closed.
            </p>
          </section>

          {/* 14. Tax Responsibility */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              14. Tax Responsibility
            </h2>
            <p>
              The subscription price does not include any applicable sales tax, VAT, GST,
              or similar transaction taxes. If you are required to pay such taxes in your
              jurisdiction, you are responsible for them. Where required by law, we will
              add applicable taxes to your invoice.
            </p>
          </section>

          {/* 15. Governing Law and Dispute Resolution */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              15. Governing Law and Dispute Resolution
            </h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of
              Bermuda, without regard to its conflict-of-law provisions. Any disputes
              arising from these Terms or your use of the Service shall be subject to the
              exclusive jurisdiction of the courts of Bermuda.
            </p>
            <p className="mt-3">
              Before initiating any formal legal proceedings, you agree to first attempt
              to resolve the dispute informally by contacting us at{" "}
              <a
                href="mailto:hello@myprofitpulse.app"
                className="text-orange hover:underline"
              >
                hello@myprofitpulse.app
              </a>
              . We&apos;ll work in good faith to resolve the matter within 30 days. Most
              disputes can be solved with a conversation — try us first.
            </p>
            <p className="mt-3">
              <strong className="text-text-primary">No class actions.</strong> Any claim
              must be brought in your individual capacity, not as a plaintiff or class
              member in any purported class or representative proceeding.
            </p>
          </section>

          {/* 16. Changes to These Terms */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              16. Changes to These Terms
            </h2>
            <p>
              We may update these Terms from time to time. When we make significant
              changes, we&apos;ll notify you by email and through the Service at least 14
              days before the changes take effect. Your continued use of ProfitPulse after
              the changes become effective constitutes your acceptance of the updated
              Terms.
            </p>
            <p className="mt-3">
              The &quot;Last updated&quot; date at the top of this page indicates when these
              Terms were last revised.
            </p>
          </section>

          {/* 17. Miscellaneous */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              17. Miscellaneous
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-text-primary">Entire Agreement.</strong> These
                Terms and EULA, together with our Privacy Policy, constitute the entire
                agreement between you and Fusion 4 Business regarding ProfitPulse.
              </li>
              <li>
                <strong className="text-text-primary">Severability.</strong> If any
                provision of these Terms is found to be unenforceable, the remaining
                provisions will continue in full force and effect.
              </li>
              <li>
                <strong className="text-text-primary">No Waiver.</strong> Our failure to
                enforce any right or provision of these Terms does not constitute a
                waiver of that right or provision.
              </li>
              <li>
                <strong className="text-text-primary">Assignment.</strong> You may not
                assign your rights under these Terms without our prior written consent.
                We may assign our rights without restriction (for example, in connection
                with a merger or acquisition).
              </li>
              <li>
                <strong className="text-text-primary">Force Majeure.</strong> Neither
                party is liable for failure to perform due to events outside their
                reasonable control (natural disasters, pandemics, government action,
                internet/hosting outages, etc.).
              </li>
            </ul>
          </section>

          {/* 18. Contact */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              18. Contact Us
            </h2>
            <p>
              If you have questions about these Terms, reach out to us:
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
