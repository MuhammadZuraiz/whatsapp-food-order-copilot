import type { ParsedChatMessage } from "./chat.schemas.js";

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

function parseQuantityValue(value: string) {
  const normalized = value.toLocaleLowerCase();
  const quantity = numberWords.get(normalized) ?? Number(normalized);

  return Number.isFinite(quantity) ? quantity : null;
}

function hasOrderIntent(text: string) {
  return /\b(i want|i need|i would like|i'd like|can i get|please order|place an order|order|book|deliver|delivery|same order|same as last)\b/i.test(
    text
  );
}

function hasQuantityItem(text: string) {
  return new RegExp(quantityItemRegex).test(text);
}

function isPotentialOrderItemMessage(text: string) {
  return hasQuantityItem(text) || (hasOrderIntent(text) && new RegExp(itemRegex).test(text));
}

function extractItemPhrases(text: string) {
  return [...text.matchAll(itemRegex)].map((match) => match[1]);
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
  messages: ParsedChatMessage[]
) {
  const items: string[] = [];
  let quantity: number | null = null;

  for (const message of messages) {
    if (message.senderType !== "customer" || !isPotentialOrderItemMessage(message.text)) {
      continue;
    }

    for (const match of message.text.matchAll(quantityItemRegex)) {
      quantity ??= parseQuantityValue(match[1]);
      items.push(match[2]);
    }

    for (const match of message.text.matchAll(quantityRegex)) {
      quantity ??= parseQuantityValue(match[1]);
    }

    items.push(...extractItemPhrases(message.text));
  }

  return {
    items: normalizeOrderItems(items),
    quantity
  };
}
