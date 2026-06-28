import type { Citation } from "../types/common.ts";

interface YouComResult {
  title?: unknown;
  url?: unknown;
  link?: unknown;
  description?: unknown;
  snippet?: unknown;
  snippets?: unknown;
}

interface YouComSearchResponse {
  results?: {
    web?: YouComResult[];
    news?: YouComResult[];
  };
  web?: YouComResult[];
  news?: YouComResult[];
  hits?: YouComResult[];
}

const DEFAULT_YOUCOM_SEARCH_URL = "https://ydc-index.io/v1/search";

export async function searchYouCom(query: string): Promise<Citation[]> {
  const key = readEnv("YOUCOM_API_KEY");
  if (!key) throw new Error("YOUCOM_API_KEY is required for evidence-grounded agent workflow.");

  const count = Number(readEnv("SEARCH_COUNT", "6")) || 6;
  const searchUrl = readEnv("YOUCOM_SEARCH_URL", DEFAULT_YOUCOM_SEARCH_URL);
  const url = new URL(searchUrl);
  url.searchParams.set("query", query);
  url.searchParams.set("count", String(count));

  const response = await fetch(url, {
    method: "GET",
    headers: { "X-API-Key": key },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`You.com ${response.status}: ${detail.slice(0, 300)}`);
  }

  const data = await response.json() as YouComSearchResponse;
  return normalizeYouComResults(data, count);
}

export function normalizeYouComResults(data: YouComSearchResponse, limit: number): Citation[] {
  const results = Array.isArray(data?.results?.web)
    ? [...data.results.web, ...(Array.isArray(data.results.news) ? data.results.news : [])]
    : [
      ...(Array.isArray(data?.web) ? data.web : []),
      ...(Array.isArray(data?.news) ? data.news : []),
      ...(Array.isArray(data?.hits) ? data.hits : []),
    ];

  const citations: Citation[] = [];
  for (const result of results) {
    const snippetParts = Array.isArray(result?.snippets)
      ? result.snippets
      : [result?.snippet, result?.description];
    const snippet = snippetParts
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(" ")
      .trim();
    const url = String(result?.url ?? result?.link ?? "").trim();

    if (!url || !snippet) continue;

    citations.push({
      title: String(result?.title ?? "").trim(),
      url,
      snippet,
    });

    if (citations.length >= limit) break;
  }

  return citations;
}

function readEnv(key: string, fallback = ""): string {
  const denoEnv = globalThis as typeof globalThis & {
    Deno?: { env?: { get?: (name: string) => string | undefined } };
  };
  const nodeProcess = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };

  return denoEnv.Deno?.env?.get?.(key) ?? nodeProcess.process?.env?.[key] ?? fallback;
}

