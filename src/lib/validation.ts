import { z } from "zod";
export const email = z.string().trim().toLowerCase().email().max(254);
export const password = z.string().min(12).max(128);
export const id = z.string().min(1).max(100);
export const httpsUrl = z
  .string()
  .url()
  .max(2000)
  .refine((s) => {
    try {
      return new URL(s).protocol === "https:";
    } catch {
      return false;
    }
  }, "HTTPS URL required");
const managedImageUrl = /^\/api\/media\/[a-f0-9]{64}\.(?:gif|jpg|png|webp)$/;
export const productImage = z
  .string()
  .max(2000)
  .refine(
    (value) => managedImageUrl.test(value) || httpsUrl.safeParse(value).success,
    "Uploaded image or HTTPS URL required",
  );
export const address = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  line1: z.string().trim().min(5).max(200),
  line2: z.string().trim().max(200).default(""),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  pincode: z.string().regex(/^[1-9]\d{5}$/),
  country: z.literal("IN").default("IN"),
});
export const product = z.object({
  name: z.string().trim().min(2).max(150),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(150),
  description: z.string().trim().min(10).max(10000),
  images: z
    .array(productImage)
    .max(8)
    .refine((images) => new Set(images).size === images.length, {
      message: "Images must be unique",
    }),
  categoryId: id,
  active: z.boolean(),
  featured: z.boolean(),
});
export const category = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(100),
  parentId: id.nullable(),
});
export const variant = z.object({
  productId: id,
  sku: z.string().trim().min(2).max(80),
  name: z.string().trim().min(1).max(100),
  price: z.number().int().min(100).max(100000000),
  stock: z.number().int().min(0).max(1000000),
  active: z.boolean(),
});
export const coupon = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,30}$/),
  percent: z.number().int().min(1).max(90),
  minSubtotal: z.number().int().min(0).max(100000000),
  maxUses: z.number().int().min(1).max(1000000),
  active: z.boolean(),
  expiresAt: z.coerce.date(),
});
