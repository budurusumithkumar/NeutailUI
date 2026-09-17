# Data Models

TypeScript types the frontend will use. Most mirror `components/schemas` in the checked-in OpenAPI contract. `ChatResponse` is the stable UI model produced by the response adapter because the live orchestrator response is richer than the current OpenAPI file. The cart model is client-only and has no backend equivalent yet (Gap #1).

## From the OpenAPI contract (`src/api/types.ts`)

```ts
export type Role = "customer" | "stylist" | "admin";

export interface AuthUser {
  customer_id: string;
  display_name: string;
  email?: string | null;
  role: Role;
}

export interface LoginRequest { email: string; password: string }
export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

export type SessionStatus = "ACTIVE" | "CLOSED";
export interface SessionResponse {
  session_id: string;
  customer_id: string;
  status: SessionStatus;
  created_at: string;
  updated_at?: string | null;
  turn_count: number;
}

export interface SessionContext {
  session_id: string;
  customer_id: string;
  current_intent?: string | null;
  occasion?: string | null;
  category?: string | null;
  selected_sku?: string | null;
  requested_size?: string | null;
  last_agent?: string | null;
  turn_count: number;
  attributes: Record<string, unknown>;
}

// NOTE: never add customer_id here — identity comes from the JWT (see 03-api-integration.md).
export interface ChatRequest {
  session_id: string;
  message: string; // 1..4000 chars
  selected_sku?: string | null;
}

export interface CustomerContextSummary {
  segment?: string | null;
  loyalty_tier?: string | null;
  preferred_colors: string[];
  preferred_styles: string[];
  usual_size?: string | null;
}

export interface ProductCard {
  sku: string;
  name: string;
  brand?: string | null;
  price_gbp: number;
  image_url?: string | null;
  recommended_score: number; // 0..1
  reason_codes: string[];
  available: boolean;
  available_sizes?: string[];
}

export type RiskBand = "LOW" | "MEDIUM" | "HIGH";
export interface FitResult {
  sku?: string;
  requested_size?: string | null;
  recommended_size?: string | null;
  confidence?: number; // 0..1
  risk_band?: RiskBand;
  reason_codes?: string[];
  explanation?: string | null;
}

export type UpsellStatus = "OFFER_AVAILABLE" | "NO_OFFER" | "FAILED";
export type OpportunityBand = "LOW" | "MEDIUM" | "HIGH";
export type ServiceOfferType =
  | "STYLING_ADVISORY"
  | "STYLE_PLUS_TRIAL"
  | "STYLE_PLUS";

export interface ServiceOffer {
  offer_type: ServiceOfferType | string;
  title: string;
  description?: string | null;
  requires_explicit_consent: boolean;
  priority?: number;
}

export interface UpsellResult {
  status: UpsellStatus;
  should_offer: boolean;
  offer?: ServiceOffer | null;
  opportunity_score?: number | null;
  opportunity_band?: OpportunityBand | null;
  eligibility_reasons: string[];
  suppression_reasons: string[];
  message?: string | null;
  requires_customer_consent: boolean;
  decision_id?: string | null;
  trigger_type?: string | null;
  trigger_strength?: number | null;
  llm_invoked?: boolean | null;
}

export interface UpsellTrigger {
  trigger_type: string;
  source_agent: string;
  sku?: string | null;
  strength?: number | null;
  metadata?: Record<string, unknown>;
}

export interface EngagementEventInput {
  session_id: string;
  event_type: "PRODUCT_VIEWED";
  sku: string;
  idempotency_key: string;
  metadata?: Record<string, unknown>;
}

export interface EngagementEventResponse {
  event_id: string;
  recorded: boolean;
  engagement_count: number;
  trigger: UpsellTrigger | null;
  trace_id: string;
  upsell_result: UpsellResult | null;
}

export type UpsellDecisionEventType =
  | "OFFER_ACCEPTED"
  | "OFFER_DECLINED"
  | "OFFER_DISMISSED";

export type AgentStatus = "STARTED" | "COMPLETED" | "FAILED" | "SKIPPED";
export interface AgentActivity {
  agent: string;
  status: AgentStatus;
  duration_ms?: number | null;
}

export type ChatIntent =
  | "PRODUCT_DISCOVERY"
  | "FIT_QUERY"
  | "SERVICE_QUERY"
  | "CUSTOMER_CONTEXT"
  | "GENERAL_QUERY"
  | "CLARIFICATION";

export interface ChatResponse {
  trace_id: string;
  session_id: string;
  intent: ChatIntent;
  message: string;
  customer_context?: CustomerContextSummary | null;
  products: ProductCard[];
  fit?: FitResult | null;
  upsell?: UpsellResult | null;
  agent_activity: AgentActivity[];
}

export interface CustomerSummary {
  customer_id: string;
  display_name: string;
  city?: string | null;
  segment?: string | null;
  loyalty_tier?: string | null;
  points_balance?: number | null;
  preferred_categories: string[];
  preferred_colors: string[];
  preferred_styles: string[];
  usual_size?: string | null;
  fit_preference?: string | null;
}

export interface ErrorResponse {
  error_code: string;
  message: string;
  trace_id?: string | null;
  details?: Record<string, unknown> | null;
}
```

## Client-only (`src/cart/types.ts`) — no backend schema exists (Gap #1)

```ts
export interface CartItem {
  sku: string;               // ProductCard.sku
  name: string;
  brand?: string | null;
  price_gbp: number;
  image_url?: string | null;
  size?: string | null;      // chosen at add-to-cart time, if available_sizes was shown
  quantity: number;
}

export interface CartRepository {
  getItems(): CartItem[];
  addItem(item: Omit<CartItem, "quantity">, quantity?: number): void;
  updateQuantity(sku: string, size: string | null, quantity: number): void;
  removeItem(sku: string, size: string | null): void;
  clear(): void;
}
```
