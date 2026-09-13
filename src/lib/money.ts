export function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value / 100);
}
export function totals(
  subtotal: number,
  percent = 0,
  shipping = 7900,
  freeAbove = 199900,
) {
  if (
    !Number.isSafeInteger(subtotal) ||
    subtotal < 0 ||
    percent < 0 ||
    percent > 90 ||
    shipping < 0 ||
    freeAbove < 0
  )
    throw new Error("Invalid totals");
  const discount = Math.floor((subtotal * percent) / 100);
  const fee = subtotal >= freeAbove ? 0 : shipping;
  return {
    subtotal,
    discount,
    shipping: fee,
    total: subtotal - discount + fee,
  };
}
