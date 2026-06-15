export function getSalePrice(product: {
  price?: number;
  discountPercentage?: number;
}): number {
  const original = Number(product.price ?? 0);
  const pct = Math.min(
    100,
    Math.max(0, Number(product.discountPercentage ?? 0)),
  );
  if (pct <= 0) return original;
  return Math.round(original * (1 - pct / 100) * 100) / 100;
}
