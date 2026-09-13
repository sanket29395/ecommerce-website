import { z } from "zod";

export const catalogSorts = [
  "newest",
  "price-asc",
  "price-desc",
  "name-asc",
  "name-desc",
] as const;

const optionalPrice = z.preprocess(
  (value) =>
    value === null || value === undefined || value === "" ? undefined : value,
  z.coerce.number().finite().min(0).max(1_000_000).optional(),
);

export const catalogQuery = z
  .object({
    q: z.string().trim().max(100).default(""),
    category: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(100)
      .optional(),
    min: optionalPrice,
    max: optionalPrice,
    availability: z.enum(["all", "in-stock", "out-of-stock"]).catch("all"),
    featured: z.enum(["true", "false"]).catch("false"),
    sort: z.enum(catalogSorts).catch("newest"),
    page: z.coerce.number().int().min(1).max(10000).catch(1),
  })
  .superRefine(({ min, max }, context) => {
    if (min !== undefined && max !== undefined && min > max)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["max"],
        message: "Maximum price must be at least the minimum price",
      });
  })
  .transform(({ min, max, featured, ...query }) => ({
    ...query,
    minPrice: min === undefined ? undefined : Math.round(min * 100),
    maxPrice: max === undefined ? undefined : Math.round(max * 100),
    featured: featured === "true",
  }));

export function parseCatalogQuery(searchParams: URLSearchParams) {
  const value = Object.fromEntries(searchParams);
  return catalogQuery.parse(value);
}
