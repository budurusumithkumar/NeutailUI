import type {
  AgentActivity,
  AgentStatus,
  ChatIntent,
  ChatResponse,
  CustomerContextSummary,
  FitResult,
  ProductCard,
  RiskBand,
  UpsellAction,
  UpsellResult,
} from "./types";

type UnknownRecord = Record<string, unknown>;

const chatIntents = new Set<ChatIntent>([
  "PRODUCT_DISCOVERY",
  "FIT_QUERY",
  "SERVICE_QUERY",
  "GENERAL_QUERY",
  "CLARIFICATION",
]);

const agentStatuses = new Set<AgentStatus>([
  "STARTED",
  "COMPLETED",
  "FAILED",
  "SKIPPED",
]);

const riskBands = new Set<RiskBand>(["LOW", "MEDIUM", "HIGH"]);
const upsellActions = new Set<UpsellAction>(["PRESENT_OFFER", "NO_OFFER"]);

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNullableString(value: unknown): string | null | undefined {
  return value === null ? null : asString(value);
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeProduct(value: unknown): ProductCard | null {
  const product = asRecord(value);
  if (!product) return null;

  const sku = asString(product.sku);
  const name = asString(product.name) ?? asString(product.product_name);
  const price = asNumber(product.price_gbp);
  if (!sku || !name || price === undefined) return null;

  const reasonCodes = asStringArray(product.reason_codes);
  const availableSizes = asStringArray(product.available_sizes);
  const available =
    typeof product.available === "boolean"
      ? product.available
      : reasonCodes.includes("IN_STOCK") || availableSizes.length > 0;

  return {
    sku,
    name,
    brand: asNullableString(product.brand),
    price_gbp: price,
    image_url: asNullableString(product.image_url),
    recommended_score:
      asNumber(product.recommended_score) ?? asNumber(product.score) ?? 0,
    reason_codes: reasonCodes,
    available,
    available_sizes: availableSizes,
  };
}

function normalizeProducts(response: UnknownRecord): ProductCard[] {
  const discoveryResult = asRecord(response.discovery_result);
  const source = Array.isArray(response.products)
    ? response.products
    : Array.isArray(discoveryResult?.recommendations)
      ? discoveryResult.recommendations
      : [];

  return source
    .map(normalizeProduct)
    .filter((product): product is ProductCard => product !== null);
}

function normalizeCustomerContext(value: unknown): CustomerContextSummary | null {
  const context = asRecord(value);
  if (!context) return null;

  const preferences = asRecord(context.preferences);
  return {
    segment: asNullableString(context.segment),
    loyalty_tier: asNullableString(context.loyalty_tier),
    preferred_colors: asStringArray(
      context.preferred_colors ?? preferences?.preferred_colors,
    ),
    preferred_styles: asStringArray(
      context.preferred_styles ?? preferences?.preferred_styles,
    ),
    usual_size: asNullableString(context.usual_size ?? preferences?.usual_size),
  };
}

function normalizeFit(value: unknown): FitResult | null {
  const fit = asRecord(value);
  if (!fit) return null;

  const riskBand = asString(fit.risk_band);
  return {
    sku: asString(fit.sku),
    requested_size: asNullableString(fit.requested_size),
    recommended_size: asNullableString(fit.recommended_size),
    confidence: asNumber(fit.confidence),
    risk_band: riskBand && riskBands.has(riskBand as RiskBand) ? (riskBand as RiskBand) : undefined,
    reason_codes: asStringArray(fit.reason_codes),
    explanation: asNullableString(fit.explanation),
  };
}

function normalizeUpsell(value: unknown): UpsellResult | null {
  const upsell = asRecord(value);
  if (!upsell) return null;

  const action = asString(upsell.action);
  return {
    eligible: typeof upsell.eligible === "boolean" ? upsell.eligible : undefined,
    action:
      action && upsellActions.has(action as UpsellAction)
        ? (action as UpsellAction)
        : undefined,
    service_code: asNullableString(upsell.service_code),
    service_name: asNullableString(upsell.service_name),
    message: asNullableString(upsell.message),
    reason_codes: asStringArray(upsell.reason_codes),
  };
}

function normalizeAgentActivity(response: UnknownRecord): AgentActivity[] {
  if (Array.isArray(response.agent_activity)) {
    return response.agent_activity.flatMap((value): AgentActivity[] => {
      const activity = asRecord(value);
      const agent = asString(activity?.agent);
      const status = asString(activity?.status);
      if (!agent || !status || !agentStatuses.has(status as AgentStatus)) return [];

      return [
        {
          agent,
          status: status as AgentStatus,
          duration_ms: asNumber(activity?.duration_ms) ?? null,
        },
      ];
    });
  }

  const completedAgents = new Set(asStringArray(response.completed_agents));
  const failedAgents = new Set(
    (Array.isArray(response.errors) ? response.errors : []).flatMap((value): string[] => {
      const error = asRecord(value);
      const agent = asString(error?.agent);
      return agent ? [agent] : [];
    }),
  );

  return asStringArray(response.execution_plan).map((agent) => ({
    agent,
    status: completedAgents.has(agent)
      ? "COMPLETED"
      : failedAgents.has(agent)
        ? "FAILED"
        : "SKIPPED",
    duration_ms: null,
  }));
}

/**
 * Converts both the checked-in OpenAPI response and the backend's current
 * orchestration response into the stable model consumed by the UI.
 */
export function normalizeChatResponse(payload: unknown): ChatResponse {
  const response = asRecord(payload);
  if (!response) {
    throw new Error("Neu.Tail returned an invalid chat response.");
  }

  const sessionId = asString(response.session_id);
  const message = asString(response.message) ?? asString(response.response);
  if (!sessionId || message === undefined) {
    throw new Error("Neu.Tail returned an incomplete chat response.");
  }

  const rawIntent = asString(response.intent);
  const intent =
    rawIntent && chatIntents.has(rawIntent as ChatIntent)
      ? (rawIntent as ChatIntent)
      : "GENERAL_QUERY";

  const rawFit = response.fit !== undefined ? response.fit : response.fit_result;
  const rawUpsell =
    response.upsell !== undefined ? response.upsell : response.upsell_result;

  return {
    trace_id: asString(response.trace_id) ?? "",
    session_id: sessionId,
    intent,
    message,
    customer_context: normalizeCustomerContext(response.customer_context),
    products: normalizeProducts(response),
    fit: normalizeFit(rawFit),
    upsell: normalizeUpsell(rawUpsell),
    agent_activity: normalizeAgentActivity(response),
  };
}
