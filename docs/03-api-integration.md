# API Integration Map

Sources of truth: [`NeuTail_Mission4_UI_Backend_OpenAPI.json`](../NeuTail_Mission4_UI_Backend_OpenAPI.json) and the additive [`NeuTail_Upsell_UI_Backend_OpenAPI.json`](../NeuTail_Upsell_UI_Backend_OpenAPI.json). This file maps every screen/action to a concrete operation and calls out where the contracts have gaps the frontend must design around.

| Screen / Action | Operation | Notes |
|---|---|---|
| Login submit | `login` (`POST /api/v1/auth/login`) | Store `access_token`, `expires_in`, `user`. |
| App boot / token restore | `getCurrentUser` (`GET /api/v1/auth/me`) | Validates a stored token; 401 → force re-login. |
| Logout | `logout` (`POST /api/v1/auth/logout`) | Fire-and-forget; always clear local state after. |
| Open Chat (first time) | `createSession` (`POST /api/v1/sessions`) | `channel: "web"`. Store returned `session_id` in `sessionStorage`. |
| Chat reload / resume | `getSessionContext` (`GET /api/v1/sessions/{id}/context`) | Rehydrates intent/selected_sku/etc., **not** message history (Gap #2). |
| Close/leave chat (optional) | `closeSession` (`DELETE /api/v1/sessions/{id}`) | Optional — call on explicit "end conversation", not on every navigation away. |
| Send chat message | `chat` (`POST /api/v1/chat`) | **Never include `customer_id`** — identity is derived from the JWT server-side; the request type in the API client should not even have that field. |
| Open product detail | `recordEngagementEvent` (`POST /api/v1/engagement/events`) | Records `PRODUCT_VIEWED`; a threshold-crossing response may contain an `upsell_result`. Product premium status and eligibility are resolved server-side. |
| Respond to upsell | `recordUpsellDecisionEvent` (`POST /api/v1/upsell/decisions/{decision_id}/events`) | Records explicit accepted, declined, or dismissed actions. Acceptance records interest only and never starts a subscription automatically. |
| Home personalization | `getCustomerSummary` (`GET /api/v1/customers/me/summary`) | Also reused read-only on Profile. |
| Health/status (ops only) | `health` (`GET /health`) | Not user-facing; useful for a build-time smoke check / status page if ever needed. |

## Gaps between product ask and current contract

### Gap #1 — No cart endpoints
There is no `Cart`, `CartItem`, or any `/cart` path in the OpenAPI file. The user requirement ("add items to cart") is real, so the frontend implements cart as **client-side state**, isolated behind a `CartRepository` interface (see [05-architecture.md](05-architecture.md)) with a `localStorage` implementation. This means:
- Cart does **not** sync across devices/browsers for the same user.
- Cart survives logout (see Flow G) but is keyed to the browser, not the account.
- When the backend team adds real cart endpoints, only the `CartRepository` implementation changes — no screen/component should call `localStorage` directly.
- **Action for backend team:** flag that a `POST /api/v1/cart/items`, `GET /api/v1/cart`, `DELETE /api/v1/cart/items/{id}` (or similar) set of endpoints would be needed to make cart durable and account-scoped.

### Gap #2 — No chat transcript persistence/retrieval
`SessionContext` returns intent/slots but not prior messages. On reload, the visual transcript is rebuilt empty even though the backend still has session state. Mitigation: persist the transcript client-side per `session_id` (e.g. `sessionStorage`) purely for UX continuity within the same browser tab; treat it as a cache, not a source of truth.

### Gap #3 — No "list my sessions" endpoint
Only single-session `GET`/`DELETE`/`POST` exist. A "past conversations" screen isn't buildable against the current contract; deferred (see [01-screens.md](01-screens.md) out-of-scope list).

### Gap #4 — No product catalog/search endpoint
Products only ever arrive embedded in a `ChatResponse`. There's no way to browse without chatting first. This is presumably intentional (agent-first UX) but is called out in case a "browse all products" screen was expected.

## Auth/session lifecycle contract
- Bearer token attached via an Axios/fetch interceptor to every call except `login` and `health`.
- A single 401-handling interceptor triggers the "session expired" flow (Flow H) — no per-screen 401 handling.
- `session_id` lives in `sessionStorage` (tab-scoped, cleared on tab close) since a session is a single visit's conversation, not a durable account artifact.
