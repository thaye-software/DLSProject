"use server";

import { z } from "zod";

import {
  getLocalCurrencyString,
  getCurrencyByCode,
} from "@/services/currencyService";
import {
  deleteBillingAddress,
  saveBillingAddress,
} from "@/services/addressService";
import {
  saveCustomerNameAndPhone,
  deleteCustomerNameAndPhone,
  getUserById,
} from "@/services/userService";
import getCountryByName, {
  saveCustomerCountry,
  deleteCustomerCountry,
  getAllCountries,
  Country,
} from "@/services/countryServive";

import { getUserLocation } from "@/lib/utils/server/utils";
import { resend, originEmail } from "@/lib/resend/resend";

import { OrderStatus } from "./type";
import { Product } from "../watches/type";
import { createOrder } from "@/services/orderService";

// import shippingAndBillingForm from "@/components/Orders/Info/ShippingAndBillingForm"
// z.infer<typeof shippingAndBillingForm>

export interface customerBillingDetails {
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  phone: string | null;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  stateProvince: string | null;

  shippingFirstName: string | null;
  shippingMiddleName: string | null;
  shippingLastName: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
  shippingStateProvince: string | null;
  shippingPriceDkk: string;

  saveBillingInfo: string;
  shippingSameAsBilling: string;
  customerId: string;
}

export interface Address {
  userId: string;
  firstName: string;
  middleName: string | null;
  lastName: string | null;
  address1: string;
  city: string;
  zipCode: string;
  country: string;
  stateProvince: string | null;
}

export interface CustomerNameAndPhone {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  phone: string | null;
}

export async function submitOrderDetails(
  formData: customerBillingDetails,
  product: Product,
  country: Country
) {
  const userGeoLocationData = await getUserLocation();
  let currencyCode = userGeoLocationData.currency.toUpperCase();
  currencyCode = currencyCode == "DKK" ? "DKK" : "EUR";
  const localeCurrency = await getCurrencyByCode(currencyCode);

  const billingAddressCountry = await getCountryByName(formData.country);
  // return;
  // let customerCountry;
  // if(!country) {
  //     // customerCountry = await getCountryByCustomerId(formData.customerId);
  // }

  const billingAddress: Address = {
    userId: formData.customerId,
    firstName: formData.firstName,
    middleName: formData.middleName,
    lastName: formData.lastName,
    address1: formData.address,
    city: formData.city,
    zipCode: formData.postalCode,
    country: formData.country,
    stateProvince: formData?.stateProvince,
  };

  let shippingAddress: Address = {
    userId: formData.customerId,
    firstName: formData.shippingFirstName as string,
    middleName: formData.shippingMiddleName as string,
    lastName: formData.shippingLastName as string,
    address1: formData.shippingAddress as string,
    city: formData.shippingCity as string,
    zipCode: formData.shippingPostalCode as string,
    country: formData.shippingCountry as string,
    stateProvince: formData?.shippingStateProvince as string,
  };

  const customerInfo: CustomerNameAndPhone = {
    id: formData.customerId,
    firstName: formData.firstName,
    middleName: formData.middleName || null,
    lastName: formData.lastName,
    phone: formData.phone || null,
  };

  const orderDetails = {
    userId: formData.customerId,
    currencyId: billingAddressCountry?.currencyId || localeCurrency.id,
    status: "PROCESSING",
    shippingPriceDkk: formData.shippingPriceDkk,
    totalPriceDkk: String(product.priceDkk + parseInt(formData.shippingPriceDkk)),


    //todo might just refactor this to use billingaddress
    totalPriceCurrency:
      country === null
        ? String(
            Math.round(product.priceDkk * Number(localeCurrency.exchangeRate))
          ) // In cents
        : String(Math.round(product.priceDkk * country.currency.exchangeRate)), // In cents
    productId: product.id,
  };

  try {
    const isShippingSameAsBilling =
      formData.shippingSameAsBilling.toLocaleLowerCase() == "true"
        ? true
        : false;
    const isSaveBillingAddress =
      formData.saveBillingInfo.toLowerCase() == "true" ? true : false;
    await updateBillingPreferences(
      formData,
      isSaveBillingAddress,
      billingAddress,
      customerInfo
    );

    if (!isShippingSameAsBilling) {
      const createdOrderId = createOrder(
        orderDetails,
        billingAddress,
        shippingAddress
      );
      return createdOrderId;
    }

    // if shipping is same as billing
    shippingAddress = billingAddress;
    const createdOrderId = await createOrder(orderDetails, billingAddress, shippingAddress);
    return createdOrderId;
  } catch (error) {
    throw error;
  }
}

// Convert an amount in EUR cents to DKK cents using the stored EUR exchange rate.
export async function convertEuroToDkk(priceEur: number) {
  try {
    const targetCurrencyCode = "EUR";
    const { exchangeRate } = await getCurrencyByCode(targetCurrencyCode);
    const rate = parseFloat(exchangeRate);
    // convert euro cents to dkk cents: priceEurInCents / rate
    const convertedPriceDkk = Math.round(priceEur / rate);
    return convertedPriceDkk;
  } catch (error) {
    console.error("convertEuroToDkkCents failed", error);
    throw error;
  }
}

// export async function getAllCountriesNameAction(): Promise<string[]> {
//   try {
//     const allCountries = await getAllCountries();

//     const countryNames = allCountries.map((country) => country.name);
//     return countryNames;
//   } catch (error) {
//     throw error;
//   }
// }

export async function sendOrderConfirmationEmail(
  customerEmail: string,
  orderDetails: any
) {
  try {
    await resend.emails.send({
      from: originEmail,
      to: customerEmail, // TODO change this to point to actual email adress for reciving costumer mails.
      subject: `Limited Watches - Order confirmation`,
      html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Confirmation</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 40px 20px;">
              <!-- Main Container -->
              <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Limited Watches</h1>
                  </td>
                </tr>

                <!-- Success Message -->
                <tr>
                  <td style="padding: 40px 30px 20px; text-align: center;">
                    <div style="display: inline-block; width: 64px; height: 64px; background-color: #10b981; border-radius: 50%; margin-bottom: 20px;">
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 6L9 17L4 12" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </div>
                    <h2 style="margin: 0 0 10px; color: #1f2937; font-size: 24px; font-weight: 600;">Order Confirmed!</h2>
                    <p style="margin: 0; color: #6b7280; font-size: 16px;">Thank you for your purchase, ${
                      orderDetails.customerName
                    }.</p>
                  </td>
                </tr>

                <!-- Order Details -->
                <tr>
                  <td style="padding: 0 30px 30px;">
                    <table role="presentation" style="width: 100%; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                      <tr>
                        <td style="padding: 20px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">
                          <p style="margin: 0; color: #6b7280; font-size: 14px;">Order Number</p> 
                          <p style="margin: 5px 0 0; color: #1f2937; font-size: 16px; font-weight: 600; font-family: monospace;">#${
                            orderDetails.orderId
                          }</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 20px; background-color: #f9fafb;">
                          <p style="margin: 0; color: #6b7280; font-size: 14px;">Order Date</p>
                          <p style="margin: 5px 0 0; color: #1f2937; font-size: 16px;">${
                            orderDetails.orderDate
                          }</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Product Details -->
                <tr>
                  <td style="padding: 0 30px 30px;">
                    <h3 style="margin: 0 0 15px; color: #1f2937; font-size: 18px; font-weight: 600;">Order Summary</h3>
                    <table role="presentation" style="width: 100%; border: 1px solid #e5e7eb; border-radius: 8px;">
                      <tr>
                        <td style="padding: 20px;">
                          <table role="presentation" style="width: 100%;">
                            <tr>
                              <td style="width: 80px; vertical-align: top;">
                                <img src="${
                                  orderDetails.productImageSrc
                                }" alt="${
        orderDetails.productName
      }" style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px; display: block;">
                              </td>
                              <td style="padding-left: 15px; vertical-align: top;">
                                <p style="margin: 0 0 5px; color: #1f2937; font-size: 16px; font-weight: 600;">${
                                  orderDetails.productName
                                }</p>
                                <p style="margin: 0; color: #6b7280; font-size: 14px;">Quantity: ${
                                  orderDetails.quantity
                                }</p>
                              </td>
                              <td style="text-align: right; vertical-align: top;">
                                <p style="margin: 0; color: #1f2937; font-size: 18px; font-weight: 600;">${
                                  orderDetails.totalAmount
                                }</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Price Breakdown -->
                <tr>
                  <td style="padding: 0 30px 30px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Subtotal</td>
                        <td style="padding: 8px 0; text-align: right; color: #1f2937; font-size: 14px;">${
                          orderDetails.totalAmount
                        }</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Shipping</td>
                        <td style="padding: 8px 0; text-align: right; color: #10b981; font-size: 14px; font-weight: 600;">Free</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Tax</td>
                        <td style="padding: 8px 0; text-align: right; color: #1f2937; font-size: 14px;">Included</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding: 15px 0 8px; border-top: 2px solid #e5e7eb;"></td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #1f2937; font-size: 18px; font-weight: 600;">Total</td>
                        <td style="padding: 8px 0; text-align: right; color: #667eea; font-size: 20px; font-weight: 700;">${
                          orderDetails.totalAmount
                        }</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Next Steps -->
                <tr>
                  <td style="padding: 0 30px 30px;">
                    <div style="background-color: #f0f9ff; border-left: 4px solid #667eea; border-radius: 4px; padding: 20px;">
                      <h4 style="margin: 0 0 10px; color: #1f2937; font-size: 16px; font-weight: 600;">What's Next?</h4>
                      <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 14px; line-height: 1.6;">
                        <li>We're preparing your order for shipment</li>
                        <li>You'll receive a tracking number once shipped</li>
                        <li>Track your order anytime from your account</li>
                      </ul>
                    </div>
                  </td>
                </tr>

                <!-- CTA Button -->
                <tr>
                  <td style="padding: 0 30px 40px; text-align: center;">
                    <a href="https://limitedwatches.com/orders" style="display: inline-block; padding: 14px 32px; background-color: #667eea; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 6px; transition: background-color 0.3s;">View Order Details</a>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 30px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                    <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px;">Questions? Contact us at <a href="mailto:support@limitedwatches.com" style="color: #667eea; text-decoration: none;">support@limitedwatches.com</a></p>
                    <p style="margin: 0; color: #9ca3af; font-size: 12px;">© ${new Date().getFullYear()} Limited Watches. All rights reserved.</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    });

    return true;
  } catch (error) {
    console.error("Email send failed:", error);
    return false;
  }
}

//---------------------------------------------------- Helper functions ----------------------------------------------------

async function updateBillingPreferences(
  formData: customerBillingDetails,
  isSaveBillingAddress: boolean,
  billingAddress: Address,
  customerInfo: CustomerNameAndPhone
): Promise<void> {
  if (isSaveBillingAddress) {
    await saveBillingAddress(billingAddress);
    await saveCustomerCountry(formData.country, formData.customerId);
    await saveCustomerNameAndPhone(customerInfo);
  } else {
    await deleteBillingAddress(formData.customerId);
    await deleteCustomerCountry(formData.customerId);
    await deleteCustomerNameAndPhone(customerInfo.id);
  }
}
