export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import Stripe from 'stripe';
import { stripe } from '@/lib/stripe/stripe'

import { eq } from 'drizzle-orm';
import { db } from '@/database/drizzle';
import { orders } from '@/database/schema';

import { getOrderById } from '@/services/orderService';
import { getLocalCurrencyString } from '@/services/currencyService';

import { sendOrderConfirmationEmail } from '@/app/orders/actions';

import CONSTANTS from "@/lib/constants"


export async function POST(req: NextRequest) {
  
  let event;
  const webhookSecret = process.env.APP_ENV?.toLowerCase() == 'prod' 
  ? process.env.STRIPE_WEBHOOK_SECRET_PROD
  : process.env.STRIPE_WEBHOOK_SECRET_DEV;

  
  try {
    if(!webhookSecret) {
      throw new Error("(server) no webhook secret provided");
    }

    if (!stripe) throw new Error('Stripe not available');
    event = stripe.webhooks.constructEvent(
      await req.text(),
      (await headers()).get('stripe-signature') as string,
      webhookSecret as string
    )
  } catch (err: any) {
    const errorMessage = err.message
    if (err) console.error("(server) error in stripe webhook",err)

    return NextResponse.json(
      { message: `Webhook Error: ${errorMessage}` },
      { status: 400 }
    )
  }

  const permittedEvents = ['payment_intent.succeeded']

  if (permittedEvents.includes(event.type)) {

    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          const intent = event.data.object as Stripe.PaymentIntent;
          const orderId = intent.metadata.internal_order_id 

          await handleSuccessfulPayment(orderId);

          break
        default:
          throw new Error(`Unhandled event: ${event.type}`)
      }
    } catch (error) {
      console.error("(server) error in stripe webhook handler ",error)
      return NextResponse.json(
        { message: 'Webhook handler failed' },
        { status: 500 }
      )
    }
  }
  return NextResponse.json({ message: 'Received' }, { status: 200 })
}

async function handleSuccessfulPayment(orderId: string) {
  try {
    const foundOrder = await getOrderById(orderId);
    if(!foundOrder) throw new Error("(server) unexpected error, could not find order");

    await confirmOrder(orderId);
    await sendConfirmationEmail(foundOrder);

  } catch (error) {
    console.error("(server) unexpected error",error)
    throw error;
  }
}

async function confirmOrder(orderId: string): Promise<void> {
  try {
    const updatedOrder = await db.update(orders).set({status: "PENDING"}).where(eq(orders.id, orderId)).returning();
    if(!updatedOrder[0]) throw new Error(`(server) failed to update status to "PENDING" for order with id: ${orderId}`);
  
  } catch(error) {
    throw error;
  }
}

async function sendConfirmationEmail(foundOrder: any): Promise<void> {
  const productImageSrc = foundOrder.orderItems[0].product.productImages[0].imageUrl;
  const productName =
    foundOrder.orderItems[0].product.watch.brand.name +
    " " +
    foundOrder.orderItems[0].product.watch.model;

  const customerEmail = foundOrder.user.email;

  const totalAmount = foundOrder?.totalPriceDkk;
  const targetCurrencyCode = foundOrder.currency.code;

  const displayTotalAmount = await getLocalCurrencyString(
    Number(totalAmount),
    targetCurrencyCode as string
  );

  const displayShippingCostDKK = await getLocalCurrencyString(
    Number(CONSTANTS.SHIPPING_PRICE_DKK * 100),
    targetCurrencyCode as string
  );

  const displayShippingCostEUR = await getLocalCurrencyString(
    Number(CONSTANTS.SHIPPING_PRICE_EUR * 100),
    targetCurrencyCode as string
  );

  const customer = foundOrder.billingAddress;
  const fullName = [
    customer?.firstName,
    customer?.middleName,
    customer?.lastName,
  ]
    .filter(Boolean)
    .join(" ");
    
  const orderDetails = {
    customerName: fullName,
    orderId: foundOrder.id,
    orderDate: foundOrder.createdAt,
    productName,
    productImageSrc,
    totalAmount: displayTotalAmount,
    quantity: foundOrder.orderItems[0].quantity,
    shippingCost: foundOrder.currency.code === "DKK" ? displayShippingCostDKK : displayShippingCostEUR
  };
  console.log("æøæøæåå")
console.log(orderDetails)
console.log(foundOrder.currency)
console.log(foundOrder.currency.code)

  const success = await sendOrderConfirmationEmail(customerEmail, orderDetails);
  if(!success) throw new Error(`(server) failed to send email confirmation for order with id: ${foundOrder.orderId}`);
}
