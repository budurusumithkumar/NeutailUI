# User Flows

## Flow A — Login → Home
1. User submits email/password on **Login**.
2. `POST /api/v1/auth/login`.
   - 200 → persist `access_token` (memory + secure storage; see [05-architecture.md](05-architecture.md) for token storage decision) and `user`; navigate to **Home**.
   - 401 → inline error, stay on Login.
3. Home mounts → `GET /api/v1/customers/me/summary` populates the personalized panel.
4. Home calls `GET /api/v1/recommendations/home` and renders in-stock sections
   selected from the customer's category affinities and profile preferences.
5. Opening a recommended product lazily creates a session if necessary and
   records `PRODUCT_VIEWED` with `source: "HOME_RECOMMENDATIONS"`; rendering a
   card alone is not counted as a view.
6. **Add to cart** uses the existing local cart. **Will it fit?** opens Chat
   with the selected SKU and a prepared Fit question.
7. If no active session exists, Home still creates one only on the first Chat
   or product interaction, not merely when recommendations render.

## Flow B — Product discovery in Chat
1. User opens **Chat** from Home (session created if not already active).
2. User types "I need a dress for a wedding" → `POST /api/v1/chat` with `{session_id, message}`.
3. Response `intent: "PRODUCT_DISCOVERY"` includes `products[]` → render as a card grid under the assistant's message bubble, plus the `agent_activity` strip.
4. User taps **Add to cart** on a product → item added to local cart (no API call today — see Gap #1); toast confirmation.
5. User taps a product card → **Product Detail** modal opens with the same `ProductCard` data.

## Flow C — Fit follow-up
1. From Product Detail (or directly in Chat), user asks "Will size 12 fit me?" while a product is selected.
2. UI sends `POST /api/v1/chat` with `{session_id, message, selected_sku}` (per the `fitFollowup` example in the OpenAPI spec).
3. Response `intent: "FIT_QUERY"` includes `fit` (risk band, recommended size, explanation) → render a fit card inline in the transcript; if `risk_band` is `HIGH`, visually flag it (e.g. amber/red accent) rather than a plain success card.

## Flow D — Upsell
1. Opening Product Detail records `PRODUCT_VIEWED` through `POST /api/v1/engagement/events`. When deterministic engagement thresholds are reached, the response may contain an `upsell_result` routed through the Orchestrator.
2. Any engagement or chat response may include an upsell decision. Render `OFFER_AVAILABLE` as a distinct, dismissible, consent-first card separate from product cards. Never render a customer-facing card for `NO_OFFER` or `FAILED`.
3. Accepting, declining, or dismissing calls `POST /api/v1/upsell/decisions/{decision_id}/events` and persists the resolved state within the session. Acceptance records interest only; the UI never claims that a subscription or trial started automatically.

## Flow E — Cart review
1. User opens **Cart** (from Home widget, header icon, or nav).
2. Cart reads from local `CartRepository` (localStorage) — no network call.
3. User can change quantity, remove an item, or navigate back to Chat to keep shopping. Subtotal computed client-side from `price_gbp * quantity`.
4. Checkout affordance is present but disabled/"coming soon" — no order/payment endpoint exists yet.

## Flow F — Session resume (page reload)
1. On app load, if a token exists in storage, call `GET /api/v1/auth/me` to validate it.
   - Valid → restore user, go to last route (default Home).
   - 401 → clear token, go to Login.
2. If a `session_id` was persisted (e.g. in `sessionStorage`) and the user lands back on Chat, call `GET /api/v1/sessions/{session_id}/context` to rehydrate `current_intent`, `selected_sku`, etc., so the UI can restore relevant UI state (e.g. re-show which product was last selected). The message transcript itself is **not** returned by the contract — see Gap #2 — so on reload the transcript restarts empty even though backend session state persists.

## Flow G — Logout
1. User taps Logout (Profile or header).
2. `POST /api/v1/auth/logout` (best-effort — proceed to clear local state even if it fails/network drops).
3. Clear token, user, session id, and navigate to Login. Cart is deliberately **not** cleared on logout (so a returning guest doesn't lose their cart) — cart is scoped by browser storage, not by user, in this phase (see Gap #1 for the multi-user caveat).

## Flow H — Error handling (cross-cutting)
- Any `401` response mid-session → clear auth, redirect to Login with "session expired" message (Flow A's inverse).
- Any `500` (`ErrorResponse`) on `/chat` → show the assistant bubble as a failed-turn state with a retry button that resends the same `message`/`selected_sku`; surface `trace_id` for support.
- Network failure (no response) → generic "couldn't reach Neu.Tail" toast + retry, don't wipe the transcript.
