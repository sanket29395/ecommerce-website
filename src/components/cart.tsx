"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Address, Variant, Product } from "@/lib/types";
import { api, useData, Notice, Loading, Empty, message } from "./ui";
import { money, totals } from "@/lib/money";
import { AddressForm } from "./addresses";
import { pay, PaymentOrder } from "./payment-button";
import { useToast } from "./toast";
type Item = {
  id: string;
  quantity: number;
  variant: Variant & { product: Product };
};
export function Cart({
  shipping,
  freeAbove,
}: {
  shipping: number;
  freeAbove: number;
}) {
  const router = useRouter();
  const cart = useData<Item[]>("cart");
  const addresses = useData<Address[]>("addresses");
  const [selected, setSelected] = useState("");
  const [coupon, setCoupon] = useState("");
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const sum = totals(
    (cart.data || []).reduce((sum, i) => sum + i.quantity * i.variant.price, 0),
    0,
    shipping,
    freeAbove,
  );
  async function update(v: string, q: number) {
    setBusy(true);
    try {
      await api("cart", "POST", { variantId: v, quantity: q });
      await cart.reload();
    } catch (e) {
      toast(message(e), "error");
    } finally {
      setBusy(false);
    }
  }
  if (cart.loading) return <Loading />;
  if (cart.error)
    return (
      <>
        <Notice text={cart.error} tone="error" />
        <Link className="button" href="/login">
          Sign in to view your bag
        </Link>
      </>
    );
  if (!cart.data?.length)
    return (
      <Empty>
        Your bag is empty.{" "}
        <Link className="text-button" href="/shop">
          Explore the collection
        </Link>
      </Empty>
    );
  return (
    <>
      <p className="eyebrow">A few good things</p>
      <h1>Your bag.</h1>
      <div className="checkout-grid mt-8">
        <div>
          {cart.data.map((i) => (
            <div className="cart-row" key={i.id}>
              {i.variant.product.images[0] ? (
                <img
                  src={i.variant.product.images[0]}
                  alt={i.variant.product.name}
                />
              ) : (
                <div />
              )}
              <div>
                <Link href={`/products/${i.variant.product.slug}`}>
                  <h3>{i.variant.product.name}</h3>
                </Link>
                <p className="muted">{i.variant.name}</p>
                <p>{money(i.variant.price)}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="secondary"
                  disabled={busy}
                  aria-label="Decrease quantity"
                  onClick={() => update(i.variant.id, i.quantity - 1)}
                >
                  −
                </button>
                <span>{i.quantity}</span>
                <button
                  className="secondary"
                  disabled={busy || i.quantity >= 20}
                  aria-label="Increase quantity"
                  onClick={() => update(i.variant.id, i.quantity + 1)}
                >
                  +
                </button>
              </div>
            </div>
          ))}
          <button
            className="text-button mt-5"
            disabled={busy}
            onClick={async () => {
              if (!confirm("Remove all items from your bag?")) return;
              try {
                await api("cart", "DELETE");
                await cart.reload();
              } catch (e) {
                toast(message(e), "error");
              }
            }}
          >
            Clear bag
          </button>
          <div className="panel mt-8">
            <h2 className="mb-5">Add a delivery address</h2>
            <AddressForm
              onSaved={() => {
                void addresses.reload();
              }}
            />
          </div>
        </div>
        <aside className="panel h-fit stack">
          <h2>Order summary</h2>
          <div className="totals">
            <div>
              <span>Subtotal</span>
              <span>{money(sum.subtotal)}</span>
            </div>
            <div>
              <span>Shipping</span>
              <span>{sum.shipping ? money(sum.shipping) : "Free"}</span>
            </div>
            <div className="grand">
              <span>Total before coupon</span>
              <span>{money(sum.total)}</span>
            </div>
          </div>
          <label className="field">
            <span>Deliver to</span>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Select an address</option>
              {addresses.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {a.line1}, {a.pincode}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Coupon code</span>
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value.toUpperCase())}
              placeholder="Optional"
              maxLength={30}
            />
          </label>
          <p className="muted text-sm">
            Coupon discounts are validated before the payment window opens. The
            final payable amount appears in secure checkout.
          </p>
          <button
            className="primary"
            disabled={busy || !selected}
            onClick={async () => {
              setBusy(true);
              try {
                const order = await api<PaymentOrder>("checkout", "POST", {
                  addressId: selected,
                  coupon,
                  checkoutKey: crypto.randomUUID(),
                });
                await pay(order, () => router.push("/account"));
              } catch (e) {
                toast(message(e), "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Preparing checkout…" : "Proceed to secure payment"}
          </button>
          <p className="muted text-sm">
            Already started a payment? Resume it from{" "}
            <Link className="text-button" href="/account">
              My orders
            </Link>
            .
          </p>
        </aside>
      </div>
    </>
  );
}
