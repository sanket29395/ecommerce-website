# Form & Field — Next.js ecommerce source

A self-hosted ecommerce application with a storefront, customer accounts and an admin panel. Built with Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL, Prisma and Razorpay Standard Checkout. Designed for a single-store Indian INR catalogue; branding and product categories are editable in source/admin.

## Included

- Registration, login, logout, password reset via SMTP, database-backed sessions.
- Search, dynamic categories/subcategories, price and availability filters, catalogue sorting, product pages, multiple SKU variants, stock, image galleries, wishlist and cart.
- Saved/editable delivery addresses, coupon validation, server-priced checkout and order history.
- Transactional inventory reservations, idempotent local checkout keys and verified/deduplicated payment webhooks.
- Razorpay capture/refund reconciliation and handling for late payments on cancelled orders.
- Admin product publishing, direct multi-image uploads, variants, dynamic categories/subcategories, coupons, customers, order fulfilment and audit history.
- Prisma schema, initial SQL migration, ready-to-import PostgreSQL SQL, optional local PostgreSQL Compose config, setup and security documentation.

## 1. Requirements

Node.js 22.12+ (Node 24 recommended), npm, PostgreSQL 16+ and a Razorpay account. SMTP is required for password-reset email. Use PostgreSQL 17 for the included Docker Compose example.

## 2. Install and configure

```sh
npm ci
```

Copy `.env.example` to `.env` (`cp .env.example .env` on Linux/macOS; `Copy-Item .env.example .env` in PowerShell). Fill in your database URL, public app URL, random session secret, Razorpay keys/webhook secret, SMTP details and a unique bootstrap admin email/password. `MEDIA_STORAGE_PATH` must point to a writable, persistent directory in production. Generate a secret with:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Do not commit `.env`. `APP_URL` must match the browser origin exactly, including localhost port. Production requires HTTPS because the session cookie is Secure. Use server environment variables for hosted deployments; the scripts below read `.env` for local CLI use.

## 3. Create your database and apply the schema

**A `.prisma` file cannot be uploaded directly as PostgreSQL SQL.** `prisma/schema.prisma` is the application model. `prisma/schema.sql` is the SQL generated from that model, with additional database constraints.

Create an empty PostgreSQL database manually. Use one of the following paths, not both.

### Recommended: apply the included migration

```sh
npm run db:generate
npm run db:migrate
```

`db:migrate` runs `prisma migrate deploy`; it uses `DATABASE_URL` from `.env`. It creates the schema and migration tracking table. No seed products are required.

### Manual SQL import through pgAdmin, DBeaver or psql

Open `prisma/schema.sql` in a SQL editor connected to your EMPTY database and execute the complete script. Or:

```sh
psql "YOUR_DATABASE_CONNECTION_STRING" -v ON_ERROR_STOP=1 --single-transaction -f prisma/schema.sql
```

Then tell Prisma that the initial migration was already applied:

```sh
npx prisma migrate resolve --applied 20260912000000_init
npx prisma migrate resolve --applied 20260913000000_category_hierarchy_and_product_price
npm run db:generate
```

Do not run the SQL again against an existing populated schema. `db:push` is available for disposable development only; prefer migrations so the SQL CHECK constraints are preserved. For schema changes, use `npx prisma migrate dev --name describe_change` against a development database, then `npm run db:migrate` in deployment.

Optional local database: add `POSTGRES_PASSWORD` to `.env` and run `docker compose up -d`. Set the matching password in `DATABASE_URL`.

## 4. Bootstrap admin and run

```sh
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. Sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`, then open `/admin`.

Seeding creates the initial admin and three starter categories. It does not create demo products, reset existing passwords or promote existing customers. Remove `ADMIN_PASSWORD` from the deployed runtime after bootstrapping. Keep it only where needed for a controlled initial seed.

In `/admin/categories`, create top-level categories and optional subcategories. In `/admin/products`, create a product, assign either a category or subcategory, upload and order up to eight images, add one or more variants with unique SKUs and available stock, then publish it. Customers can search names, descriptions and SKU/option text; filter by category hierarchy, price, availability or featured status; and sort by newest, price or name. All catalogue data comes from PostgreSQL; uploaded image files are stored under `MEDIA_STORAGE_PATH`.

## 5. Configure payments and email

See [docs/PAYMENTS.md](docs/PAYMENTS.md) for Razorpay test/live setup, required events and recovery commands. Webhook endpoint:

```text
POST /api/webhooks/razorpay
```

Use a separate strong webhook secret. Subscribe to `payment.captured`, `order.paid`, `refund.processed` and enable automatic payment capture. The browser callback does not mark the order paid. Gateway reconciliation and verified webhooks do.

Password-reset emails use SMTP. Set SMTP host, port, user, password and `MAIL_FROM`. Port 465 uses implicit TLS; 587 uses STARTTLS. Never put SMTP credentials in public environment variables. Test email delivery before inviting customers.

## 6. Build and operate

```sh
npm run typecheck
npm test
npm run build
npm start
```

The build does not require a running database for static routes. Product/admin routes are dynamic and require the configured database at runtime.

Schedule `npm run payments:reconcile` in a single worker about every 10 minutes and `npm run maintenance` daily. Review abandoned pending orders and payment-review orders in admin. Refunds are initiated through the Razorpay dashboard; refund state is synced back into this app.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for security boundaries and [docs/ACCEPTANCE-TESTS.md](docs/ACCEPTANCE-TESTS.md) for database/provider tests to complete before accepting live payments.

## Important scope limits

This is source code to configure and review, not an independently audited production service. Included legal/contact pages are visibly marked drafts and must be completed. Replace the sample brand content with your own identity and business information. Uploaded product media is stored on the application filesystem, so production deployments must mount and back up a persistent `MEDIA_STORAGE_PATH`. Multiple application instances must share that media directory or use an external object-storage extension.

The store uses tax-inclusive prices and configurable flat/free shipping. GST calculation/invoices, courier integrations, order notification emails, email verification, MFA, social login, COD, returns authorisation and automated refund initiation are not implemented. These are explicit extensions, not hidden placeholder integrations.

## Structure

```text
prisma/                 Prisma model, SQL, migration and admin seed
src/app/                Storefront, account, policies and admin routes
src/app/api/            Session-protected APIs and separate signed webhook
src/components/         Storefront and admin interfaces
src/lib/                Auth, validation, pricing, inventory/payment services
scripts/                Reconciliation and expiry cleanup
tests/                  Security and payment-state unit tests
docs/                   Architecture, provider setup and acceptance checklist
```

Framework security reference: https://nextjs.org/blog/august-2026-security-release
