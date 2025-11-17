import Stripe from "stripe";



function createStripeClient() {
  
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    // Return null during build, throw at runtime
    if (process.env.NODE_ENV === 'production') {
      throw new Error('STRIPE_SECRET_KEY is required in production');
    }

    return null;
  }

  return new Stripe(apiKey);
}

export const stripe = createStripeClient();
