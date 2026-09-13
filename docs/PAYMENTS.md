# Razorpay setup and recovery

1. Create Razorpay test-mode API keys. Put them in server-only `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
2. Set payments to automatic capture in the dashboard. Authorised-only payments are not considered paid by this application.
3. Configure the public HTTPS webhook URL: `https://YOUR-DOMAIN/api/webhooks/razorpay`.
4. Subscribe to `payment.captured`, `order.paid`, and `refund.processed`.
5. Set a separate strong webhook secret and put the exact same value in `RAZORPAY_WEBHOOK_SECRET`.
6. Ensure the reverse proxy passes raw request bytes unchanged and allows Razorpay webhook retries. Do not place browser-login middleware or a CSRF Origin requirement on this endpoint.
7. Complete a small test payment. Verify the order changes from PENDING to PAID and stock decreases only once. A frontend success popup alone is not evidence of payment.
8. Test a dashboard refund and replay delivery. Verify refunded amounts do not decrease under reordered deliveries.
9. Switch to live keys and configure a separate live-mode webhook when ready. Never mix live and test keys.

## Reconciliation job

Run `npm run payments:reconcile` periodically (for example every 10 minutes) in one scheduled worker, with the same environment as the app. It walks linked orders in batches of 100 and fetches payment state. It also checks cancelled orders for late payments. For large order histories, add a persistent cursor/time window and respect Razorpay rate limits; the included worker is appropriate for a small store.

Run `npm run maintenance` daily to remove expired sessions, password-reset tokens and old rate-limit rows. It intentionally preserves webhook event IDs and reservations.

## Interrupted gateway order creation

If setup timed out, do not recreate the same payment blindly. Find the provider order whose `receipt` equals the local order ID in the Razorpay dashboard or Orders API, then run:

```sh
npm run payments:reconcile -- LOCAL_ORDER_ID order_PROVIDER_ID
```

The command verifies the receipt, amount and currency before linking it. If there is no remote order, cancel the pending local order through the admin panel and allow the customer to create a new checkout. If remote creation is uncertain, investigate first.

## Refunds and stock

Issue refunds through Razorpay's dashboard. This project does not expose a refund-creation endpoint. The `refund.processed` webhook or reconciliation job updates refund totals. Stock is not automatically returned: inspect returned goods and adjust the available variant stock through the admin panel.

## Official references

- https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
- https://razorpay.com/docs/webhooks/validate-test/
- https://razorpay.com/docs/webhooks/payments/
- https://razorpay.com/docs/api/orders/
- https://nextjs.org/docs/app/guides/data-security

Recheck the provider dashboard/documentation when setting up your account; available payment methods and account configuration vary.
