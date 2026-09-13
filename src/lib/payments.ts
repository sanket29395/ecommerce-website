import { z } from "zod";
import { db } from "./db";
import { required } from "./env";
import { HttpError } from "./http";
import { serial } from "./transaction";
import { totals } from "./money";
import { paidState } from "./payment-state";
const payment = z.object({
  id: z.string(),
  order_id: z.string(),
  amount: z.number().int(),
  currency: z.string(),
  status: z.string(),
  amount_refunded: z.number().int().optional(),
});
export type GatewayPayment = z.infer<typeof payment>;
export async function razorpay(path: string, method = "GET", data?: unknown) {
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${required("RAZORPAY_KEY_ID")}:${required("RAZORPAY_KEY_SECRET")}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new HttpError(
      502,
      "Payment provider unavailable. Retry or contact support with your order ID.",
    );
  return response.json();
}
export async function checkout(
  userId: string,
  addressId: string,
  checkoutKey: string,
  code?: string,
) {
  required("RAZORPAY_KEY_ID");
  required("RAZORPAY_KEY_SECRET");
  const order = await serial(async (tx) => {
    const existing = await tx.order.findUnique({
      where: { userId_checkoutKey: { userId, checkoutKey } },
    });
    if (existing) return existing;
    // One unresolved checkout per customer prevents repeated reservations and coupon consumption.
    if (await tx.order.findFirst({ where: { userId, status: "PENDING" } }))
      throw new HttpError(
        409,
        "You have a pending order. Resume or cancel it from My orders.",
      );
    const shippingAddress = await tx.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!shippingAddress)
      throw new HttpError(400, "Select a saved delivery address");
    const cart = await tx.cartItem.findMany({
      where: { userId },
      include: { variant: { include: { product: true } } },
    });
    if (!cart.length || cart.length > 50)
      throw new HttpError(400, "Cart must contain 1–50 items");
    let subtotal = 0;
    for (const item of cart) {
      const v = item.variant;
      if (!v.active || !v.product.active)
        throw new HttpError(409, `${v.product.name} is unavailable`);
      const result = await tx.variant.updateMany({
        where: { id: v.id, stock: { gte: item.quantity }, active: true },
        data: { stock: { decrement: item.quantity } },
      });
      if (result.count !== 1)
        throw new HttpError(409, `${v.product.name} has insufficient stock`);
      subtotal += v.price * item.quantity;
    }
    if (subtotal > 100000000)
      throw new HttpError(400, "Order exceeds the maximum value");
    let couponId: string | undefined,
      percent = 0;
    if (code) {
      const c = await tx.coupon.findUnique({ where: { code } });
      if (
        !c ||
        !c.active ||
        c.expiresAt <= new Date() ||
        c.used >= c.maxUses ||
        subtotal < c.minSubtotal
      )
        throw new HttpError(
          400,
          "Coupon is invalid, expired, or does not apply",
        );
      await tx.coupon.update({
        where: { id: c.id },
        data: { used: { increment: 1 } },
      });
      couponId = c.id;
      percent = c.percent;
    }
    const amounts = totals(
      subtotal,
      percent,
      Number(process.env.SHIPPING_PAISE || 7900),
      Number(process.env.FREE_SHIPPING_ABOVE_PAISE || 199900),
    );
    const { id: unused, userId: owner, ...snapshot } = shippingAddress;
    return tx.order.create({
      data: {
        userId,
        checkoutKey,
        couponId,
        ...amounts,
        address: snapshot,
        items: {
          create: cart.map(({ variant: v, quantity }) => ({
            variantId: v.id,
            name: `${v.product.name} — ${v.name}`,
            sku: v.sku,
            image: v.product.images[0],
            price: v.price,
            quantity,
          })),
        },
      },
    });
  });
  if (order.status !== "PENDING")
    throw new HttpError(409, "This checkout is already completed or cancelled");
  if (order.razorpayOrderId?.startsWith("creating:"))
    throw new HttpError(
      409,
      "Payment initialization needs administrator reconciliation",
    );
  if (order.razorpayOrderId)
    return {
      id: order.id,
      razorpayOrderId: order.razorpayOrderId,
      total: order.total,
      key: required("RAZORPAY_KEY_ID"),
    };
  // Only the request which claims creation can contact the provider. A crash or ambiguous timeout
  // keeps the reservation pending; never create a second provider order on an uncertain retry.
  const claimed = await db.order.updateMany({
    where: { id: order.id, razorpayOrderId: null, status: "PENDING" },
    data: { razorpayOrderId: `creating:${order.id}` },
  });
  if (!claimed.count)
    throw new HttpError(
      409,
      "Payment setup is in progress. Check My orders shortly.",
    );
  const gateway = await razorpay("orders", "POST", {
    amount: order.total,
    currency: "INR",
    receipt: order.id,
    notes: { localOrderId: order.id },
  });
  const parsed = z
    .object({
      id: z.string().startsWith("order_"),
      amount: z.number(),
      currency: z.literal("INR"),
    })
    .parse(gateway);
  if (parsed.amount !== order.total) throw new Error("Gateway amount mismatch");
  await db.order.update({
    where: { id: order.id },
    data: { razorpayOrderId: parsed.id },
  });
  return {
    id: order.id,
    razorpayOrderId: parsed.id,
    total: order.total,
    key: required("RAZORPAY_KEY_ID"),
  };
}
export async function applyPayment(
  p: GatewayPayment,
  eventId: string,
  eventType: string,
) {
  return serial(async (tx) => {
    if (await tx.webhookEvent.findUnique({ where: { id: eventId } })) return;
    const order = await tx.order.findUnique({
      where: { razorpayOrderId: p.order_id },
      include: { items: true },
    });
    if (!order) throw new HttpError(503, "Order not linked yet; retry webhook");
    if (p.amount !== order.total || p.currency !== order.currency)
      throw new HttpError(400, "Payment amount or currency mismatch");
    if (order.razorpayPaymentId && order.razorpayPaymentId !== p.id)
      throw new HttpError(409, "Payment conflict");
    if (p.status === "captured" || p.status === "refunded") {
      const refunded = p.amount_refunded || 0;
      if (refunded < 0 || refunded > order.total)
        throw new HttpError(400, "Invalid refund amount");
      const status = paidState(
        order.status,
        order.reservationReleased,
        order.total,
        order.refundedAmount,
        refunded,
      );
      await tx.order.update({
        where: { id: order.id },
        data: {
          status,
          razorpayPaymentId: p.id,
          refundedAmount: Math.max(order.refundedAmount, refunded),
        },
      });
      // Cart is kept until the customer explicitly clears it; a webhook must not erase later edits.
    }
    await tx.webhookEvent.create({ data: { id: eventId, event: eventType } });
  });
}
export async function syncOrder(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) throw new HttpError(404, "Order not found");
  if (!order.razorpayOrderId || order.razorpayOrderId.startsWith("creating:"))
    throw new HttpError(
      409,
      "Payment initialization needs administrator reconciliation",
    );
  const result = z
    .object({ items: z.array(payment) })
    .parse(
      await razorpay(
        `orders/${encodeURIComponent(order.razorpayOrderId)}/payments`,
      ),
    );
  for (const p of result.items)
    if (p.status === "captured" || p.status === "refunded")
      await applyPayment(
        p,
        `sync:${p.id}:${p.status}:${p.amount_refunded || 0}`,
        "reconciliation",
      );
  return db.order.findUnique({ where: { id: orderId } });
}
export async function cancelOrder(orderId: string, userId?: string) {
  return serial(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, ...(userId ? { userId } : {}) },
      include: { items: true },
    });
    if (!order) throw new HttpError(404, "Order not found");
    if (order.status !== "PENDING")
      throw new HttpError(409, "Only unpaid pending orders can be cancelled");
    if (!order.reservationReleased) {
      for (const item of order.items)
        await tx.variant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      if (order.couponId)
        await tx.coupon.update({
          where: { id: order.couponId },
          data: { used: { decrement: 1 } },
        });
    }
    return tx.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED", reservationReleased: true },
    });
  });
}
export { payment as paymentSchema };
