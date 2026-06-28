export function stripFences(value: string): string {
  return value.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
}

export function parseModelJson<T>(text: string): T | null {
  const cleaned = stripFences(text);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}
