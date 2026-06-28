import { parseModelJson } from "./json_parser.ts";

interface CallModelJsonInput {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

interface ChatCompletionResponse {
  text?: string;
}

export async function callModelJson<T>({
  systemPrompt,
  userPrompt,
  temperature = 0.2,
}: CallModelJsonInput): Promise<T> {
  const baseUrl = readEnv("INSFORGE_API_URL").replace(/\/+$/, "");
  const apiKey = readEnv("INSFORGE_API_KEY");
  const model = readEnv("AGENT_WORKFLOW_MODEL", readEnv("JUDGE_MODEL", "gpt-5.4-mini"));

  if (!baseUrl || !apiKey) {
    throw new Error("InsForge Model Gateway is not configured. Set INSFORGE_API_URL and INSFORGE_API_KEY.");
  }

  const response = await fetch(`${baseUrl}/api/ai/chat/completion`, {
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
  const content = data.text;
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
