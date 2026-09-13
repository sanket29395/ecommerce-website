"use client";
import { useState } from "react";
import Link from "next/link";
import {
  useData,
  api,
  Notice,
  InlineNotice,
  Loading,
  Empty,
  message,
  Pager,
} from "./ui";
import { AddressForm } from "./addresses";
import { pay, PaymentOrder } from "./payment-button";
import { money } from "@/lib/money";
import type { Order, Address } from "@/lib/types";
import { useToast } from "./toast";
export function Account() {
  const [page, setPage] = useState(1);
  const orders = useData<Order[]>(`orders?page=${page}`);
  const addresses = useData<Address[]>("addresses");
  const toast = useToast();
  const [editing, setEditing] = useState<Address>();
  const [busy, setBusy] = useState(false);
  async function act(id: string, action: string) {
    setBusy(true);
    try {
      if (
        action === "cancel" &&
        !confirm("Cancel this unpaid order and release its stock?")
      )
        return;
      if (action === "pay") {
        await pay(await api<PaymentOrder>(`orders/${id}/pay`, "POST"), () => {
          void orders.reload();
        });
      } else {
        await api(`orders/${id}/${action}`, "POST");
        await orders.reload();
      }
    } catch (e) {
      toast(message(e), "error");
    } finally {
      setBusy(false);
    }
  }
  if (orders.error)
    return (
      <>
        <Notice text={orders.error} tone="error" />
        <Link href="/login" className="button">
          Sign in
        </Link>
      </>
    );
  return (
    <>
      <p className="eyebrow">Your corner of the shop</p>
      <h1>My account.</h1>
      <div className="section-heading">
        <h2>My orders</h2>
        <Link href="/shop" className="text-button">
          Continue shopping
        </Link>
      </div>
      {orders.loading ? (
        <Loading />
      ) : orders.data?.length ? (
        orders.data.map((o) => (
          <article key={o.id} className="order">
            <div className="flex justify-between flex-wrap gap-4 mb-4">
              <div>
                <h3>Order {o.id.slice(-8).toUpperCase()}</h3>
                <p className="muted text-sm">
                  {new Date(o.createdAt).toLocaleDateString("en-IN")}
                </p>
              </div>
              <span className="badge">{o.status.replaceAll("_", " ")}</span>
            </div>
            {o.items.map((i) => (
              <div key={i.id} className="flex justify-between gap-4 py-2">
                <span>
                  {i.name} × {i.quantity}
                </span>
                <span>{money(i.price * i.quantity)}</span>
              </div>
            ))}
            <div className="flex flex-wrap justify-between gap-4 border-t border-gray-200 pt-4 mt-3">
              <p>
                Shipping {money(o.shipping)} · Discount {money(o.discount)}
              </p>
              <strong>Total {money(o.total)}</strong>
            </div>
            {o.refundedAmount > 0 && (
              <p className="mt-3">Refunded: {money(o.refundedAmount)}</p>
            )}
            <p className="muted mt-3">
              Deliver to: {o.address.name}, {o.address.line1}, {o.address.city}{" "}
              {o.address.pincode}
            </p>
            {o.trackingUrl && (
              <a
                className="text-button mt-3 inline-block"
                href={o.trackingUrl}
                target="_blank"
                rel="noreferrer"
              >
                Track with {o.carrier}
              </a>
            )}
            <div className="flex flex-wrap gap-3 mt-5">
              {o.status === "PENDING" && (
                <>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => act(o.id, "pay")}
                  >
                    Complete payment
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => act(o.id, "cancel")}
                  >
                    Cancel order
                  </button>
                </>
              )}
              <button
                className="secondary"
                disabled={busy}
                onClick={() => act(o.id, "sync")}
              >
                Refresh payment status
              </button>
            </div>
            {o.status === "PAYMENT_REVIEW" && (
              <InlineNotice text="Payment received after stock was released. Contact support with this order ID for fulfilment or refund." />
            )}
          </article>
        ))
      ) : (
        <Empty>You have not placed any orders yet.</Empty>
      )}
      <Pager
        page={page}
        setPage={setPage}
        count={orders.data?.length || 0}
        size={20}
      />
      <div className="section-heading">
        <h2>Delivery addresses</h2>
      </div>
      <div className="form-grid">
        {addresses.data?.map((a) => (
          <div key={a.id} className="panel">
            <strong>{a.name}</strong>
            <p>
              {a.line1} {a.line2}
            </p>
            <p>
              {a.city}, {a.state} {a.pincode}
            </p>
            <p>{a.phone}</p>
            <div className="flex gap-4 mt-4">
              <button className="text-button" onClick={() => setEditing(a)}>
                Edit
              </button>
              <button
                className="text-button"
                onClick={async () => {
                  if (!confirm("Delete this saved address?")) return;
                  try {
                    await api(`addresses/${a.id}`, "DELETE");
                    await addresses.reload();
                    toast("Address removed.", "success");
                  } catch (e) {
                    toast(message(e), "error");
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="panel mt-6">
        <h2 className="mb-6">{editing ? "Edit address" : "New address"}</h2>
        <AddressForm
          key={editing?.id || "new"}
          existing={editing}
          onSaved={() => {
            void addresses.reload();
            setEditing(undefined);
          }}
        />
      </div>
    </>
  );
}
