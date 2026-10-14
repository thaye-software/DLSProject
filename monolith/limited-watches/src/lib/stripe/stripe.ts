import Stripe from "stripe";



function createStripeClient() {
  
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error("STRIPE_SECRET_KEY is required to initialize Stripe client");
  }

  return new Stripe(apiKey);
}

export const stripe = createStripeClient();
