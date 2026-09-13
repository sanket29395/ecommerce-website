import { z } from "zod";
import { db } from "./db";
import { requireAdmin, limit } from "./auth";
import { HttpError, json, body } from "./http";
import {
  product,
  variant,
  category as categoryInput,
  coupon,
  httpsUrl,
} from "./validation";
import { serial } from "./transaction";
import { cancelOrder, syncOrder } from "./payments";
import { uploadProductImages } from "./media";
export async function adminApi(req: Request, parts: string[]) {
  const actor = await requireAdmin();
  const [resource, target, action] = parts;
  const method = req.method;
  if (method !== "GET") await limit(`admin:${actor.id}`, 120, 60);
  const url = new URL(req.url);
  const page = Math.max(
    1,
    Math.min(10000, Number(url.searchParams.get("page")) || 1),
  );
  const skip = (page - 1) * 30;
  if (method === "GET") {
    if (resource === "dashboard")
      return json(
        await db.$transaction(async (tx) => ({
          orders: await tx.order.count(),
          products: await tx.product.count(),
          customers: await tx.user.count({ where: { role: "CUSTOMER" } }),
          revenue:
            (
              await tx.order.aggregate({
                where: {
                  status: {
                    in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"],
                  },
                },
                _sum: { total: true },
              })
            )._sum.total || 0,
          lowStock: await tx.variant.findMany({
            where: { active: true, stock: { lte: 5 } },
            include: { product: { select: { name: true } } },
            take: 15,
          }),
          review: await tx.order.count({ where: { status: "PAYMENT_REVIEW" } }),
        })),
      );
    if (resource === "products")
      return json(
        await db.product.findMany({
          include: {
            category: { include: { parent: true } },
            variants: true,
          },
          orderBy: { createdAt: "desc" },
          take: 30,
          skip,
        }),
      );
    if (resource === "categories")
      return json(
        await db.category.findMany({
          include: {
            parent: true,
            _count: { select: { children: true, products: true } },
          },
          orderBy: { name: "asc" },
        }),
      );
    if (resource === "coupons")
      return json(
        await db.coupon.findMany({
          orderBy: { expiresAt: "desc" },
          take: 30,
          skip,
        }),
      );
    if (resource === "orders")
      return json(
        await db.order.findMany({
          include: {
            items: true,
            user: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 30,
          skip,
        }),
      );
    if (resource === "customers")
      return json(
        await db.user.findMany({
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            _count: { select: { orders: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 30,
          skip,
        }),
      );
    if (resource === "audit")
      return json(
        await db.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 30,
          skip,
        }),
      );
  }
  if (
    method === "POST" &&
    resource === "orders" &&
    target &&
    ["sync", "cancel"].includes(action)
  ) {
    const result =
      action === "sync" ? await syncOrder(target) : await cancelOrder(target);
    await db.auditLog.create({
      data: { actorId: actor.id, action: `order.${action}`, targetId: target },
    });
    return json(result);
  }
  if (resource === "media" && method === "POST" && !target) {
    const images = await uploadProductImages(req);
    await db.auditLog.create({
      data: {
        actorId: actor.id,
        action: "media.upload",
        targetId: `${images.length} image${images.length === 1 ? "" : "s"}`,
      },
    });
    return json({ images }, 201);
  }
  const input = await body(req);
  return json(
    await serial(async (tx) => {
      let result: unknown;
      let targetId = target || "new";
      if (resource === "products" && ["POST", "PATCH"].includes(method)) {
        const data = product.parse(input);
        result = target
          ? await tx.product.update({ where: { id: target }, data })
          : await tx.product.create({ data });
      } else if (
        resource === "variants" &&
        ["POST", "PATCH"].includes(method)
      ) {
        const data = variant.parse(input);
        if (target) {
          const existing = await tx.variant.findUnique({
            where: { id: target },
          });
          if (!existing || existing.productId !== data.productId)
            throw new HttpError(400, "Cannot reassign a variant");
        }
        if (target) {
          const { expectedStock } = z
            .object({ expectedStock: z.number().int().min(0) })
            .parse(input);
          const updated = await tx.variant.updateMany({
            where: { id: target, stock: expectedStock },
            data,
          });
          if (!updated.count)
            throw new HttpError(
              409,
              "Stock changed since you opened this form. Refresh and try again.",
            );
          result = await tx.variant.findUniqueOrThrow({
            where: { id: target },
          });
        } else result = await tx.variant.create({ data });
        const minimum = await tx.variant.aggregate({
          where: { productId: data.productId, active: true },
          _min: { price: true },
        });
        await tx.product.update({
          where: { id: data.productId },
          data: { minPrice: minimum._min.price },
        });
      } else if (
        resource === "categories" &&
        ["POST", "PATCH"].includes(method)
      ) {
        const data = categoryInput.parse(input);
        if (target && data.parentId === target)
          throw new HttpError(400, "A category cannot contain itself");
        if (data.parentId) {
          const parent = await tx.category.findUnique({
            where: { id: data.parentId },
          });
          if (!parent) throw new HttpError(400, "Parent category not found");
          if (parent.parentId)
            throw new HttpError(
              400,
              "Subcategories cannot contain another subcategory",
            );
          if (
            target &&
            (await tx.category.count({ where: { parentId: target } })) > 0
          )
            throw new HttpError(
              400,
              "A category with subcategories cannot become a subcategory",
            );
        }
        result = target
          ? await tx.category.update({ where: { id: target }, data })
          : await tx.category.create({ data });
      } else if (resource === "coupons" && ["POST", "PATCH"].includes(method)) {
        const data = coupon.parse(input);
        result = target
          ? await tx.coupon.update({ where: { id: target }, data })
          : await tx.coupon.create({ data });
      } else if (resource === "orders" && target && method === "PATCH") {
        const data = z
          .object({
            status: z.enum(["PROCESSING", "SHIPPED", "DELIVERED"]),
            carrier: z.string().max(100).optional(),
            trackingUrl: httpsUrl.optional(),
          })
          .parse(input);
        const order = await tx.order.findUnique({ where: { id: target } });
        if (!order) throw new HttpError(404, "Order not found");
        const transitions: Record<string, string> = {
          PAID: "PROCESSING",
          PROCESSING: "SHIPPED",
          SHIPPED: "DELIVERED",
        };
        if (transitions[order.status] !== data.status)
          throw new HttpError(409, "Invalid order status transition");
        if (data.status === "SHIPPED" && (!data.carrier || !data.trackingUrl))
          throw new HttpError(400, "Carrier and tracking URL required");
        result = await tx.order.update({ where: { id: target }, data });
      } else throw new HttpError(404, "Unknown admin operation");
      if (result && typeof result === "object" && "id" in result)
        targetId = String(result.id);
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: `${resource}.${method.toLowerCase()}`,
          targetId,
        },
      });
      return result;
    }),
  );
}
