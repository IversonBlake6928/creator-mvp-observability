import assert from "node:assert/strict";
import { decideDelivery, deliveryBody } from "./content_delivery.ts";

const request = deliveryBody.parse({ creatorId: "clinic-creator", subscriberId: "member-7", assetId: "lesson-1", processingMs: 31_000 });
assert.equal(decideDelivery(request), "hold");
assert.equal(decideDelivery({ ...request, processingMs: 30_000 }), "deliver");
console.log("content delivery decision test passed");
