import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { OfferPriceConfirmDialog } from "@/components/Chat/OfferPriceConfirmDialog";

test("calls sendMessage with checkout link when confirmed", async () => {
  const sendMessageMock = jest.fn().mockResolvedValue(undefined);
  const product = { watch: { slug: "test-product" }, priceDkk: 100000 };

  render(
    <OfferPriceConfirmDialog
      product={product}
      newPrice={1234.56}
      currency="DKK"
      basePriceInCurrency={1500}
      sendMessage={sendMessageMock}
    />
  );

  // Click trigger (button with icon inside)
  const triggerButtons = screen.getAllByRole("button");
  expect(triggerButtons.length).toBeGreaterThan(0);
  fireEvent.click(triggerButtons[0]);

  // Confirm text should be visible
  expect(await screen.findByText(/Offer new price\?/i)).toBeInTheDocument();

  // Click Continue to send
  const continueBtn = screen.getByText(/Continue/i);
  fireEvent.click(continueBtn);

  // sendMessage should be called with a string containing the checkout path
  expect(sendMessageMock).toHaveBeenCalled();
  const arg = sendMessageMock.mock.calls[0][0];
  expect(typeof arg).toBe("string");
  expect(arg).toContain("/orders/checkout/infomation?product=test-product");
});
