declare const Deno: { env: { get(key: string): string | undefined } };

export function env(key: string, fallback = ""): string {
  return Deno.env.get(key) ?? fallback;
}

export function numberEnv(key: string, fallback: number): number {
  const value = Number(env(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function requireEnv(keys: string[]): string | null {
  const missing = keys.filter((key) => !env(key));
  return missing.length ? `${missing.join(" / ")} not configured.` : null;
}

export const config = {
  judgeModel: () => env("JUDGE_MODEL", "anthropic/claude-sonnet-4.6"),
  extractModel: () => env("EXTRACT_MODEL", "anthropic/claude-haiku-4.5"),
  searchCount: () => numberEnv("SEARCH_COUNT", 6),
  youcomSearchUrl: () => env("YOUCOM_SEARCH_URL", "https://api.you.com/v1/search"),
  insforgeApiUrl: () => env("INSFORGE_API_URL").replace(/\/+$/, ""),
  insforgeDataUrl: () => (env("INSFORGE_DATA_URL") || env("INSFORGE_API_URL")).replace(/\/+$/, ""),
  insforgeApiKey: () => env("INSFORGE_API_KEY"),
  openRouterApiKey: () => env("OPENROUTER_API_KEY"),
};
