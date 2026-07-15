export function normalizeKeyword(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("zh-CN").replace(/\s+/gu, " ");
}

export function uniqueKeywords(values: readonly string[]): Array<{ value: string; normalizedValue: string }> {
  const seen = new Set<string>();
  const result: Array<{ value: string; normalizedValue: string }> = [];

  for (const rawValue of values) {
    const value = rawValue.trim();
    const normalizedValue = normalizeKeyword(value);
    if (normalizedValue.length === 0 || seen.has(normalizedValue)) continue;
    seen.add(normalizedValue);
    result.push({ value, normalizedValue });
  }

  return result;
}
