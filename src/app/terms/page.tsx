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
          Terms of Service
        </h1>
        <p className="text-body text-text-muted mb-10">
          Last updated: May 2026
        </p>

        <div className="space-y-8 text-body text-text-secondary leading-relaxed">
          {/* Introduction */}
          <section>
            <p>
              Welcome to ProfitPulse. These Terms of Service (&quot;Terms&quot;) govern your
              use of the ProfitPulse platform at myprofitpulse.app (&quot;Service&quot;),
              operated by Fusion 4 Business (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), a
              company registered in Bermuda.
            </p>
            <p className="mt-3">
              By creating an account or using ProfitPulse, you agree to these Terms. If
              you don&apos;t agree, please don&apos;t use the Service.
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
                href="mailto:hello@contact.myprofitpulse.app"
                className="text-orange hover:underline"
              >
                hello@contact.myprofitpulse.app
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
                receive a 7-day free trial with full access to all features. No charge is
                made during the trial period.
              </li>
              <li>
                <strong className="text-text-primary">Pricing.</strong> After your trial,
                you&apos;ll be billed at $59.99/month or $599.88/year, depending on the plan
                you choose.
              </li>
              <li>
                <strong className="text-text-primary">Auto-Renewal.</strong> Subscriptions
                renew automatically at the end of each billing cycle. You&apos;ll be charged
                using the payment method on file unless you cancel before the renewal date.
              </li>
              <li>
                <strong className="text-text-primary">Payment Processing.</strong> All
                payments are processed securely through Authorize.net. We never store your
                credit card information on our servers.
              </li>
              <li>
                <strong className="text-text-primary">Cancellation.</strong> You can cancel
                your subscription at any time from your account Settings. When you cancel,
                you&apos;ll retain access until the end of your current billing period. No
                partial refunds are issued for unused time.
              </li>
              <li>
                <strong className="text-text-primary">Price Changes.</strong> We may adjust
                pricing with at least 30 days&apos; notice. Continued use after the change
                constitutes acceptance of the new pricing.
              </li>
            </ul>
          </section>

          {/* 3. Acceptable Use */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              3. Acceptable Use
            </h2>
            <p>You agree to use ProfitPulse only for its intended purpose: analyzing and understanding your business&apos;s financial data. You may not:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Use the Service for any illegal or unauthorized purpose</li>
              <li>Attempt to gain unauthorized access to our systems or other users&apos; accounts</li>
              <li>Upload malicious files, viruses, or harmful code</li>
              <li>Reverse-engineer, decompile, or disassemble any part of the Service</li>
              <li>Use automated tools (bots, scrapers) to access the Service without our permission</li>
              <li>Resell, sublicense, or redistribute the Service to third parties</li>
              <li>Interfere with or disrupt the integrity or performance of the Service</li>
            </ul>
          </section>

          {/* 4. Your Data */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              4. Your Data
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
          </section>

          {/* 5. Intellectual Property */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              5. Intellectual Property
            </h2>
            <p>
              The ProfitPulse platform&mdash;including its design, code, features, logo,
              and content&mdash;is owned by Fusion 4 Business and protected by
              intellectual property laws. These Terms don&apos;t transfer any ownership rights
              to you.
            </p>
            <p className="mt-3">
              Your subscription grants you a personal, non-exclusive, non-transferable
              license to use ProfitPulse for your business during your active subscription
              period.
            </p>
          </section>

          {/* 6. Financial Insights Disclaimer */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              6. Financial Insights Disclaimer
            </h2>
            <p>
              <strong className="text-text-primary">
                ProfitPulse provides financial insights and analysis tools. It does not
                provide financial, tax, legal, or investment advice.
              </strong>
            </p>
            <p className="mt-3">
              The health scores, scenarios, projections, and recommendations generated by
              ProfitPulse are based on the data you provide and are intended to help you
              understand your business&apos;s financial position. They should not be used as the
              sole basis for making significant financial decisions.
            </p>
            <p className="mt-3">
              The accuracy of our analysis depends entirely on the accuracy and
              completeness of the data you upload. We recommend consulting with a
              qualified financial professional for specific financial advice. We are not
              responsible for decisions made based on ProfitPulse&apos;s output.
            </p>
          </section>

          {/* 7. Limitation of Liability */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              7. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by law, Fusion 4 Business and its
              directors, employees, and agents shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages arising from your
              use of ProfitPulse. This includes, but is not limited to, loss of profits,
              data, or business opportunities.
            </p>
            <p className="mt-3">
              Our total liability for any claim arising from or related to the Service
              shall not exceed the amount you paid us in the 12 months preceding the
              claim.
            </p>
            <p className="mt-3">
              The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of
              any kind, whether express or implied, including but not limited to implied
              warranties of merchantability, fitness for a particular purpose, and
              non-infringement.
            </p>
          </section>

          {/* 8. Indemnification */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              8. Indemnification
            </h2>
            <p>
              You agree to indemnify and hold harmless Fusion 4 Business from any claims,
              damages, or expenses (including reasonable legal fees) arising from your use
              of the Service, your violation of these Terms, or your violation of any
              rights of a third party.
            </p>
          </section>

          {/* 9. Termination */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              9. Termination
            </h2>
            <p>
              You can delete your account at any time from the Settings page. Upon
              deletion, we will remove your personal and financial data in accordance with
              our Privacy Policy.
            </p>
            <p className="mt-3">
              We reserve the right to suspend or terminate your account if you violate
              these Terms or use the Service in a way that could harm us, other users, or
              third parties. Where possible, we will provide notice before taking action.
            </p>
            <p className="mt-3">
              Sections that by their nature should survive termination (including
              Limitation of Liability, Indemnification, and Governing Law) will remain in
              effect after your account is closed.
            </p>
          </section>

          {/* 10. Governing Law */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              10. Governing Law and Disputes
            </h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of
              Bermuda, without regard to its conflict of law provisions. Any disputes
              arising from these Terms or your use of the Service shall be subject to the
              exclusive jurisdiction of the courts of Bermuda.
            </p>
            <p className="mt-3">
              Before initiating any formal legal proceedings, you agree to first attempt
              to resolve the dispute informally by contacting us at{" "}
              <a
                href="mailto:hello@contact.myprofitpulse.app"
                className="text-orange hover:underline"
              >
                hello@contact.myprofitpulse.app
              </a>
              . We&apos;ll work in good faith to resolve the matter within 30 days.
            </p>
          </section>

          {/* 11. Changes to These Terms */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              11. Changes to These Terms
            </h2>
            <p>
              We may update these Terms from time to time. When we make significant
              changes, we&apos;ll notify you by email or through the Service at least 14 days
              before the changes take effect. Your continued use of ProfitPulse after the
              changes become effective constitutes your acceptance of the updated Terms.
            </p>
            <p className="mt-3">
              We encourage you to review these Terms periodically. The &quot;Last updated&quot;
              date at the top of this page indicates when these Terms were last revised.
            </p>
          </section>

          {/* 12. Miscellaneous */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              12. Miscellaneous
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-text-primary">Entire Agreement.</strong> These
                Terms, together with our Privacy Policy, constitute the entire agreement
                between you and Fusion 4 Business regarding ProfitPulse.
              </li>
              <li>
                <strong className="text-text-primary">Severability.</strong> If any
                provision of these Terms is found to be unenforceable, the remaining
                provisions will continue in full force and effect.
              </li>
              <li>
                <strong className="text-text-primary">No Waiver.</strong> Our failure to
                enforce any right or provision of these Terms does not constitute a waiver
                of that right or provision.
              </li>
              <li>
                <strong className="text-text-primary">Assignment.</strong> You may not
                assign your rights under these Terms without our prior written consent. We
                may assign our rights without restriction.
              </li>
            </ul>
          </section>

          {/* 13. Contact */}
          <section>
            <h2 className="font-display text-display-sm text-text-primary mb-3">
              13. Contact Us
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
                  href="mailto:hello@contact.myprofitpulse.app"
                  className="text-orange hover:underline"
                >
                  hello@contact.myprofitpulse.app
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
