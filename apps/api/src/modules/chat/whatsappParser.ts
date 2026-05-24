import type { ParsedChatMessage, SenderType } from "./chat.schemas.js";

type ParserResult = {
  messages: ParsedChatMessage[];
  warnings: string[];
};

type ParsedStartLine = {
  timestamp: string | null;
  senderName: string | null;
  text: string;
};

const formatARegex = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s+(.+?)\s-\s([\s\S]+)$/;
const bracketedRegex = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s+(.+?)\]\s([\s\S]+)$/;
const mediaOmittedRegex =
  /(<media omitted>|image omitted|video omitted|audio omitted|sticker omitted|document omitted)/i;

function normalizeName(name: string) {
  return name.trim().toLocaleLowerCase();
}

function parseDateTime(datePart: string, timePart: string) {
  const dateMatch = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);

  if (!dateMatch) {
    return null;
  }

  const [, dayText, monthText, yearText] = dateMatch;
  const day = Number(dayText);
  const month = Number(monthText);
  const year =
    yearText.length === 2 ? Number(`20${yearText}`) : Number(yearText);

  const timeMatch = timePart
    .trim()
    .match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm)?$/i);

  if (!timeMatch) {
    return null;
  }

  const [, hourText, minuteText = "0", secondText = "0", period] = timeMatch;
  let hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);

  if (period) {
    const normalizedPeriod = period.toLocaleLowerCase();

    if (normalizedPeriod === "pm" && hour < 12) {
      hour += 12;
    }

    if (normalizedPeriod === "am" && hour === 12) {
      hour = 0;
    }
  }

  const date = new Date(year, month - 1, day, hour, minute, second);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date.toISOString();
}

function splitSender(content: string) {
  const senderMatch = content.match(/^([^:\n]{1,80}):\s*([\s\S]*)$/);

  if (!senderMatch) {
    return {
      senderName: null,
      text: content.trim()
    };
  }

  return {
    senderName: senderMatch[1].trim(),
    text: senderMatch[2].trim()
  };
}

function parseStartLine(line: string): ParsedStartLine | null {
  const formatAMatch = line.match(formatARegex);
  const bracketedMatch = line.match(bracketedRegex);
  const match = formatAMatch ?? bracketedMatch;

  if (!match) {
    return null;
  }

  const [, datePart, timePart, content] = match;
  const sender = splitSender(content);

  return {
    timestamp: parseDateTime(datePart, timePart),
    senderName: sender.senderName,
    text: sender.text
  };
}

function getSenderType(
  senderName: string | null,
  businessSenderNames: Set<string>
): SenderType {
  if (!senderName) {
    return "unknown";
  }

  return businessSenderNames.has(normalizeName(senderName))
    ? "business"
    : "customer";
}

export function parseWhatsAppExport(
  rawText: string,
  businessSenderNames: string[]
): ParserResult {
  const warnings: string[] = [];
  const messages: ParsedChatMessage[] = [];
  const businessNames = new Set(businessSenderNames.map(normalizeName));
  const lines = rawText.replace(/\r\n/g, "\n").split("\n");

  let current: ParsedChatMessage | null = null;

  function pushCurrent() {
    if (current) {
      messages.push(current);
    }
  }

  for (const line of lines) {
    const parsedLine = parseStartLine(line);

    if (!parsedLine) {
      if (!current) {
        const text = line.trim();

        if (text) {
          messages.push({
            senderName: null,
            senderType: "unknown",
            text,
            timestamp: null,
            raw: line
          });
          warnings.push(
            "Found a line without a WhatsApp timestamp; kept it as an unknown message."
          );
        }

        continue;
      }

      current.text = `${current.text}\n${line}`.trim();
      current.raw = `${current.raw}\n${line}`;
      continue;
    }

    pushCurrent();

    if (!parsedLine.timestamp) {
      warnings.push(`Could not parse timestamp for line: ${line}`);
    }

    if (!parsedLine.senderName) {
      warnings.push(`Found a system message without a sender: ${line}`);
    }

    if (mediaOmittedRegex.test(parsedLine.text)) {
      warnings.push("Found a media omitted message; kept it as text.");
    }

    current = {
      senderName: parsedLine.senderName,
      senderType: getSenderType(parsedLine.senderName, businessNames),
      text: parsedLine.text,
      timestamp: parsedLine.timestamp,
      raw: line
    };
  }

  pushCurrent();

  if (messages.length === 0) {
    warnings.push("No messages could be parsed from the provided chat text.");
  }

  return {
    messages,
    warnings
  };
}
