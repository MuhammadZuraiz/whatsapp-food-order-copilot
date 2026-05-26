import type { ParsedChatMessage } from "./chat.schemas.js";
import type { MenuProductContext } from "./menuContext.js";

const numberWords = new Map([
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["nine", 9],
  ["ten", 10]
]);

const quantityPattern =
  "(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)";

const itemPhrasePattern = [
  "(?:chicken|beef)\\s+biryani\\s+(?:boxes?|trays?)",
  "(?:chicken|beef)\\s+biryani",
  "biryani\\s+(?:boxes?|trays?)",
  "rice\\s+(?:boxes?|trays?)",
  "dessert\\s+platters?",
  "(?:chicken|beef)\\s+(?:boxes?|trays?|meals?|platters?)",
  "pasta\\s+(?:boxes?|trays?|meals?)",
  "cake\\s+(?:boxes?|trays?)",
  "biryani",
  "pasta",
  "cake",
  "rice",
  "platters?",
  "meals?"
].join("|");

const itemRegex = new RegExp(`\\b(${itemPhrasePattern})\\b`, "gi");
const quantityRegex = new RegExp(`\\b${quantityPattern}\\b`, "gi");
const quantityItemRegex = new RegExp(
  `\\b${quantityPattern}\\s+(?:x\\s+)?(${itemPhrasePattern})\\b`,
  "gi"
);

function normalizeText(text: string) {
  return text
    .toLocaleLowerCase()
    .replace(/[.,!?;:()[\]{}"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForMatching(text: string) {
  return normalizeText(text).replace(/\b(box|boxes|tray|trays|platter|platters)\b/g, (unit) => {
    if (unit === "box") {
      return "boxes";
    }

    if (unit === "tray") {
      return "trays";
    }

    if (unit === "platter") {
      return "platters";
    }

    return unit;
  });
}

function parseQuantityValue(value: string) {
  const normalized = value.toLocaleLowerCase();
  const quantity = numberWords.get(normalized) ?? Number(normalized);

  return Number.isFinite(quantity) ? quantity : null;
}

function hasOrderIntent(text: string) {
  return /\b(i want|i need|i would like|i'd like|can i get|please order|place an order|order|book|deliver|delivery|same order|same as usual|same as last|same\b.{0,40}\blast time|like last time|last time|repeat order|order again|usual)\b/i.test(
    text
  );
}

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasQuantityItem(text: string) {
  return new RegExp(quantityItemRegex).test(text);
}

function isPotentialOrderItemMessage(text: string) {
  return hasQuantityItem(text) || (hasOrderIntent(text) && new RegExp(itemRegex).test(text));
}

function hasProductMatch(text: string, products: MenuProductContext[]) {
  const normalizedText = normalizeForMatching(text);

  return products.some((product) =>
    normalizedText.includes(normalizeForMatching(product.name))
  );
}

function isPotentialProductOrderMessage(
  text: string,
  products: MenuProductContext[]
) {
  return (
    products.length > 0 &&
    hasProductMatch(text, products) &&
    (hasOrderIntent(text) || new RegExp(quantityRegex).test(text))
  );
}

function extractItemPhrases(text: string) {
  return [...text.matchAll(itemRegex)].map((match) => match[1]);
}

function extractProductItems(text: string, products: MenuProductContext[]) {
  const normalizedText = normalizeForMatching(text);

  return products
    .filter((product) => {
      const normalizedName = normalizeForMatching(product.name);
      const directMatch = normalizedText.includes(normalizedName);
      const productWords = normalizedName
        .split(" ")
        .filter((word) => word.length > 2);
      const phraseMatch =
        productWords.length >= 2 &&
        productWords.every((word) =>
          new RegExp(`\\b${escapeRegex(word)}\\b`).test(normalizedText)
        );

      return directMatch || phraseMatch;
    })
    .map((product) => product.name);
}

function extractGenericItems(text: string) {
  const items: string[] = [];

  for (const match of text.matchAll(quantityItemRegex)) {
    items.push(match[2]);
  }

  items.push(...extractItemPhrases(text));

  return normalizeOrderItems(items);
}

function isContainedPhrase(shortItem: string, longItem: string) {
  if (shortItem === longItem || shortItem.length >= longItem.length) {
    return false;
  }

  return new RegExp(`(^|\\s)${shortItem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(
    longItem
  );
}

export function normalizeOrderItems(items: string[]) {
  const normalizedItems = items
    .map(normalizeText)
    .filter(Boolean)
    .reduce<string[]>((accumulator, item) => {
      if (!accumulator.includes(item)) {
        accumulator.push(item);
      }

      return accumulator;
    }, []);

  return normalizedItems.filter(
    (item) =>
      !normalizedItems.some((otherItem) => isContainedPhrase(item, otherItem))
  );
}

export function extractItemsAndQuantityFromMessages(
  messages: ParsedChatMessage[],
  products: MenuProductContext[] = []
) {
  const items: string[] = [];
  let quantity: number | null = null;

  for (const message of messages) {
    if (
      message.senderType !== "customer" ||
      (!isPotentialOrderItemMessage(message.text) &&
        !isPotentialProductOrderMessage(message.text, products))
    ) {
      continue;
    }

    const productItems = extractProductItems(message.text, products);
    items.push(...productItems);

    for (const match of message.text.matchAll(quantityItemRegex)) {
      quantity ??= parseQuantityValue(match[1]);
    }

    for (const match of message.text.matchAll(quantityRegex)) {
      quantity ??= parseQuantityValue(match[1]);
    }

    if (productItems.length === 0) {
      items.push(...extractGenericItems(message.text));
    }
  }

  return {
    items: [...new Set(items.map((item) => item.trim()).filter(Boolean))],
    quantity
  };
}
