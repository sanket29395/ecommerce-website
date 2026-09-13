"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function AdminNav() {
  const path = usePathname();
  return (
    <aside>
      <p className="eyebrow mb-4">Store management</p>
      <nav className="admin-nav" aria-label="Admin navigation">
        {[
          ["", "Overview"],
          ["products", "Products"],
          ["categories", "Categories"],
          ["orders", "Orders"],
          ["coupons", "Coupons"],
          ["customers", "Customers"],
          ["audit", "Audit log"],
        ].map(([p, label]) => (
          <Link
            key={p}
            className={path === `/admin${p ? `/${p}` : ""}` ? "active" : ""}
            href={`/admin${p ? `/${p}` : ""}`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
