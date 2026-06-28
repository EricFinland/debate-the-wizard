import { config } from "./env";

export interface ChatMessage {
  role: string;
  content: string;
}

export async function chat(model: string, messages: ChatMessage[], temperature = 0): Promise<string> {
  const openRouterKey = config.openRouterApiKey();
  if (openRouterKey) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openRouterKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, temperature }),
    });
    if (!res.ok) throw new Error(`Gateway ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
  }

  const base = config.insforgeApiUrl();
  const apiKey = config.insforgeApiKey();
  if (!base || !apiKey) throw new Error("OPENROUTER_API_KEY or INSFORGE_API_URL / INSFORGE_API_KEY not configured.");

  const res = await fetch(`${base}/api/ai/chat/completion`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature }),
  });
  if (!res.ok) throw new Error(`Gateway ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  const data = await res.json();
  return data?.text ?? data?.choices?.[0]?.message?.content ?? "";
}
