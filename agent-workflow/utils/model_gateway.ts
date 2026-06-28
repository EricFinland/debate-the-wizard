import { parseModelJson } from "./json_parser.ts";

interface CallModelJsonInput {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

interface ChatCompletionResponse {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
}

export async function callModelJson<T>({
  systemPrompt,
  userPrompt,
  temperature = 0.2,
}: CallModelJsonInput): Promise<T> {
  const baseUrl = readEnv("INSFORGE_API_URL").replace(/\/+$/, "");
  const apiKey = readEnv("INSFORGE_API_KEY");
  const model = readEnv("AGENT_WORKFLOW_MODEL", "anthropic/claude-3.5-sonnet");

  if (!baseUrl || !apiKey) {
    throw new Error("InsForge Model Gateway is not configured. Set INSFORGE_API_URL and INSFORGE_API_KEY.");
  }

  // TODO: Replace this OpenAI-compatible fallback with the exact InsForge SDK/native
  // gateway call once the backend integration details are finalized.
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`InsForge Model Gateway ${response.status}: ${detail.slice(0, 300)}`);
  }

  const data = await response.json() as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("InsForge Model Gateway returned an empty response.");
  }

  return parseModelJson<T>(content);
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

