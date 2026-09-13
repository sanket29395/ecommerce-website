"use client";
import { useState } from "react";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { api, message } from "./ui";
import { money } from "@/lib/money";
import { useToast } from "./toast";
export function ProductDetail({ product: p }: { product: Product }) {
  const [selected, setSelected] = useState(p.variants[0]?.id || "");
  const [quantity, setQuantity] = useState(1);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState(p.images[0]);
  const v = p.variants.find((x) => x.id === selected);
  const category = p.category?.parent
    ? `${p.category.parent.name} / ${p.category.name}`
    : p.category?.name;
  async function act(wishlist = false) {
    setBusy(true);
    try {
      await api(
        wishlist ? "wishlist" : "cart",
        "POST",
        wishlist ? { productId: p.id } : { variantId: selected, quantity },
      );
      toast(
        wishlist ? "Saved to your wishlist." : "Your bag has been updated.",
        "success",
      );
    } catch (e) {
      toast(message(e), "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="eyebrow mb-6">
        <Link href="/shop">Shop</Link> / {category}
      </p>
      <div className="detail">
        <div>
          {photo ? (
            <img className="detail-photo" src={photo} alt={p.name} />
          ) : (
            <div className="detail-photo image-fallback">{p.name}</div>
          )}
          <div className="flex gap-3 mt-4">
            {p.images.map((img, i) => (
              <button
                aria-label={`View image ${i + 1}`}
                key={img}
                onClick={() => setPhoto(img)}
              >
                <img src={img} alt="" className="w-16 h-20 object-cover" />
              </button>
            ))}
          </div>
        </div>
        <div className="stack">
          <p className="eyebrow">{category}</p>
          <h1>{p.name}</h1>
          <p className="price">{v ? money(v.price) : "Coming soon"}</p>
          <p className="whitespace-pre-line muted">{p.description}</p>
          <label className="field">
            <span>Option</span>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {p.variants.map((v) => (
                <option value={v.id} key={v.id}>
                  {v.name} — {money(v.price)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Quantity</span>
            <input
              type="number"
              min={1}
              max={Math.min(20, v?.stock || 1)}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
          <p className="muted">
            {v?.stock ? `${v.stock} available` : "Currently out of stock"}
          </p>
          <button
            className="primary"
            disabled={busy || !v?.stock || quantity < 1 || quantity > 20}
            onClick={() => act()}
          >
            Add to bag
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => act(true)}
          >
            Save to wishlist
          </button>
          <Link className="text-button" href="/cart">
            View your bag
          </Link>
          <p className="muted text-sm">
            Prices include applicable tax. Shipping is calculated at checkout.
          </p>
        </div>
      </div>
    </>
  );
}
