import { db } from "../src/lib/db";
import { syncOrder, razorpay } from "../src/lib/payments";
import { z } from "zod";
async function main() {
  // Optional exact provider order ID resolves an interrupted order-creation response.
  const [localId, providerId] = process.argv.slice(2);
  if (localId && providerId) {
    const local = await db.order.findUniqueOrThrow({ where: { id: localId } });
    if (local.razorpayOrderId !== `creating:${localId}`)
      throw new Error("Order is not awaiting gateway linking");
    const gateway = z
      .object({
        id: z.string(),
        receipt: z.string(),
        amount: z.number(),
        currency: z.string(),
      })
      .parse(await razorpay(`orders/${encodeURIComponent(providerId)}`));
    if (
      gateway.receipt !== local.id ||
      gateway.amount !== local.total ||
      gateway.currency !== local.currency ||
      gateway.id !== providerId
    )
      throw new Error("Gateway order does not match");
    await db.order.update({
      where: { id: local.id },
      data: { razorpayOrderId: providerId },
    });
    await syncOrder(local.id);
    console.log("Order linked and reconciled");
    return;
  }
  let cursor: string | undefined;
  let failures = 0;
  do {
    const orders = await db.order.findMany({
      where: { razorpayOrderId: { not: null }, status: { not: "REFUNDED" } },
      orderBy: { id: "asc" },
      take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!orders.length) break;
    for (const order of orders) {
      if (order.razorpayOrderId?.startsWith("creating:")) {
        console.warn("Manual link needed", order.id);
        continue;
      }
      try {
        await syncOrder(order.id);
      } catch {
        failures++;
        console.error("Reconciliation failed", order.id);
      }
    }
    cursor = orders.at(-1)!.id;
  } while (cursor);
  if (failures) process.exitCode = 1;
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
