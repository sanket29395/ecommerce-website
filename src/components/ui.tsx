"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Product } from "@/lib/types";
import { money } from "@/lib/money";
import { inferToastTone, type ToastTone, useToast } from "./toast";
export async function api<T = unknown>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
    cache: "no-store",
  });
  const result = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  if (!response.ok)
    throw new Error(result?.error || "Something went wrong. Please try again.");
  return result as T;
}
export function useData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError("");
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, loading, reload };
}
export function message(e: unknown) {
  const value = e instanceof Error ? e.message : "";
  if (!value || /^Unable to complete request\. Reference:/i.test(value))
    return "Something went wrong. Please try again.";
  return value;
}
export function Notice({ text, tone }: { text: string; tone?: ToastTone }) {
  const toast = useToast();
  useEffect(() => {
    if (text) toast(text, tone || inferToastTone(text));
  }, [text, toast, tone]);
  return null;
}
export function InlineNotice({
  text,
  tone = "warning",
}: {
  text: string;
  tone?: ToastTone;
}) {
  return text ? (
    <p role="status" className={`inline-notice inline-notice-${tone}`}>
      {text}
    </p>
  ) : null;
}
export function Loading() {
  return (
    <div className="empty" role="status">
      Loading…
    </div>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}
export function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}
export function ProductCard({ product: p }: { product: Product }) {
  const v = p.variants[0];
  const category = p.category?.parent
    ? `${p.category.parent.name} / ${p.category.name}`
    : p.category?.name;
  return (
    <Link href={`/products/${p.slug}`} className="product-card">
      <div className="product-image">
        {p.images[0] ? (
          <img src={p.images[0]} alt={p.name} loading="lazy" />
        ) : (
          <span className="image-fallback">{category || "Collection"}</span>
        )}
        {p.featured && <span className="tag">Selected</span>}
      </div>
      <div className="flex justify-between gap-4 pt-4">
        <div>
          <p className="eyebrow">{category}</p>
          <h3>{p.name}</h3>
        </div>
        <p className="whitespace-nowrap">
          {v ? money(v.price) : "Coming soon"}
        </p>
      </div>
    </Link>
  );
}
export function Pager({
  page,
  setPage,
  count,
  size = 30,
}: {
  page: number;
  setPage: (p: number) => void;
  count: number;
  size?: number;
}) {
  return (
    <div className="flex items-center justify-end gap-4 py-6">
      <button
        className="secondary"
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
      >
        Previous
      </button>
      <span>Page {page}</span>
      <button
        className="secondary"
        disabled={count < size}
        onClick={() => setPage(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
