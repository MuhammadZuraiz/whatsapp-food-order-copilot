import type { ParsedChatMessage } from "./chat.schemas.js";

type DateParts = {
  year: number;
  month: number;
  day: number;
};

const monthIndexes = new Map([
  ["jan", 1],
  ["january", 1],
  ["feb", 2],
  ["february", 2],
  ["mar", 3],
  ["march", 3],
  ["apr", 4],
  ["april", 4],
  ["may", 5],
  ["jun", 6],
  ["june", 6],
  ["jul", 7],
  ["july", 7],
  ["aug", 8],
  ["august", 8],
  ["sep", 9],
  ["sept", 9],
  ["september", 9],
  ["oct", 10],
  ["october", 10],
  ["nov", 11],
  ["november", 11],
  ["dec", 12],
  ["december", 12]
]);

const weekdayIndexes = new Map([
  ["sunday", 0],
  ["monday", 1],
  ["tuesday", 2],
  ["wednesday", 3],
  ["thursday", 4],
  ["friday", 5],
  ["saturday", 6]
]);

function normalize(text: string) {
  return text.toLocaleLowerCase();
}

function toDateOnly(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("-");
}

function fromParts(parts: DateParts) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

function addDays(parts: DateParts, days: number) {
  const date = fromParts(parts);
  date.setUTCDate(date.getUTCDate() + days);

  return toDateOnly(date);
}

function currentDateParts(): DateParts {
  const now = new Date();

  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate()
  };
}

function messageDateParts(message: ParsedChatMessage): DateParts {
  const rawDateMatch = message.raw.match(/^\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);

  if (rawDateMatch) {
    const [, dayText, monthText, yearText] = rawDateMatch;
    return {
      year: yearText.length === 2 ? Number(`20${yearText}`) : Number(yearText),
      month: Number(monthText),
      day: Number(dayText)
    };
  }

  if (message.timestamp) {
    const date = new Date(message.timestamp);

    if (!Number.isNaN(date.getTime())) {
      return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate()
      };
    }
  }

  return currentDateParts();
}

function parseNumericDate(text: string, baseDate: DateParts) {
  const match = text.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/);

  if (!match) {
    return null;
  }

  const [, dayText, monthText, yearText] = match;
  const year = yearText
    ? yearText.length === 2
      ? Number(`20${yearText}`)
      : Number(yearText)
    : baseDate.year;
  const date = fromParts({
    year,
    month: Number(monthText),
    day: Number(dayText)
  });

  return Number.isNaN(date.getTime()) ? null : toDateOnly(date);
}

function parseTextualDate(text: string, baseDate: DateParts) {
  const match = text.match(
    /\b(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i
  );

  if (!match) {
    return null;
  }

  const [, dayText, monthText] = match;
  const month = monthIndexes.get(normalize(monthText));

  if (!month) {
    return null;
  }

  const date = fromParts({
    year: baseDate.year,
    month,
    day: Number(dayText)
  });

  return Number.isNaN(date.getTime()) ? null : toDateOnly(date);
}

function nextWeekday(dayIndex: number, baseDate: DateParts) {
  const date = fromParts(baseDate);
  const currentDay = date.getUTCDay();
  const daysUntilTarget = (dayIndex - currentDay + 7) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + daysUntilTarget);

  return toDateOnly(date);
}

function extractDeliveryDateFromText(text: string, baseDate: DateParts) {
  const normalized = normalize(text);

  if (/\btomorrow\b/.test(normalized)) {
    return addDays(baseDate, 1);
  }

  if (/\btoday\b/.test(normalized)) {
    return toDateOnly(fromParts(baseDate));
  }

  const numericDate = parseNumericDate(normalized, baseDate);

  if (numericDate) {
    return numericDate;
  }

  const textualDate = parseTextualDate(text, baseDate);

  if (textualDate) {
    return textualDate;
  }

  for (const [weekday, index] of weekdayIndexes) {
    if (new RegExp(`\\b${weekday}\\b`, "i").test(text)) {
      return nextWeekday(index, baseDate);
    }
  }

  return null;
}

export function extractDeliveryDateFromMessages(messages: ParsedChatMessage[]) {
  let deliveryDate: string | null = null;

  for (const message of messages) {
    if (message.senderType !== "customer") {
      continue;
    }

    deliveryDate =
      extractDeliveryDateFromText(message.text, messageDateParts(message)) ??
      deliveryDate;
  }

  return deliveryDate;
}
