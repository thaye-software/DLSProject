export default function TermsAndConditionsPage() {
  const lastUpdated = new Date().toLocaleDateString();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-4">Terms and Conditions</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Last updated: {lastUpdated}
      </p>

      <section className="prose max-w-none mb-6">
        <p>
          These Terms and Conditions ("Terms") govern your access to and use of
          the Finite Watches website and services. By using our site or placing
          an order, you agree to be bound by these Terms. If you do not agree to
          these Terms, please do not use the site.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Definitions</h2>
        <p className="text-sm text-muted-foreground">
          "We", "us" and "our" refer to Finite Watches. "You" or "customer"
          refers to any person or entity using our website or purchasing
          products.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">
          Orders, Pricing and Taxes
        </h2>
        <p className="mb-2">
          All prices on the site are displayed in the currency indicated and
          include any taxes specified in the product listing. Prices are subject
          to change without notice. When you place an order, you will receive an
          order confirmation that includes the final price, taxes and shipping
          costs.
        </p>
        <p className="mb-2">
          Taxes (including VAT/GST) depend on the shipping destination and
          applicable laws. We display estimated tax amounts during checkout for
          convenience. Final tax amounts are calculated and validated on our
          servers before the order is processed. You are responsible for any
          import duties or local taxes charged by customs in the destination
          country.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Payment</h2>
        <p className="mb-2">
          Payment is required at the time of purchase. We accept the payment
          methods displayed at checkout. By submitting payment information you
          warrant that you are authorized to use the chosen payment method.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Shipping and Delivery</h2>
        <p className="mb-2">
          Shipping times and costs vary depending on the destination and the
          shipping option selected. Estimated delivery times are provided for
          convenience and are not guaranteed. We are not responsible for delays
          caused by carriers, customs clearance or force majeure events.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Returns and Refunds</h2>
        <p className="mb-2">
          If you wish to return a product, please follow our returns process as
          described on the Returns page. Returns are subject to our returns
          policy, and a refund will be issued according to the policy once the
          returned item is received and inspected.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Intellectual Property</h2>
        <p className="mb-2">
          All content on the site, including text, images, logos and designs, is
          the property of Finite Watches or its licensors and is protected by
          intellectual property laws. You may not reproduce or use our content
          without prior written permission.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Limitation of Liability</h2>
        <p className="mb-2">
          To the maximum extent permitted by law, Finite Watches and its
          affiliates will not be liable for any indirect, incidental, special or
          consequential damages arising out of or in connection with the use of
          the site or products purchased through the site.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Indemnification</h2>
        <p className="mb-2">
          You agree to indemnify and hold harmless Finite Watches, its
          officers, directors and employees from any claims, losses, damages and
          expenses (including reasonable attorneys' fees) arising from your use
          of the site or violation of these Terms.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Privacy</h2>
        <p className="mb-2">
          Our Privacy Policy describes how we collect and use personal
          information. By using the site you agree to our collection and use of
          personal information in accordance with the Privacy Policy.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Changes to These Terms</h2>
        <p className="mb-2">
          We may update these Terms from time to time. Updated Terms will be
          posted on this page with a new "Last updated" date. Continued use of
          the site after changes constitutes acceptance of the updated Terms.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Governing Law</h2>
        <p className="mb-2">
          These Terms are governed by and construed in accordance with the laws
          of the jurisdiction in which Finite Watches is headquartered, without
          regard to its conflict of law principles.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Contact</h2>
        <p className="mb-2">
          If you have questions about these Terms, please contact us at
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
