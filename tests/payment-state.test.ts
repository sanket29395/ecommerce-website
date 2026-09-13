import test from "node:test";
import assert from "node:assert/strict";
import { paidState } from "../src/lib/payment-state";
import {
  sameOrigin,
  readBody,
  errorResponse,
  HttpError,
} from "../src/lib/http";
test("a captured payment advances only pending orders", () => {
  assert.equal(paidState("PENDING", false, 10000, 0, 0), "PAID");
  assert.equal(paidState("SHIPPED", false, 10000, 0, 0), "SHIPPED");
});
test("a late capture never fulfils released inventory", () => {
  assert.equal(paidState("CANCELLED", true, 10000, 0, 0), "PAYMENT_REVIEW");
});
test("refund state is monotonic under out-of-order capture events", () => {
  assert.equal(paidState("REFUNDED", true, 10000, 10000, 0), "REFUNDED");
  assert.equal(paidState("PAID", false, 10000, 0, 10000), "REFUNDED");
  assert.equal(paidState("SHIPPED", false, 10000, 2000, 1000), "SHIPPED");
});
test("mutations reject missing and foreign Origin", () => {
  process.env.APP_URL = "https://shop.example.com";
  assert.doesNotThrow(() =>
    sameOrigin(
      new Request("https://shop.example.com/api/cart", {
        headers: { origin: "https://shop.example.com" },
      }),
    ),
  );
  assert.throws(
    () =>
      sameOrigin(
        new Request("https://shop.example.com/api/cart", {
          headers: { origin: "https://evil.example" },
        }),
      ),
    HttpError,
  );
  assert.throws(
    () => sameOrigin(new Request("https://shop.example.com/api/cart")),
    HttpError,
  );
});
test("body limit measures received bytes, not Content-Length", async () => {
  await assert.rejects(
    () =>
      readBody(
        new Request("https://shop.example.com", {
          method: "POST",
          body: "123456",
          headers: { "Content-Length": "1" },
        }),
        5,
      ),
    HttpError,
  );
});
test("unexpected errors do not expose internal references or details", async (t) => {
  t.mock.method(console, "error", () => undefined);
  const response = errorResponse(new Error("sensitive database detail"));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: "Something went wrong. Please try again.",
  });
});
