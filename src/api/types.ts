// Mirrors components/schemas in ../../NeuTail_Mission4_UI_Backend_OpenAPI.json 1:1.
// Field names/nullability are kept identical to the contract so a schema diff is easy to spot.

export type Role = "customer" | "stylist" | "admin";

export interface AuthUser {
  customer_id: string;
  display_name: string;
  email?: string | null;
  role: Role;
}

export interface LoginRequest {
  email: string;
  password: string;
}

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

// NOTE: never add customer_id here — identity comes from the JWT (docs/03-api-integration.md).
export interface ChatRequest {
  session_id: string;
  message: string;
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
  recommended_score: number;
  reason_codes: string[];
  available: boolean;
  available_sizes?: string[];
}

export type RiskBand = "LOW" | "MEDIUM" | "HIGH";

export interface FitResult {
  sku?: string;
  requested_size?: string | null;
  recommended_size?: string | null;
  confidence?: number;
  risk_band?: RiskBand;
  reason_codes?: string[];
  explanation?: string | null;
}

export type UpsellAction = "PRESENT_OFFER" | "NO_OFFER";

export interface UpsellResult {
  eligible?: boolean;
  action?: UpsellAction;
  service_code?: string | null;
  service_name?: string | null;
  message?: string | null;
  reason_codes?: string[];
}

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
