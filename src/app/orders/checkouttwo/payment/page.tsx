import CheckoutForm from '@/components/Stripe/Checkout'
import { stripe } from '@/lib/stripe/stripe'
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import ProgressSteps from "@/components/Orders/Info/ProgressSteps"

import { getOrderItemByOrderId } from '@/services/orderItemService'
import { getLocalCurrencyString } from '@/services/currencyService'
import Image from 'next/image'

import ToastWrapper from '@/components/Toast/ToastWrapper'
import { Suspense } from 'react'
import { Spinner } from '@/components/ui/spinner'
import BackButton from '@/components/BackButton'

//view all transaction at this link: https://dashboard.stripe.com/acct_1SKHlN6xjyBvX39o/test/payments
export default async function PaymentPage({ searchParams }: { searchParams: { orderId?: string; } }) {
	
  const { orderId } = await searchParams;
	if(!orderId) {
		return(
			<div>
				<ToastWrapper state={{
					message: "Something went wrong no order id detected...",
					success: false,
					redirectUrl: "/"	
				}}/>
			</div>
		)
	}
	

  const foundOrderItem = await getOrderItemByOrderId(orderId);
	if(!foundOrderItem) {
		return(
			<div>
				<ToastWrapper state={{
					message: `Something went wrong no order item found for order: ${orderId}...`,
					success: false,
					redirectUrl: "/"	
				}}/>
			</div>
		)
  }
  console.log("found order item in payment page:", foundOrderItem);
	const productImageSrc = foundOrderItem?.product.productImages[0].imageUrl;
	const productName = foundOrderItem?.product.watch.brand.name + " " + foundOrderItem?.product.watch.model;
	
  const shippingAmount = foundOrderItem?.order.shippingPriceDkk;
	const totalAmount = foundOrderItem?.order.totalPriceDkk;
  const targetCurrencyCode = foundOrderItem?.order.currency.code;
  const displayAmount = await getLocalCurrencyString(Number(foundOrderItem?.product.priceDkk), targetCurrencyCode as string);
  const displayTotalAmount = await getLocalCurrencyString(Number(totalAmount), targetCurrencyCode as string);
  const displayShippingAmount = await getLocalCurrencyString(Number(shippingAmount), targetCurrencyCode as string);
	
	
  const stripeAmountToBePaid = Number(totalAmount);
  if (!stripe) throw new Error('Stripe not available');
  const paymentIntent = await stripe.paymentIntents.create({
    amount: stripeAmountToBePaid,
    currency: 'dkk',
    automatic_payment_methods: {
      enabled: true,
    }
  })

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <ProgressSteps currentStep={2} />
      </div>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground">Checkout</h1>
        <BackButton addClassName='mb-8'/>
        
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Payment Form */}
          <div className="space-y-6">
            <Suspense fallback={<div>Loading... <Spinner/> </div>}>
              <CheckoutForm 
                clientSecret={paymentIntent.client_secret!} 
                orderId={orderId}
              />
            </Suspense>
          </div>

          {/* Right Column - Order Summary */}
          <div className="lg:sticky lg:top-8 h-fit">
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-foreground mb-6">Order Summary</h2>
              
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-24 h-24 rounded-lg overflow-hidden shrink-0 relative">
                    <Image
											src={productImageSrc || ""}
											alt={productName}
											fill
											className="w-full h-full object-cover"
										/>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-foreground">{productName}</h3>
                    <p className="text-md font-bold text-foreground mt-2">
                      {displayAmount}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground">
                      {displayAmount}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="text-foreground">{displayShippingAmount}</span>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between text-lg font-semibold">
                  <span className="text-foreground">Total</span>
                  <span className="text-foreground">
                    {displayTotalAmount}
                  </span>
                </div>
								<p>Todo show tax or no?</p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
