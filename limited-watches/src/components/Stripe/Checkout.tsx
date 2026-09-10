"use client"

import { FormEvent, useState } from "react"

import {
  PaymentElement,
  useStripe,
  useElements,
  Elements
} from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { toast } from "sonner"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

import { baseUrl } from "@/lib/utils/client/utils"



const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function PaymentForm({ orderId }: { orderId: string }) {
  const stripe = useStripe()
  const elements = useElements()
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsLoading(true)

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${baseUrl}/orders/checkout/success?orderId=${orderId}`,
      },
    })


    if (error) {
      setIsLoading(false)
      console.error("failed to confirm order", error)
      toast.error("failed to confirm order..")
      return;
    }

    setIsLoading(false)
  }

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold text-foreground mb-6">Payment Details</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <PaymentElement 
          options={{
            layout: "tabs",
            wallets: {
              applePay: "auto",
              googlePay: "auto"
            }
          }}
        />

        <Button 
          type="submit" 
          disabled={isLoading || !stripe || !elements}
          className="w-full h-12 text-base"
        >
          {isLoading ? (
            <span className="flex justify-center items-center gap-2">
              Processing... <Spinner />
            </span>
          ) : (
            "Confirm payment"
          )}
        </Button>
      </form>
    </Card>
  )
}

export default function CheckoutForm({ 
  clientSecret, 
  orderId 
}: { 
  clientSecret: string
  orderId: string 
}) {
  const appearance = {
    theme: 'stripe' as const,
    variables: {
      colorPrimary: '#ffffff',
      colorBackground: '#ffffff',
      colorText: '#ffffff',
      colorDanger: '#df1b41',
      fontFamily: 'system-ui, sans-serif',
      spacingUnit: '4px',
      borderRadius: '8px',
    },
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PaymentForm orderId={orderId} />
    </Elements>
  )
}
