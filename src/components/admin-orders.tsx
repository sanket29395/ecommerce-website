"use client";
import { useState } from "react";
import {
  useData,
  api,
  Notice,
  InlineNotice,
  Loading,
  Field,
  Pager,
  message,
} from "./ui";
import { money } from "@/lib/money";
import type { Order } from "@/lib/types";
import { useToast } from "./toast";
export function AdminOrders() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useData<Order[]>(
    `admin/orders?page=${page}`,
  );
  const [selected, setSelected] = useState<string>();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const order = data?.find((o) => o.id === selected);
  async function action(id: string, action: string) {
    if (
      action === "cancel" &&
      !confirm("Cancel this unpaid order and release reserved stock?")
    )
      return;
    setBusy(true);
    try {
      await api(`admin/orders/${id}/${action}`, "POST");
      await reload();
      toast("Order updated.", "success");
    } catch (e) {
      toast(message(e), "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="eyebrow">Sales & fulfilment</p>
      <h1 className="!text-4xl">Orders</h1>
      <Notice text={error} tone="error" />
      {order && (
        <div className="admin-form stack">
          <div className="flex justify-between gap-4">
            <h2>Order {order.id.slice(-8).toUpperCase()}</h2>
            <button
              className="text-button"
              onClick={() => setSelected(undefined)}
            >
              Close
            </button>
          </div>
          <p className="text-sm break-all">Reference: {order.id}</p>
          <p>
            {order.user?.name} · {order.user?.email}
          </p>
          <p>
            {order.address.name}, {order.address.line1} {order.address.line2},{" "}
            {order.address.city}, {order.address.state} {order.address.pincode}{" "}
            · {order.address.phone}
          </p>
          {order.items.map((i) => (
            <div className="flex justify-between gap-4" key={i.id}>
              <span>
                {i.name} · {i.sku} × {i.quantity}
              </span>
              <span>{money(i.quantity * i.price)}</span>
            </div>
          ))}
          <p>
            Discount {money(order.discount)} · Shipping {money(order.shipping)}{" "}
            · Total <strong>{money(order.total)}</strong> · Refunded{" "}
            {money(order.refundedAmount)}
          </p>
          <span className="badge w-fit">{order.status}</span>
          {["PAID", "PROCESSING", "SHIPPED"].includes(order.status) && (
            <form
              className="stack"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                const f = new FormData(e.currentTarget);
                try {
                  await api(`admin/orders/${order.id}`, "PATCH", {
                    status: (
                      {
                        PAID: "PROCESSING",
                        PROCESSING: "SHIPPED",
                        SHIPPED: "DELIVERED",
                      } as Record<string, string>
                    )[order.status],
                    ...(order.status === "PROCESSING"
                      ? {
                          carrier: f.get("carrier"),
                          trackingUrl: f.get("trackingUrl"),
                        }
                      : {}),
                  });
                  await reload();
                  toast("Fulfilment status updated.", "success");
                } catch (e) {
                  toast(message(e), "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {order.status === "PROCESSING" && (
                <div className="form-grid">
                  <Field label="Courier / carrier" name="carrier" required />
                  <Field
                    label="Tracking URL (HTTPS)"
                    name="trackingUrl"
                    type="url"
                    required
                  />
                </div>
              )}
              <button className="primary" disabled={busy}>
                Mark as{" "}
                {
                  (
                    {
                      PAID: "processing",
                      PROCESSING: "shipped",
                      SHIPPED: "delivered",
                    } as Record<string, string>
                  )[order.status]
                }
              </button>
            </form>
          )}
          <div className="flex gap-3">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => action(order.id, "sync")}
            >
              Reconcile payment
            </button>
            {order.status === "PENDING" && (
              <button
                className="secondary"
                disabled={busy}
                onClick={() => action(order.id, "cancel")}
              >
                Cancel unpaid order
              </button>
            )}
          </div>
          <p className="muted text-sm">
            Issue refunds in the Razorpay dashboard. The refund webhook updates
            the refunded amount here. Returned goods must be inspected before
            manually increasing variant stock.
          </p>
          {order.status === "PAYMENT_REVIEW" && (
            <InlineNotice text="Do not fulfil automatically. Payment arrived after stock was released. Arrange a refund in Razorpay, or resolve with the customer outside this workflow." />
          )}
        </div>
      )}
      {loading ? (
        <Loading />
      ) : (
        <div className="table-wrap mt-6">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((o) => (
                <tr key={o.id}>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => setSelected(o.id)}
                    >
                      {o.id.slice(-8).toUpperCase()}
                    </button>
                  </td>
                  <td>
                    {o.user?.name}
                    <p className="muted">{o.user?.email}</p>
                  </td>
                  <td>{money(o.total)}</td>
                  <td>
                    <span className="badge">{o.status}</span>
                  </td>
                  <td>{new Date(o.createdAt).toLocaleDateString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} setPage={setPage} count={data?.length || 0} />
    </>
  );
}
