# Integration acceptance checklist

These checks require a staging PostgreSQL database, a running application instance, SMTP credentials and Razorpay test keys. Complete the checklist before accepting live payments.

## Authentication and access

- Register a customer, log out, sign in and reset the password through a real email. Old sessions and reused/expired reset links must fail after reset.
- As a customer, GET/POST/PATCH every `/api/admin/*` resource: expect 403. Without a cookie, expect 401.
- Attempt to read, edit or delete another customer's address/order: no data or mutation should be allowed.
- Submit browser mutations without Origin or with a foreign Origin: expect 403.
- Verify session cookies are Secure in production, HttpOnly and SameSite=Lax. Verify login rate limits with the actual trusted proxy configuration.

## Products and inventory

- Create a top-level category, optional subcategories and a draft product assigned to each level. Upload and reorder multiple images, and add two variants. Publish it; check the thumbnail, gallery, category path, variants, wishlist and cart. Reject self-parenting, third-level categories, oversized images, disguised files and unsupported files.
- Search by name, description, option and SKU. Combine parent/subcategory, price, availability and featured filters; verify parent filters include their subcategories. Test newest, price and name sorting across multiple result pages, including products without active variants.
- Unpublish a product while it is in a customer cart; checkout must reject it.
- Race two customers buying the last item; only one reservation succeeds and stock cannot go negative.
- Open an admin stock form, reserve an item in another session, then submit the old form: expect a stock-conflict error.
- Race coupon use at its final allowed use; only one reservation consumes it.
- Cancel the same unpaid order twice: only the first cancellation restores inventory and coupon usage.

## Payments

- Tamper with client-side prices, totals, user IDs and roles; none should affect server calculations or permissions.
- Deliver an invalid webhook signature and a modified raw body: expect 400.
- Deliver a valid event with wrong amount/currency: reject it; do not mark the order paid.
- Deliver the same captured event twice and concurrently: inventory and fulfilment must be unchanged after the first application.
- Deliver capture and refund events out of order: refunded totals never decrease; fulfilled status does not revert to paid.
- Cancel while payment is open, then finish paying: expect PAYMENT_REVIEW, not PAID or SHIPPED.
- Simulate a failed payment and retry the existing order; stock stays reserved once.
- Simulate a lost create-order response: verify `creating:` marker and operator linking workflow, with no second provider creation.
- Disable webhook delivery and run reconciliation; verify the same payment state is recovered.
- Issue partial and full test refunds and verify history. Confirm refunds do not automatically restock goods.

## Operations and UI

- Trigger successful and failed customer/admin actions. Verify transient messages use dismissible toasts, duplicate messages do not stack, internal error details are hidden, and payment-review warnings remain visible inline.

- Test admin PAID → PROCESSING → SHIPPED → DELIVERED. Tracking requires an HTTPS URL. Other transitions are rejected.
- Browse at mobile and desktop widths, including long names, no images, empty lists, and API errors.
- Configure real contact/policy content, owned media, tax-inclusive prices, actual shipping costs and a shipping serviceability policy before opening orders.
- Test production build against the database with a least-privilege application user; back up and restore the database and `MEDIA_STORAGE_PATH`.
