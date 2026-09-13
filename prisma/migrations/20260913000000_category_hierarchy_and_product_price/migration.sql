-- Add optional two-level category hierarchy.
ALTER TABLE "Category" ADD COLUMN "parentId" TEXT;

CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "Category"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cache the lowest active variant price for scalable product filtering/sorting.
ALTER TABLE "Product" ADD COLUMN "minPrice" INTEGER;

UPDATE "Product" AS product
SET "minPrice" = (
  SELECT MIN(variant."price")
  FROM "Variant" AS variant
  WHERE variant."productId" = product."id" AND variant."active" = true
);

CREATE INDEX "Product_active_minPrice_idx" ON "Product"("active", "minPrice");

ALTER TABLE "Product" ADD CONSTRAINT "product_min_price_valid"
CHECK ("minPrice" IS NULL OR "minPrice" >= 100);
