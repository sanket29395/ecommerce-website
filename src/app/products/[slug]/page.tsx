import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product-detail";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await db.product.findFirst({ where: { slug, active: true } });
  return {
    title: p?.name || "Product not found",
    description: p?.description.slice(0, 160),
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await db.product.findFirst({
    where: { slug, active: true },
    include: {
      category: { include: { parent: true } },
      variants: { where: { active: true }, orderBy: { price: "asc" } },
    },
  });
  if (!p) notFound();
  return <ProductDetail product={p} />;
}
