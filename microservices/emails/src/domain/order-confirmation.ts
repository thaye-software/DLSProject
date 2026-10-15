import type { Email } from "./email.js";
import { escapeHtml } from "./html.js";
import { formatMoney, type Money } from "./money.js";

export type OrderConfirmation = {
  order_id: string;
  customer_email: string;
  items: Array<{
    product_name: string;
    quantity: number;
    thumbnail_url: string | null;
  }>;
  totals: {
    subtotal: Money;
    shipping: Money;
    total: Money;
  };
  billing_address: {
    first_name: string;
    middle_name: string | null;
    last_name: string;
  };
  confirmed_at: string;
};

const SHOP_TIME_ZONE = "Europe/Copenhagen";
const ORDERS_PAGE_URL = "https://watches.thaulow.tech/orders";
const SUPPORT_EMAIL = "support@finitewatches.com";

const orderDateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: SHOP_TIME_ZONE });
const yearFormat = new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: SHOP_TIME_ZONE });

export function renderOrderConfirmation(order: OrderConfirmation): Email {
  const [item] = order.items;
  if (!item) throw new Error(`Order ${order.order_id} has no items`);

  const { first_name, middle_name, last_name } = order.billing_address;
  const customerName = escapeHtml([first_name, middle_name, last_name].filter(Boolean).join(" "));
  const orderId = escapeHtml(order.order_id);
  const confirmedAt = new Date(order.confirmed_at);
  const orderDate = orderDateFormat.format(confirmedAt);
  const productName = escapeHtml(item.product_name);
  const productImage = item.thumbnail_url
    ? `<img src="${escapeHtml(item.thumbnail_url)}" alt="${productName}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px; display: block;">`
    : "";
  const subtotal = escapeHtml(formatMoney(order.totals.subtotal));
  const shipping = escapeHtml(formatMoney(order.totals.shipping));
  const total = escapeHtml(formatMoney(order.totals.total));

  return {
    to: order.customer_email,
    subject: "Finite Watches - Order confirmation",
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
              <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background-color: #000; color: #fff; text-align: center; padding: 24px 0; font-size: 24px; letter-spacing: 1px;">
                    Finite Watches
                  </td>
                </tr>

                <tr>
                  <td style="padding: 40px 30px 20px; text-align: center;">
                    <h2 style="margin: 0 0 10px; color: #1f2937; font-size: 24px; font-weight: 600;">Order Confirmed!</h2>
                    <p style="margin: 0; color: #6b7280; font-size: 16px;">Thank you for your purchase, ${customerName}.</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 0 30px 30px;">
                    <table role="presentation" style="width: 100%; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                      <tr>
                        <td style="padding: 20px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">
                          <p style="margin: 0; color: #6b7280; font-size: 14px;">Order Number</p>
                          <p style="margin: 5px 0 0; color: #1f2937; font-size: 16px; font-weight: 600; font-family: monospace;">#${orderId}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 20px; background-color: #f9fafb;">
                          <p style="margin: 0; color: #6b7280; font-size: 14px;">Order Date</p>
                          <p style="margin: 5px 0 0; color: #1f2937; font-size: 16px;">${orderDate}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 0 30px 30px;">
                    <h3 style="margin: 0 0 15px; color: #1f2937; font-size: 18px; font-weight: 600;">Order Summary</h3>
                    <table role="presentation" style="width: 100%; border: 1px solid #e5e7eb; border-radius: 8px;">
                      <tr>
                        <td style="padding: 20px;">
                          <table role="presentation" style="width: 100%;">
                            <tr>
                              <td style="width: 80px; vertical-align: top;">
                                ${productImage}
                              </td>
                              <td style="padding-left: 15px; vertical-align: top;">
                                <p style="margin: 0 0 5px; color: #1f2937; font-size: 16px; font-weight: 600;">${productName}</p>
                                <p style="margin: 0; color: #6b7280; font-size: 14px;">Quantity: ${item.quantity}</p>
                              </td>
                              <td style="text-align: right; vertical-align: top;">
                                <p style="margin: 0; color: #1f2937; font-size: 18px; font-weight: 600;">${total}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 0 30px 30px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Subtotal</td>
                        <td style="padding: 8px 0; text-align: right; color: #1f2937; font-size: 14px;">${subtotal}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Shipping</td>
                        <td style="padding: 8px 0; text-align: right; color: #6b7280; font-size: 14px; font-weight: 600;">${shipping}</td>
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
                        <td style="padding: 8px 0; text-align: right; color: #1f2937; font-size: 20px; font-weight: 700;">${total}</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 0 30px 30px;">
                    <div style="background-color: #f0f0f0; border-radius: 4px; padding: 20px;">
                      <h4 style="margin: 0 0 10px; color: #000; font-size: 16px; font-weight: 600;">What's Next?</h4>
                      <ul style="margin: 0; padding-left: 20px; color: #333; font-size: 14px; line-height: 1.6;">
                        <li>We're preparing your order for shipment</li>
                        <li>You'll receive a tracking number once shipped</li>
                        <li>Track your order anytime from your account</li>
                      </ul>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 0 30px 40px; text-align: center;">
                    <a href="${ORDERS_PAGE_URL}" style="display: inline-block; padding: 14px 32px; background-color: #000; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 6px;">View Order Details</a>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 30px; background-color: #fafafa; text-align: center;">
                    <p style="margin: 0 0 10px; color: #999; font-size: 14px;">
                      Questions? Contact us at
                      <a href="mailto:${SUPPORT_EMAIL}" style="color: #666; text-decoration: none;">
                        ${SUPPORT_EMAIL}
                      </a>
                    </p>

                    <p style="margin: 0; color: #999; font-size: 12px;">
                      © ${yearFormat.format(confirmedAt)} Finite Watches. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  };
}
