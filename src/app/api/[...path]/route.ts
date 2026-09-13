import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  currentUser,
  requireUser,
  newSession,
  logout,
  limit,
  clientIp,
  digest,
} from "@/lib/auth";
import { hashPassword, verifyPassword, token } from "@/lib/crypto";
import { json, errorResponse, HttpError, sameOrigin, body } from "@/lib/http";
import { email, password, address, id } from "@/lib/validation";
import { sendMail } from "@/lib/mail";
import { appUrl } from "@/lib/env";
import { checkout, cancelOrder, syncOrder } from "@/lib/payments";
import { adminApi } from "@/lib/admin";
import { serial } from "@/lib/transaction";
import { mediaResponse } from "@/lib/media";
import { parseCatalogQuery } from "@/lib/catalog-query";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handler(
  req: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await context.params;
    const route = path.join("/");
    const method = req.method;
    if (method !== "GET") sameOrigin(req);
    if (path[0] === "media" && path[1] && path.length === 2 && method === "GET")
      return await mediaResponse(req, path[1]);
    if (path[0] === "admin") return await adminApi(req, path.slice(1));
    if (route === "auth/me" && method === "GET")
      return json(await currentUser());
    if (route === "auth/logout" && method === "POST") {
      await logout();
      return json({ ok: true });
    }
    if (path[0] === "auth" && method === "POST") {
      await limit(`auth-ip:${clientIp(req)}`, 60, 900);
      const input = await body(req);
      if (route === "auth/register") {
        const data = z
          .object({ email, password, name: z.string().trim().min(2).max(100) })
          .parse(input);
        await limit(`register:${data.email}`, 3, 3600);
        const user = await db.user.create({
          data: {
            name: data.name,
            email: data.email,
            passwordHash: await hashPassword(data.password),
          },
        });
        await newSession(user.id);
        return json({ ok: true }, 201);
      }
      if (route === "auth/login") {
        const data = z
          .object({ email, password: z.string().min(1).max(128) })
          .parse(input);
        await limit(`login:${data.email}`, 10, 900);
        const user = await db.user.findUnique({ where: { email: data.email } });
        const dummy =
          "scrypt:0123456789abcdef0123456789abcdef:" + "00".repeat(64);
        const valid = await verifyPassword(
          data.password,
          user?.passwordHash || dummy,
        );
        if (!user || !valid)
          throw new HttpError(401, "Incorrect email or password");
        await newSession(user.id);
        return json({ ok: true });
      }
      if (route === "auth/forgot") {
        const data = z.object({ email }).parse(input);
        await limit(`forgot:${data.email}`, 3, 3600);
        const user = await db.user.findUnique({ where: { email: data.email } });
        if (user) {
          const raw = token();
          await db.passwordToken.create({
            data: {
              id: digest(raw),
              userId: user.id,
              expiresAt: new Date(Date.now() + 1800000),
            },
          });
          try {
            await sendMail(
              user.email,
              "Reset your password",
              `Reset your password within 30 minutes: ${appUrl()}/reset-password?token=${raw}\nIf you did not request this, ignore this message.`,
            );
          } catch {
            console.error("Password reset email delivery failed");
          }
        }
        return json({
          message: "If an account exists, a reset link will be sent.",
        });
      }
      if (route === "auth/reset") {
        const data = z
          .object({ token: z.string().regex(/^[a-f0-9]{64}$/), password })
          .parse(input);
        const passwordHash = await hashPassword(data.password);
        await serial(async (tx) => {
          const t = await tx.passwordToken.findUnique({
            where: { id: digest(data.token) },
          });
          if (!t || t.expiresAt < new Date())
            throw new HttpError(400, "Reset link is invalid or expired");
          await tx.user.update({
            where: { id: t.userId },
            data: { passwordHash },
          });
          await tx.passwordToken.deleteMany({ where: { userId: t.userId } });
          await tx.session.deleteMany({ where: { userId: t.userId } });
        });
        return json({ ok: true });
      }
    }
    if (route === "products" && method === "GET") {
      const url = new URL(req.url);
      const query = parseCatalogQuery(url.searchParams);
      const allCategories = await db.category.findMany({
        select: { id: true, name: true, slug: true, parentId: true },
        orderBy: { name: "asc" },
      });
      const selectedCategory = query.category
        ? allCategories.find((item) => item.slug === query.category)
        : undefined;
      const categoryIds = selectedCategory
        ? selectedCategory.parentId
          ? [selectedCategory.id]
          : [
              selectedCategory.id,
              ...allCategories
                .filter((item) => item.parentId === selectedCategory.id)
                .map((item) => item.id),
            ]
        : query.category
          ? []
          : undefined;
      const filters: Prisma.ProductWhereInput[] = [];
      if (query.q)
        filters.push({
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { description: { contains: query.q, mode: "insensitive" } },
            {
              variants: {
                some: {
                  active: true,
                  OR: [
                    { name: { contains: query.q, mode: "insensitive" } },
                    { sku: { contains: query.q, mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        });
      if (categoryIds) filters.push({ categoryId: { in: categoryIds } });
      if (query.minPrice !== undefined || query.maxPrice !== undefined)
        filters.push({
          minPrice: {
            ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
            ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
          },
        });
      if (query.availability === "in-stock")
        filters.push({
          variants: { some: { active: true, stock: { gt: 0 } } },
        });
      if (query.availability === "out-of-stock")
        filters.push({
          variants: { none: { active: true, stock: { gt: 0 } } },
        });
      if (query.featured) filters.push({ featured: true });
      const where: Prisma.ProductWhereInput = {
        active: true,
        ...(filters.length ? { AND: filters } : {}),
      };
      const orderBy: Prisma.ProductOrderByWithRelationInput[] =
        query.sort === "price-asc"
          ? [
              { minPrice: { sort: "asc", nulls: "last" } },
              { createdAt: "desc" },
            ]
          : query.sort === "price-desc"
            ? [
                { minPrice: { sort: "desc", nulls: "last" } },
                { createdAt: "desc" },
              ]
            : query.sort === "name-asc"
              ? [{ name: "asc" }, { createdAt: "desc" }]
              : query.sort === "name-desc"
                ? [{ name: "desc" }, { createdAt: "desc" }]
                : [{ createdAt: "desc" }];
      const categoryTree = allCategories
        .filter((item) => !item.parentId)
        .map((parent) => ({
          ...parent,
          children: allCategories.filter((item) => item.parentId === parent.id),
        }));
      const [products, total] = await Promise.all([
        db.product.findMany({
          where,
          include: {
            category: { include: { parent: true } },
            variants: { where: { active: true }, orderBy: { price: "asc" } },
          },
          orderBy,
          take: 24,
          skip: (query.page - 1) * 24,
        }),
        db.product.count({ where }),
      ]);
      return json({
        products,
        total,
        categories: categoryTree,
        page: query.page,
      });
    }
    if (path[0] === "products" && path[1] && method === "GET") {
      const p = await db.product.findFirst({
        where: { slug: path[1], active: true },
        include: {
          category: { include: { parent: true } },
          variants: { where: { active: true }, orderBy: { price: "asc" } },
        },
      });
      if (!p) throw new HttpError(404, "Product not found");
      return json(p);
    }
    const user = await requireUser();
    if (method !== "GET") await limit(`write:${user.id}`, 120, 60);
    if (route === "cart") {
      if (method === "GET")
        return json(
          await db.cartItem.findMany({
            where: { userId: user.id },
            include: { variant: { include: { product: true } } },
            orderBy: { id: "asc" },
          }),
        );
      if (method === "DELETE") {
        await db.cartItem.deleteMany({ where: { userId: user.id } });
        return json({ ok: true });
      }
      if (method === "POST") {
        const data = z
          .object({ variantId: id, quantity: z.number().int().min(0).max(20) })
          .parse(await body(req));
        if (!data.quantity) {
          await db.cartItem.deleteMany({
            where: { userId: user.id, variantId: data.variantId },
          });
          return json({ ok: true });
        }
        const v = await db.variant.findFirst({
          where: {
            id: data.variantId,
            active: true,
            product: { active: true },
          },
        });
        if (!v || v.stock < data.quantity)
          throw new HttpError(409, "Requested quantity is unavailable");
        await db.cartItem.upsert({
          where: {
            userId_variantId: { userId: user.id, variantId: data.variantId },
          },
          create: { userId: user.id, ...data },
          update: { quantity: data.quantity },
        });
        return json({ ok: true });
      }
    }
    if (route === "addresses") {
      if (method === "GET")
        return json(await db.address.findMany({ where: { userId: user.id } }));
      if (method === "POST") {
        if ((await db.address.count({ where: { userId: user.id } })) >= 20)
          throw new HttpError(400, "Maximum 20 addresses");
        return json(
          await db.address.create({
            data: { userId: user.id, ...address.parse(await body(req)) },
          }),
          201,
        );
      }
    }
    if (path[0] === "addresses" && path[1]) {
      if (method === "DELETE") {
        await db.address.deleteMany({
          where: { id: path[1], userId: user.id },
        });
        return json({ ok: true });
      }
      if (method === "PATCH") {
        const result = await db.address.updateMany({
          where: { id: path[1], userId: user.id },
          data: address.parse(await body(req)),
        });
        if (!result.count) throw new HttpError(404, "Address not found");
        return json({ ok: true });
      }
    }
    if (route === "wishlist") {
      if (method === "GET")
        return json(
          await db.wishlistItem.findMany({
            where: { userId: user.id, product: { active: true } },
            include: {
              product: {
                include: {
                  category: { include: { parent: true } },
                  variants: { where: { active: true } },
                },
              },
            },
            take: 200,
          }),
        );
      const { productId } = z.object({ productId: id }).parse(await body(req));
      if (method === "POST") {
        if (
          !(await db.product.findFirst({
            where: { id: productId, active: true },
          }))
        )
          throw new HttpError(404, "Product unavailable");
        await db.wishlistItem.upsert({
          where: { userId_productId: { userId: user.id, productId } },
          create: { userId: user.id, productId },
          update: {},
        });
        return json({ ok: true });
      }
      if (method === "DELETE") {
        await db.wishlistItem.deleteMany({
          where: { userId: user.id, productId },
        });
        return json({ ok: true });
      }
    }
    if (route === "checkout" && method === "POST") {
      await limit(`checkout:${user.id}`, 10, 3600);
      const data = z
        .object({
          addressId: id,
          checkoutKey: z.string().uuid(),
          coupon: z.string().trim().toUpperCase().max(30).optional(),
        })
        .parse(await body(req));
      return json(
        await checkout(
          user.id,
          data.addressId,
          data.checkoutKey,
          data.coupon || undefined,
        ),
      );
    }
    if (route === "orders" && method === "GET") {
      const page = z.coerce
        .number()
        .int()
        .min(1)
        .max(10000)
        .catch(1)
        .parse(new URL(req.url).searchParams.get("page") || 1);
      return json(
        await db.order.findMany({
          where: { userId: user.id },
          include: { items: true },
          orderBy: { createdAt: "desc" },
          take: 20,
          skip: (page - 1) * 20,
        }),
      );
    }
    if (path[0] === "orders" && path[1]) {
      const order = await db.order.findFirst({
        where: { id: path[1], userId: user.id },
        include: { items: true },
      });
      if (!order) throw new HttpError(404, "Order not found");
      if (method === "GET") return json(order);
      if (method === "POST" && path[2] === "cancel")
        return json(await cancelOrder(order.id, user.id));
      if (method === "POST" && path[2] === "sync")
        return json(await syncOrder(order.id));
      if (method === "POST" && path[2] === "pay") {
        if (
          order.status !== "PENDING" ||
          !order.razorpayOrderId ||
          order.razorpayOrderId.startsWith("creating:")
        )
          throw new HttpError(409, "Order cannot be paid; contact support");
        return json({
          id: order.id,
          razorpayOrderId: order.razorpayOrderId,
          total: order.total,
          key: process.env.RAZORPAY_KEY_ID,
        });
      }
    }
    throw new HttpError(404, "Not found");
  } catch (error) {
    return errorResponse(error);
  }
}
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
