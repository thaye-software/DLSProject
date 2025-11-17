import Link from "next/link";
import Image from "next/image";
import { SearchParams } from "next/dist/server/request/search-params";

import ToastWrapper from "@/components/Toast/ToastWrapper";
import ProgressSteps from "@/components/Orders/Info/ProgressSteps";

import { convertPrice } from "@/services/currencyService";
import { getOrderItemByOrderId } from "@/services/orderItemService";
import { sendOrderConfirmationEmail } from "../../actions";


export default async function SuccessPage({searchParams}: {searchParams: SearchParams}) {

    const { orderId, payment_intent, payment_intent_client_secret, redirect_status } = await searchParams
    if(!orderId || !payment_intent || !payment_intent_client_secret || redirect_status != "succeeded") {
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
    
  


    const foundOrderItem = await getOrderItemByOrderId(orderId[0]);
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



    const productImageSrc = foundOrderItem?.product.productImages[0].imageUrl;
    const productName = foundOrderItem?.product.watch.brand.name + " " + foundOrderItem?.product.watch.model;
    
    const customerEmail = foundOrderItem.order.user.email;

    const amount = foundOrderItem?.order.totalPriceDkk;
    const targetCurrencyCode = foundOrderItem?.order.currency.code;
    const displayAmount = await convertPrice(Number(amount), targetCurrencyCode as string);


    
    const customer = foundOrderItem.order.billingAddress;
    const fullName = [
        customer?.firstName,
        customer?.middleName,
        customer?.lastName
    ].filter(Boolean).join(' ');

    const orderDetails = {
        customerName: fullName,
        orderId,
        orderDate: foundOrderItem.order.createdAt,
        productName,
        productImageSrc,
        totalAmount: displayAmount,
        quantity: foundOrderItem.quantity
    }
    await sendOrderConfirmationEmail(customerEmail, orderDetails);

    return(
         <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
            <ProgressSteps currentStep={4}/>
            
            <div className="max-w-2xl mx-auto">
                {/* Success Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-foreground mt-12 mb-2">Order Confirmed!</h1>
                    <p className="text-muted-foreground">Thank you for your purchase. Your order is being processed.</p>
                </div>

                {/* Order Details Card */}
                <div className="bg-card border rounded-lg p-6 shadow-sm">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-lg font-semibold text-foreground">Order Details</h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                Order #<span className="font-mono">{orderId}</span>
                            </p>
                        </div>
                        <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                            Paid
                        </span>
                    </div>

                    {/* Product Info */}
                    <div className="flex gap-4 pb-4 border-b">
                        <div className="relative w-20 h-20 rounded-md overflow-hidden shrink-0">
                            <Image
                                src={productImageSrc}
                                alt={productName}
                                fill
                                className="object-cover"
                            />
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-foreground">{productName}</p>
                            <p className="text-sm text-muted-foreground">Qty: {foundOrderItem.quantity}</p>
                        </div>
                        <p className="font-semibold text-foreground">{displayAmount}</p>
                    </div>

                    {/* Price Breakdown */}
                    <div className="space-y-2 py-4 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span className="text-foreground">{displayAmount}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Shipping</span>
                            <span className="text-foreground">Free</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Tax</span>
                            <span className="text-foreground">Included</span>
                        </div>
                    </div>

                    {/* Total */}
                    <div className="border-t pt-4">
                        <div className="flex justify-between items-baseline">
                            <span className="text-lg font-bold text-foreground">Total Paid</span>
                            <span className="text-2xl font-bold text-primary">{displayAmount}</span>
                        </div>
                    </div>
                </div>

                {/* Next Steps */}
                <div className="mt-6 bg-muted/50 rounded-lg p-4">
                    <h3 className="font-semibold text-foreground mb-2">What's Next?</h3>
                    <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• You'll receive an email confirmation shortly for {customerEmail}</li>
                        <li>• We'll notify you when your order ships</li>
                        <li>• Track your order from your account dashboard (TODO?)</li>
                    </ul>
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex gap-3">
                    <Link 
                        href="/orders" 
                        className="flex-1 text-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                    >
                        View Orders (TODO)
                    </Link>
                    <Link
                        href="/watches/all" 
                        className="flex-1 text-center px-4 py-2 border rounded-md hover:bg-muted transition-colors"
                    >
                        Continue Shopping
                    </Link>
                </div>
            </div>
        </div>
    )
}
