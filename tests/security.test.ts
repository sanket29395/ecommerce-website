import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { hashPassword, verifyPassword, verifyHmac } from "../src/lib/crypto";
import { totals } from "../src/lib/money";
import { address, category, product, variant } from "../src/lib/validation";
import { detectImageType } from "../src/lib/image-signature";
import { parseCatalogQuery } from "../src/lib/catalog-query";
test("passwords use random salts and reject wrong credentials", async () => {
  const a = await hashPassword("a-long-password-123");
  const b = await hashPassword("a-long-password-123");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("a-long-password-123", a), true);
  assert.equal(await verifyPassword("incorrect", a), false);
});
test("webhook signatures authenticate exact raw bytes", () => {
  const body = '{"a":1}';
  const sig = createHmac("sha256", "secret").update(body).digest("hex");
  assert.equal(verifyHmac(body, sig, "secret"), true);
  assert.equal(verifyHmac('{"a": 1}', sig, "secret"), false);
  assert.equal(verifyHmac(body, sig, "other"), false);
  assert.equal(verifyHmac(body, "xyz", "secret"), false);
});
test("totals use integer paise and deterministic rounding", () => {
  assert.deepEqual(totals(10001, 15), {
    subtotal: 10001,
    discount: 1500,
    shipping: 7900,
    total: 16401,
  });
  assert.equal(totals(200000).shipping, 0);
  assert.throws(() => totals(-1));
});
test("reject unsafe product URLs and invalid stock", () => {
  assert.equal(
    product.safeParse({
      name: "Test",
      slug: "test",
      description: "A description",
      categoryId: "c",
      images: ["javascript:alert(1)"],
      active: true,
      featured: false,
    }).success,
    false,
  );
  assert.equal(
    product.safeParse({
      name: "Test",
      slug: "test",
      description: "A description",
      categoryId: "c",
      images: [
        `/api/media/${"a".repeat(64)}.webp`,
        "https://images.example.com/product.jpg",
      ],
      active: true,
      featured: false,
    }).success,
    true,
  );
  assert.equal(
    product.safeParse({
      name: "Test",
      slug: "test",
      description: "A description",
      categoryId: "c",
      images: ["/api/media/../secret.png"],
      active: true,
      featured: false,
    }).success,
    false,
  );
  assert.equal(
    variant.safeParse({
      productId: "p",
      sku: "SKU",
      name: "One",
      price: 100,
      stock: -1,
      active: true,
    }).success,
    false,
  );
});
test("uploaded image types are detected from their bytes", () => {
  assert.deepEqual(
    detectImageType(
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ),
    { extension: "png", mime: "image/png" },
  );
  assert.deepEqual(detectImageType(Uint8Array.from([0xff, 0xd8, 0xff])), {
    extension: "jpg",
    mime: "image/jpeg",
  });
  assert.equal(
    detectImageType(new TextEncoder().encode("<svg><script/></svg>")),
    null,
  );
});
test("delivery addresses require Indian postcode and phone", () => {
  assert.equal(
    address.safeParse({
      name: "Example",
      phone: "123",
      line1: "Example street",
      city: "Nadiad",
      state: "Gujarat",
      pincode: "123",
    }).success,
    false,
  );
});
test("category and catalogue filters accept only bounded input", () => {
  assert.equal(
    category.safeParse({
      name: "Chairs",
      slug: "chairs",
      parentId: "furniture",
    }).success,
    true,
  );
  assert.equal(
    category.safeParse({
      name: "Chairs",
      slug: "../chairs",
      parentId: null,
    }).success,
    false,
  );
  assert.deepEqual(
    parseCatalogQuery(
      new URLSearchParams(
        "q=chair&category=dining-chairs&min=100.50&max=500&availability=in-stock&featured=true&sort=price-asc&page=2",
      ),
    ),
    {
      q: "chair",
      category: "dining-chairs",
      availability: "in-stock",
      featured: true,
      sort: "price-asc",
      page: 2,
      minPrice: 10050,
      maxPrice: 50000,
    },
  );
  assert.throws(() =>
    parseCatalogQuery(new URLSearchParams("min=500&max=100")),
  );
});
