export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

export function withMethods(methods: string[]) {
  return {
    ...corsHeaders,
    "Access-Control-Allow-Methods": [...methods, "OPTIONS"].join(", "),
  };
}

export function json(body: unknown, status = 200, methods: string[] = ["GET", "POST"]): Response {
  return new Response(JSON.stringify(body), { status, headers: withMethods(methods) });
}

export function options(methods: string[] = ["GET", "POST"]): Response {
  return new Response("ok", { headers: withMethods(methods) });
}

export function methodNotAllowed(message = "Use POST.", methods: string[] = ["POST"]): Response {
  return json({ error: message }, 405, methods);
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
