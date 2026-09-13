import type { OrderStatus } from "@prisma/client";
export function paidState(
  previous: OrderStatus,
  released: boolean,
  total: number,
  previousRefund: number,
  incomingRefund: number,
): OrderStatus {
  const refunded = Math.max(previousRefund, incomingRefund);
  if (refunded === total) return "REFUNDED";
  if (released) return "PAYMENT_REVIEW";
  return previous === "PENDING" ? "PAID" : previous;
}
