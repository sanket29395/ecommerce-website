import { Suspense } from "react";
import { Catalog } from "@/components/catalog";
export default function Page() {
  return (
    <Suspense fallback={<div className="empty">Loading products...</div>}>
      <Catalog />
    </Suspense>
  );
}
