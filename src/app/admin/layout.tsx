import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin-nav";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/account");
  return (
    <div className="admin-shell">
      <AdminNav />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
