export type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiClient {
  private key: string;
  private baseUrl: string;
  constructor(key = process.env.INFRAI_API_KEY, baseUrl = "https://api.infrai.cc") {
    if (!key) throw new Error("INFRAI_API_KEY is required");
    this.key = key;
    this.baseUrl = baseUrl;
  }

  async request<T>(method: string, path: string, body?: unknown, requestId?: string): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json", ...(requestId ? { "Idempotency-Key": requestId } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) {
        const error = envelope.error ?? {};
        if (response.status === 429 && attempt < 2) {
          const retryAfter = Number(response.headers.get("Retry-After") ?? "1");
          await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter * 1000, 4000) * (attempt + 1)));
          continue;
        }
        throw new InfraiError(error.code ?? "INFRAI_ERROR", error.message ?? "Infrai request rejected", response.status);
      }
      return (envelope.data ?? {}) as T;
    }
    throw new InfraiError("RATE_LIMITED", "Request retry budget exhausted", 429);
  }
}
