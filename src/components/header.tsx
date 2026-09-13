"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api, useData } from "./ui";
export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: user, reload } = useData<{ name: string; role: string } | null>(
    `auth/me?route=${encodeURIComponent(pathname)}`,
  );
  return (
    <>
      <div className="announcement">
        A thoughtful edit for better everyday rituals
      </div>
      <header className="header">
        <Link href="/" className="brand">
          FORM <span>&</span> FIELD<span className="brand-dot">.</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/shop">Shop</Link>
          <Link href="/wishlist">Wishlist</Link>
          <Link href="/cart">Bag</Link>
          {user ? (
            <>
              <Link href="/account">Account</Link>
              {user.role === "ADMIN" && <Link href="/admin">Admin</Link>}
              <button
                className="text-button"
                onClick={async () => {
                  await api("auth/logout", "POST");
                  await reload();
                  router.push("/");
                  router.refresh();
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login">Sign in</Link>
          )}
        </nav>
      </header>
    </>
  );
}
