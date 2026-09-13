"use client";
import {
  api,
  useData,
  ProductCard,
  Notice,
  Empty,
  Loading,
  message,
} from "@/components/ui";
import type { Product } from "@/lib/types";
import { useToast } from "@/components/toast";
export default function Page() {
  const { data, error, loading, reload } =
    useData<{ product: Product }[]>("wishlist");
  const toast = useToast();
  return (
    <>
      <p className="eyebrow">Keep your favourites close</p>
      <h1>Your wishlist.</h1>
      <Notice text={error} tone="error" />
      {loading ? (
        <Loading />
      ) : data?.length ? (
        <div className="product-grid mt-8">
          {data.map(({ product: p }) => (
            <div key={p.id}>
              <ProductCard product={p} />
              <button
                className="text-button mt-4"
                onClick={async () => {
                  try {
                    await api("wishlist", "DELETE", { productId: p.id });
                    await reload();
                    toast("Removed from your wishlist.", "success");
                  } catch (e) {
                    toast(message(e), "error");
                  }
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Empty>Your favourites will appear here.</Empty>
      )}
    </>
  );
}
