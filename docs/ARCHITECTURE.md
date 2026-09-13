# Architecture and security boundaries

## Request flow

App Router pages and client components → `/api/[...path]` → validated server services → Prisma → PostgreSQL.
`/api/webhooks/razorpay` is a separate raw-body endpoint. It does not use browser session authentication; it authenticates the exact payload with HMAC SHA-256.

- `src/lib/auth.ts`: opaque, random server sessions; only HMAC token digests are stored. Session cookies are HttpOnly, SameSite=Lax and Secure in production. Every protected operation rechecks the user and role in the database.
- `src/lib/crypto.ts`: salted scrypt passwords (N=65536, r=8, p=2), constant-time comparisons, webhook HMAC.
- `src/lib/http.ts`: strict Origin checks for browser mutations, bounded request bodies and safe error responses.
- `src/lib/validation.ts`: allowlisted input schemas. No caller-supplied roles, totals, user IDs or payment status are accepted.
- `src/lib/transaction.ts`: serializable transactions, with retries only for database serialization conflicts. External gateway calls never run in a retrying database transaction.
- `src/lib/payments.ts`: order creation, stock and coupon reservations, payment reconciliation and cancellation.
- `src/lib/admin.ts`: role-checked admin operations and transactional audit records for catalogue/fulfilment changes.
- `src/lib/payment-state.ts`: monotonic handling of capture and refund events.
- `src/lib/media.ts`: bounded, admin-only image uploads, signature validation, content-addressed filenames and same-origin media responses.

## Amounts and inventory

All prices are integer paise. Product prices are tax-inclusive; this implementation does not calculate GST slabs or generate GST invoices. Discounts round down to the nearest paisa. Shipping is configurable and free-shipping eligibility uses the pre-discount subtotal. There is one INR currency and one stock pool per variant.

At checkout, all prices, availability, coupons and totals are read from PostgreSQL. Every variant stock decrement and coupon reservation is part of the same serializable transaction as the order snapshot. Failed transactions reserve nothing. Carts do not reserve inventory.

`Variant.stock` means available stock, excluding pending reservations. Admin changes use an expected-stock comparison so a stale form cannot overwrite an intervening reservation. Products and variants are archived by setting `active=false`; they are not physically deleted because historical orders reference them.

Categories support one optional subcategory level through a self-relation. Selecting a top-level category in the storefront includes products assigned directly to it and to any of its subcategories. Selecting a subcategory matches that subcategory only. Admin validation prevents self-parenting and deeper nesting.

`Product.minPrice` caches the lowest active variant price. Variant admin mutations update it transactionally, while the hierarchy/price migration backfills existing products. This indexed value keeps price filtering, price sorting and pagination database-driven instead of loading the full catalogue into application memory.

An order preserves names, SKUs, prices, quantities and address independently of later catalogue/address edits. Coupon usage includes pending reservations and paid orders. Cancellation releases it once. Refunds do not automatically restock returns or release coupon usage.

## Payment lifecycle

1. Create a local pending order with an idempotency key and reserve stock.
2. Claim gateway creation using a unique `creating:<local-id>` marker.
3. Create a Razorpay Order with the server-computed amount and local receipt reference.
4. Link its provider ID. The browser receives the public key and that order only.
5. Open hosted Razorpay Checkout. The browser success callback only requests server reconciliation; it never marks an order paid.
6. Process `payment.captured` or `order.paid`: verify HMAC on raw bytes, check event ID, amount, currency, payment ID and local order mapping, then update the order and deduplication record in one transaction.
7. Process `refund.processed` by fetching current payment refund totals server-to-server. Keep refunded totals monotonic across delayed events.

No card numbers, CVVs or provider secret keys enter the client bundle. Provider credentials are sent only to the fixed Razorpay API hostname.

## Failure handling

- Duplicate events return success once an event is stored. Concurrent duplicates can produce a retryable conflict; delivery retries then become no-ops.
- Webhooks arriving before the provider order is linked receive HTTP 503 and must retry.
- A failed/abandoned attempt does not cancel the order: the same provider order can still be paid. Configure automatic capture in Razorpay.
- Provider-order creation can succeed remotely while its response is lost. Never blindly retry creation. The reservation remains pending with a `creating:` marker; an operator looks up the receipt in Razorpay and runs the documented linking command.
- A cancelled order releases inventory exactly once. A late captured payment becomes `PAYMENT_REVIEW`, never automatically fulfilled. Refund it after investigation.
- Full refunds become `REFUNDED`. Partial refunds keep fulfilment status and show the cumulative refunded amount.
- Unpaid reservations do not automatically expire. This conservative policy avoids silent overselling. Operators review and cancel abandoned pending orders. Late payments remain covered by `PAYMENT_REVIEW`.
- The original cart remains available after payment. A webhook cannot safely delete a cart the customer may have edited while checkout was open. Customers can clear it explicitly.

## Scope and extensions

Included: password login/register/reset, customer accounts, address book, wishlist, catalog search/categories, variants, stock, cart, coupon checkout, Razorpay payment capture/refund webhooks, reconciliation, order history, shipping tracking, admin products/categories/coupons/orders/customers, and audit log.

Product media is uploaded directly in the admin panel. JPEG, PNG, WebP and GIF files are signature-checked, limited to 5 MB each and stored under `MEDIA_STORAGE_PATH` with content-addressed names. The default is `./data/uploads`. This directory must be persistent, writable and backed up; horizontally scaled instances must share it. Existing HTTPS image URLs remain valid for previously saved products. Refund initiation is intentionally performed in Razorpay's dashboard; verified refund status flows back into the store.

Not implemented: guest checkout, email verification, social login, MFA, GST invoice generation, tax calculation, courier booking/pincode serviceability API, COD, multi-vendor, automated return authorisation, product reviews, abandoned-cart emails, order notification emails, or analytics integrations. Password-reset email is implemented through SMTP.

## Operational requirements

Use HTTPS, private database networking, a least-privilege runtime DB role, strong unique credentials, encrypted backups, provider alerts and edge request limits. Run migrations through a separate schema-owner role when possible. Set `TRUSTED_IP_HEADER` only if a trusted edge proxy overwrites it; an arbitrary client-supplied forwarding header is not trustworthy. Without it the auth IP bucket is intentionally global.

Sessions expire after seven days. Password resets expire in 30 minutes and invalidate all sessions and reset tokens for that user. Only the bootstrap CLI can establish the initial admin. Repeated seed runs do not promote existing customers or reset passwords.

Security headers are configured in `next.config.ts`. Tailor and test a CSP for your actual Razorpay domains, image hosts and Next.js deployment; no untested strict CSP is shipped. Add admin MFA/SSO before exposing high-value operations to a larger team. Code review and real integration tests are still needed before accepting live money.
