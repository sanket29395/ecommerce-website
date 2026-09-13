import { z } from "zod";
import { readBody, json, errorResponse, HttpError } from "@/lib/http";
import { verifyHmac } from "@/lib/crypto";
import { required } from "@/lib/env";
import { applyPayment, paymentSchema, razorpay } from "@/lib/payments";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    const raw = await readBody(req, 262144);
    if (
      !verifyHmac(
        raw,
        req.headers.get("x-razorpay-signature") || "",
        required("RAZORPAY_WEBHOOK_SECRET"),
      )
    )
      throw new HttpError(400, "Invalid webhook signature");
    const event = z
      .object({ event: z.string(), payload: z.unknown() })
      .parse(JSON.parse(raw));
    const eventId = req.headers.get("x-razorpay-event-id");
    if (!eventId || eventId.length > 200)
      throw new HttpError(400, "Missing event ID");
    if (event.event === "payment.captured" || event.event === "order.paid") {
      const payload = z
        .object({ payment: z.object({ entity: paymentSchema }) })
        .parse(event.payload);
      if (payload.payment.entity.status !== "captured")
        throw new HttpError(400, "Expected captured payment");
      await applyPayment(payload.payment.entity, eventId, event.event);
    } else if (event.event === "refund.processed") {
      const payload = z
        .object({
          refund: z.object({ entity: z.object({ payment_id: z.string() }) }),
        })
        .parse(event.payload);
      const p = paymentSchema.parse(
        await razorpay(
          `payments/${encodeURIComponent(payload.refund.entity.payment_id)}`,
        ),
      );
      await applyPayment(p, eventId, event.event);
    }
    return json({ received: true });
  } catch (e) {
    return errorResponse(e);
  }
}
