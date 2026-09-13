import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty">
      <h1>Page not found</h1>
      <Link className="button mt-6" href="/shop">
        Browse the shop
      </Link>
    </div>
  );
}
