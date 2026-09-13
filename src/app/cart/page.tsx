import { Cart } from "@/components/cart";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <Cart
      shipping={Number(process.env.SHIPPING_PAISE || 7900)}
      freeAbove={Number(process.env.FREE_SHIPPING_ABOVE_PAISE || 199900)}
    />
  );
}
