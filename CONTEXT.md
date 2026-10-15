# Limited Watches

An online shop for limited and pre-owned watches, being migrated from a monolith to microservices. All prices are in Danish kroner (DKK).

## Services

**Payment**:
The service that takes a customer's money for an order and gives it back on a refund. Stripe is its record of payments.
_Avoid_: Payments service, Stripe service

**Notif**:
The service that sends the shop's emails: the order confirmation and the contact message.
_Avoid_: Email service, Emails, Notifications

## Checkout

**Reserved order**:
An order whose watches are held for the customer for 30 minutes while they pay.
_Avoid_: Pending order, cart

**Payment session**:
One attempt to pay a reserved order, backed by a single Stripe PaymentIntent per order.
_Avoid_: Checkout session, charge

**Refund request**:
Orders asking Payment to give back money already taken, e.g. for a payment that arrived after the order expired.
_Avoid_: Chargeback, reversal

## Emails

**Order confirmation**:
The email a customer receives once their payment has gone through and the order is confirmed.
_Avoid_: Receipt, invoice

**Contact message**:
A message someone writes through the shop's contact form. It is emailed to the address the sender entered.
_Avoid_: Support ticket, enquiry
