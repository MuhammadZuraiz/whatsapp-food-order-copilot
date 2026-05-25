export function extractJsonFromText(text: string) {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // Try fenced JSON first because many chat models wrap structured output.
  }

  const fencedJsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fencedJsonMatch) {
    try {
      return JSON.parse(fencedJsonMatch[1].trim()) as unknown;
    } catch {
      // Fall through to object recovery below.
    }
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
  }

  throw new Error("Provider output was not valid JSON.");
}
