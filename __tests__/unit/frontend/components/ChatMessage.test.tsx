import React from "react";
import { render, screen } from "@testing-library/react";
import { ChatMessageItem } from "@/components/Chat/ChatMessage";

const sampleMessage = {
  id: "1",
  conversationId: "c1",
  senderId: "u1",
  sender: {
    id: "u1",
    username: "Seller",
    email: "",
    country: "",
    role: "seller",
  },
  senderType: "seller",
  content:
    "Please checkout here: /orders/checkout/infomation?product=test-product",
  createdAt: new Date().toISOString(),
};

test("renders clickable link from message content", () => {
  render(
    <ChatMessageItem
      message={sampleMessage as any}
      isOwnMessage={false}
      showHeader={true}
    />
  );

  // Link text should be present
  expect(
    screen.getByText("/orders/checkout/infomation?product=test-product")
  ).toBeInTheDocument();

  // It should be a link with correct href
  const link = screen.getByRole("link", {
    name: /orders\/checkout\/infomation\?product=test-product/i,
  });
  expect(link).toHaveAttribute(
    "href",
    "/orders/checkout/infomation?product=test-product"
  );
});
