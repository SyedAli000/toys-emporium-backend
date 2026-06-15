export function formatPrice(amount: number): string {
  const value = Number(amount) || 0;
  return `Rs. ${value.toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
