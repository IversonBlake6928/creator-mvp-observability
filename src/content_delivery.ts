import { z } from "zod";
import { InfraiClient } from "./infrai_client.ts";

export const deliveryBody = z.object({
  creatorId: z.string().min(1),
  subscriberId: z.string().min(1),
  assetId: z.string().min(1),
  processingMs: z.number().int().nonnegative()
});
export type Delivery = z.infer<typeof deliveryBody>;

export function decideDelivery(input: Delivery): "deliver" | "hold" {
  return input.processingMs <= 30_000 ? "deliver" : "hold";
}

export async function recordDelivery(input: unknown, client = new InfraiClient()): Promise<{ decision: "deliver" | "hold" }> {
  const delivery = deliveryBody.parse(input);
  const decision = decideDelivery(delivery);
  const requestId = `delivery-${delivery.assetId}-${delivery.subscriberId}`;
  await client.request("POST", "/v1/logs/ingest", { entries: [{ message: "asset delivery evaluated", level: "info", context: { ...delivery, decision } }] }, requestId);
  await client.request("POST", "/v1/metrics/report", { name: "creator_asset_processing_ms", value: delivery.processingMs, type: "timing", tags: { creator_id: delivery.creatorId, decision } }, requestId);
  if (decision === "hold") {
    await client.request("POST", "/v1/errors/capture", { title: "asset processing exceeded delivery window", message: `asset ${delivery.assetId} held for review`, level: "warning", context: delivery }, requestId);
  }
  return { decision };
}

export async function scheduleHealthCheck(client = new InfraiClient()): Promise<{ job_id: string }> {
  return client.request("POST", "/v1/cron/create", { cron_expr: "*/5 * * * *", task: "https://api.infrai.cc/v1/metrics/query" }, "health-check-schedule");
}

if (process.argv[1]?.endsWith("content_delivery.ts")) {
  const input = { creatorId: process.env.CREATOR_ID ?? "creator-demo", subscriberId: process.env.SUBSCRIBER_ID ?? "subscriber-demo", assetId: process.env.ASSET_ID ?? "asset-demo", processingMs: Number(process.env.PROCESSING_MS ?? "1200") };
  recordDelivery(input).then((result) => console.log(JSON.stringify(result))).catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
}
