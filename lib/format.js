export function zar(n) {
  if (n == null || n === "" || isNaN(Number(n))) return "—";
  return "R " + Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function shortDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d) ? "—" : d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}
export function ago(s) {
  if (!s) return "—";
  const m = Math.round((Date.now() - new Date(s).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m ago";
  const h = Math.round(m / 60);
  if (h < 24) return h + "h ago";
  const d = Math.round(h / 24);
  return d < 60 ? d + "d ago" : shortDate(s);
}
export const VAT = 1.15;
export const withVat = (n) => (n == null || n === "" ? null : Math.round(Number(n) * VAT * 100) / 100);
