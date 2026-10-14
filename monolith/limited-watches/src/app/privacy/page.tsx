export default function PrivacyPolicyPage() {
  const lastUpdated = new Date().toLocaleDateString();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Last updated: {lastUpdated}
      </p>

      <section className="prose max-w-none mb-6">
        <p>
          Finite Watches (“we”, “us”, “our”) is committed to protecting your
          privacy. This Privacy Policy explains how we collect, use, disclose,
          and safeguard your personal information when you visit or make a
          purchase from our website.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Information We Collect</h2>
        <p className="mb-2">
          We collect information you provide directly to us when you create an
          account, place an order, contact support, or interact with the
          website. This may include your name, email address, shipping and
          billing addresses, phone number, and payment information (processed by
          our payment provider).
        </p>
        <p className="mb-2">
          We use Supabase for authentication and user management. When you sign
          up or log in, account-related data (such as your email
          and user ID) is stored by Supabase according to their policies.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Analytics and Cookies</h2>
        <p className="mb-2">
          We use PostHog for anonymized analytics to understand how users
          interact with our site. PostHog collects usage data such as pages
          visited, events, and anonymized identifiers. This data is used to
          improve the site and troubleshoot issues. We do not use PostHog to
          collect personally-identifying information by default.
        </p>
        <p className="mb-2">
          We also use cookies and similar technologies to provide features,
          remember preferences, perform analytics, and measure ad performance.
          You can control cookies through your browser settings; however,
          disabling cookies may limit the functionality of the site.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">
          How We Use Your Information
        </h2>
        <ul className="list-disc pl-6 mb-2">
          <li>To provide, maintain, and improve our services.</li>
          <li>To process orders, payments and send order confirmations.</li>
          <li>To provide customer support and respond to inquiries.</li>
          <li>To detect and prevent fraud and abuse.</li>
          <li>
            To analyze usage and improve the user experience (via PostHog).
          </li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">
          Sharing and Third Parties
        </h2>
        <p className="mb-2">
          We may share your information with third-party service providers who
          help us operate the site and provide services (for example: payment
          processors, shipping partners, Supabase for authentication, and
          PostHog for analytics). These providers are authorized to use your
          information only as necessary to perform services for us.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Data Retention</h2>
        <p className="mb-2">
          We retain personal information for as long as necessary to provide
          services, comply with legal obligations, resolve disputes, and enforce
          our agreements. Retention periods may vary depending on the type of
          information and the purposes for which it was collected.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Your Rights</h2>
        <p className="mb-2">
          Depending on your jurisdiction, you may have rights to access,
          correct, update, or delete your personal information. You can manage
          your account information through your profile, or contact us at the
          address below to request assistance.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Security</h2>
        <p className="mb-2">
          We implement reasonable administrative and technical safeguards to
          protect your information. However, no method of transmission or
          storage is 100% secure. We cannot guarantee absolute security of your
          data.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Opting Out of Analytics</h2>
        <p className="mb-2">
          If you prefer not to be included in anonymized analytics, you can do
          so by disabling cookies in your browser, enabling Do Not Track, or
          contacting support to request exclusion. PostHog also supports client
          side opt-out configuration; consult PostHog documentation for details.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">International Transfers</h2>
        <p className="mb-2">
          Your information may be stored or processed in countries other than
          your own, including countries that may have different data protection
          laws. We take steps to ensure appropriate safeguards are used when
          transferring personal data internationally.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Children</h2>
        <p className="mb-2">
          Our site is not directed to children under 16. We do not knowingly
          collect personal information from children under 16. If you believe we
          have collected such information, please contact us.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Changes to this Policy</h2>
        <p className="mb-2">
          We may update this Privacy Policy occasionally. We will post the
          updated policy on this page with a new "Last updated" date.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Contact</h2>
        <p className="mb-2">
          For questions or requests related to your personal information, please
          contact us at
          <a
            className="text-primary ml-1"
            href="mailto:support@finitewatches.com"
          >
            support@finitewatches.com
          </a>
          .
        </p>
      </section>
    </div>
  );
}
