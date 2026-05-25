import type { Product } from "@prisma/client";

export type MenuProductContext = {
  id: string;
  name: string;
  category: string | null;
  price: number | null;
  description: string | null;
  availability: string | null;
  customOptions: string | null;
  minimumNoticeHours: number | null;
  notes: string | null;
};

function compactText(value: string | null) {
  if (!value) {
    return null;
  }

  return value.replace(/\s+/g, " ").trim() || null;
}

function normalizeProductName(name: string) {
  return name.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

export function toMenuProductContext(product: Product): MenuProductContext {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    price: product.price,
    description: product.description,
    availability: compactText(product.availabilityJson),
    customOptions: compactText(product.customOptionsJson),
    minimumNoticeHours: product.minimumNoticeHours,
    notes: product.notes
  };
}

export function dedupeMenuProducts(products: MenuProductContext[]) {
  const seen = new Set<string>();
  const dedupedProducts: MenuProductContext[] = [];

  for (const product of products) {
    const normalizedName = normalizeProductName(product.name);

    if (seen.has(normalizedName)) {
      continue;
    }

    seen.add(normalizedName);
    dedupedProducts.push(product);
  }

  return dedupedProducts;
}

export function formatMenuContext(products: MenuProductContext[]) {
  if (products.length === 0) {
    return [
      "Available products: none added yet.",
      "If the customer asks for menu, explain that menu products still need to be added by the business owner."
    ].join("\n");
  }

  const productLines = products.map((product) => {
    const parts = [
      product.name,
      product.category,
      product.price === null ? null : `AED ${product.price}`,
      product.minimumNoticeHours === null
        ? null
        : `minimum notice ${product.minimumNoticeHours}h`,
      product.customOptions ? `custom: ${product.customOptions}` : null,
      product.availability ? `availability: ${product.availability}` : null,
      product.description ? `details: ${product.description}` : null
    ].filter(Boolean);

    return `- ${parts.join(" | ")}`;
  });

  return [
    "Available products:",
    ...productLines,
    "Menu rules:",
    "- Do not invent products or prices.",
    "- If customer asks about an item not in the product list, say it needs manual availability confirmation.",
    "- If customer asks for a product in the list, use the stored price/details.",
    "- Do not confirm availability if availability is unclear.",
    "- Do not confirm order until required fields are present.",
    "- Future delivery date/time is required."
  ].join("\n");
}
