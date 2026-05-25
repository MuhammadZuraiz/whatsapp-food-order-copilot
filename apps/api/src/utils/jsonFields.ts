export function toJsonField(value: unknown) {
  return JSON.stringify(value);
}

export function parseJsonField<T>(value: string | null | undefined, fallback: T) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
