import type { Citation } from "../../../../shared/contracts/debate";
import { config, env } from "./env";

export interface YouComResult {
  title?: unknown;
  url?: unknown;
  link?: unknown;
  description?: unknown;
  snippet?: unknown;
  snippets?: unknown;
}

export interface YouComSearchResponse {
  results?: { web?: YouComResult[]; news?: YouComResult[] } | YouComResult[];
  web?: YouComResult[];
  news?: YouComResult[];
  hits?: YouComResult[];
}

export function normalizeYouComResults(data: YouComSearchResponse, limit = config.searchCount()): Citation[] {
  const results = Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data?.results?.web)
      ? [...data.results.web, ...(Array.isArray(data.results.news) ? data.results.news : [])]
      : [
          ...(Array.isArray(data?.web) ? data.web : []),
          ...(Array.isArray(data?.news) ? data.news : []),
          ...(Array.isArray(data?.hits) ? data.hits : []),
        ];

  const out: Citation[] = [];
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
    out.push({
      title: String(result?.title ?? "").trim(),
      url,
      snippet,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function searchYouCom(query: string): Promise<Citation[]> {
  const apiKey = env("YOUCOM_API_KEY");
  if (!apiKey) throw new Error("YOUCOM_API_KEY not set.");

  const url = new URL(config.youcomSearchUrl());
  url.searchParams.set("query", query);
  url.searchParams.set("count", String(config.searchCount()));

  const res = await fetch(url, {
    method: "GET",
    headers: { "X-API-Key": apiKey },
  });
  if (!res.ok) throw new Error(`You.com ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  return normalizeYouComResults((await res.json()) as YouComSearchResponse, config.searchCount());
}
