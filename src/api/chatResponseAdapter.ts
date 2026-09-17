import type {
  AgentActivity,
  AgentStatus,
  ChatIntent,
  ChatResponse,
  CustomerContextSummary,
  FitResult,
  OpportunityBand,
  ProductCard,
  RiskBand,
  ServiceOffer,
  UpsellStatus,
  UpsellResult,
} from "./types";

type UnknownRecord = Record<string, unknown>;

const chatIntents = new Set<ChatIntent>([
  "PRODUCT_DISCOVERY",
  "FIT_QUERY",
  "SERVICE_QUERY",
  "CUSTOMER_CONTEXT",
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
const opportunityBands = new Set<OpportunityBand>(["LOW", "MEDIUM", "HIGH"]);
const upsellStatuses = new Set<UpsellStatus>([
  "OFFER_AVAILABLE",
  "NO_OFFER",
  "FAILED",
]);

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

function normalizeOffer(upsell: UnknownRecord): ServiceOffer | null {
  const nestedOffer = asRecord(upsell.offer);
  const offerType =
    asString(nestedOffer?.offer_type) ??
    asString(upsell.service_code) ??
    asString(upsell.selected_offer);
  const title = asString(nestedOffer?.title) ?? asString(upsell.service_name);

  if (!offerType && !title) return null;

  return {
    offer_type: offerType ?? "SERVICE_OFFER",
    title: title ?? offerType?.replaceAll("_", " ").toLowerCase() ?? "Neu.Tail service",
    description: asNullableString(nestedOffer?.description),
    requires_explicit_consent:
      typeof nestedOffer?.requires_explicit_consent === "boolean"
        ? nestedOffer.requires_explicit_consent
        : true,
    priority: asNumber(nestedOffer?.priority),
  };
}

export function normalizeUpsellResult(
  value: unknown,
  response?: UnknownRecord,
): UpsellResult | null {
  const upsell = asRecord(value);
  if (!upsell) return null;

  const legacyAction = asString(upsell.action);
  const explicitShouldOffer =
    typeof upsell.should_offer === "boolean" ? upsell.should_offer : undefined;
  const shouldOffer =
    explicitShouldOffer ??
    (typeof upsell.eligible === "boolean"
      ? upsell.eligible && legacyAction !== "NO_OFFER"
      : legacyAction === "PRESENT_OFFER");

  const rawStatus = asString(upsell.status);
  const status =
    rawStatus && upsellStatuses.has(rawStatus as UpsellStatus)
      ? (rawStatus as UpsellStatus)
      : shouldOffer
        ? "OFFER_AVAILABLE"
        : "NO_OFFER";

  const rawOpportunityBand = asString(upsell.opportunity_band);
  const trigger =
    asRecord(upsell.trigger) ??
    asRecord(response?.upsell_trigger) ??
    asRecord(response?.trigger);

  return {
    status,
    should_offer: shouldOffer && status === "OFFER_AVAILABLE",
    offer: normalizeOffer(upsell),
    opportunity_score: asNumber(upsell.opportunity_score) ?? null,
    opportunity_band:
      rawOpportunityBand &&
      opportunityBands.has(rawOpportunityBand as OpportunityBand)
        ? (rawOpportunityBand as OpportunityBand)
        : null,
    eligibility_reasons: asStringArray(
      upsell.eligibility_reasons ?? upsell.reason_codes,
    ),
    suppression_reasons: asStringArray(upsell.suppression_reasons),
    message: asNullableString(upsell.message),
    requires_customer_consent:
      typeof upsell.requires_customer_consent === "boolean"
        ? upsell.requires_customer_consent
        : true,
    decision_id:
      asNullableString(upsell.decision_id) ??
      asNullableString(upsell.offer_instance_id),
    trigger_type:
      asNullableString(upsell.trigger_type) ??
      asNullableString(trigger?.trigger_type),
    trigger_strength:
      asNumber(upsell.trigger_strength) ?? asNumber(trigger?.strength) ?? null,
    llm_invoked:
      typeof upsell.llm_invoked === "boolean" ? upsell.llm_invoked : null,
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
  const agentOutputs = asRecord(response.agent_outputs);
  const upsellAgentOutput =
    asRecord(agentOutputs?.upsell_agent) ?? asRecord(agentOutputs?.UpsellAgent);
  const rawUpsell =
    response.upsell !== undefined
      ? response.upsell
      : response.upsell_result !== undefined
        ? response.upsell_result
        : upsellAgentOutput?.upsell_result;

  return {
    trace_id: asString(response.trace_id) ?? "",
    session_id: sessionId,
    intent,
    message,
    customer_context: normalizeCustomerContext(response.customer_context),
    products: normalizeProducts(response),
    fit: normalizeFit(rawFit),
    upsell: normalizeUpsellResult(rawUpsell, response),
    agent_activity: normalizeAgentActivity(response),
  };
}
