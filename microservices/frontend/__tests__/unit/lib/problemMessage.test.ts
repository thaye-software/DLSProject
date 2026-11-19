/** @jest-environment node */
import { redirect } from "next/navigation";
import { GatewayError } from "@/lib/gateway";
import { problemMessage } from "@/lib/problemMessage";

jest.mock("server-only", () => ({}));

test("rethrows a redirect error", () => {
  let err: unknown;
  try {
    redirect("/login");
  } catch (e) {
    err = e;
  }
  expect(() => problemMessage(err, "generic", "label")).toThrow(err as Error);
});

test("formats GatewayError problems", () => {
  const e = new GatewayError(409, { type: "x", title: "Conflict", status: 409, detail: "Unavailable" });
  expect(problemMessage(e, "generic", "label")).toBe("Conflict: Unavailable");
});

test("falls back to the generic message for other errors", () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  expect(problemMessage(new Error("boom"), "generic", "label")).toBe("generic");
});
