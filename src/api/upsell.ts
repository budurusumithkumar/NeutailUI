import { apiClient } from "./client";
import { normalizeUpsellResult } from "./chatResponseAdapter";
import type {
  EngagementEventInput,
  EngagementEventResponse,
  PendingUpsellDecision,
  UpsellDecisionEventInput,
  UpsellDecisionEventResponse,
  UpsellDecisionEventType,
} from "./types";

export async function getPendingUpsellDecisions(): Promise<PendingUpsellDecision[]> {
  const { data } = await apiClient.get<PendingUpsellDecision[]>(
    "/api/v1/upsell/decisions/pending",
  );
  return data;
}

type WireEngagementEventResponse = Omit<
  EngagementEventResponse,
  "upsell_result"
> & {
  upsell_result: unknown;
};

interface ProductViewOptions {
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export async function recordProductView(
  sessionId: string,
  sku: string,
  options: ProductViewOptions = {},
): Promise<EngagementEventResponse> {
  const payload: EngagementEventInput = {
    session_id: sessionId,
    event_type: "PRODUCT_VIEWED",
    sku,
    idempotency_key:
      options.idempotencyKey ?? `product-view-${crypto.randomUUID()}`,
    metadata: {
      source: "PRODUCT_DETAIL",
      ...options.metadata,
    },
  };

  const { data } = await apiClient.post<WireEngagementEventResponse>(
    "/api/v1/engagement/events",
    payload,
  );

  return {
    ...data,
    upsell_result: normalizeUpsellResult(
      data.upsell_result,
      data as unknown as Record<string, unknown>,
    ),
  };
}

export async function recordUpsellDecisionEvent(
  decisionId: string,
  sessionId: string,
  eventType: UpsellDecisionEventType,
): Promise<UpsellDecisionEventResponse> {
  const payload: UpsellDecisionEventInput = {
    session_id: sessionId,
    event_type: eventType,
    idempotency_key: `${decisionId}-${eventType}`,
  };

  const { data } = await apiClient.post<UpsellDecisionEventResponse>(
    `/api/v1/upsell/decisions/${encodeURIComponent(decisionId)}/events`,
    payload,
  );
  return data;
}
