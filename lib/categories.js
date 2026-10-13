export const PRODUCT_CATEGORIES = ["BARN", "BIFOLD", "BARN FOLD", "INTERIOR", "EXTERIOR", "BARN HARDWARE", "HARDWARE"];

export function mergeCategories(fromDb = []) {
  return [...new Set([...PRODUCT_CATEGORIES, ...(fromDb || []).filter(Boolean)])].sort();
}

export const MARKETPLACES = {
  shopify: { label: "Shopify", col: "shopify_sku", dot: "bg-pink-500" },
  takealot: { label: "Takealot", col: "takealot_sku", dot: "bg-blue-500" },
  leroymerlin: { label: "Leroy Merlin", col: "leroymerlin_sku", dot: "bg-green-500" },
};
