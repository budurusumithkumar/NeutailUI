# Screen Inventory

Each screen lists: purpose, primary API calls, and status (In scope / Future).

## 1. Login
- **Purpose:** authenticate with email + password.
- **API:** `POST /api/v1/auth/login`.
- **Behavior:** on success, store `access_token` + `user` (from `LoginResponse`), redirect to Home. On `401`, show inline error from `ErrorResponse.message`.
- **Status:** In scope.

## 2. Home (user-specific)
- **Purpose:** personalized landing page after login. First thing the user sees every session.
- **API:** `GET /api/v1/customers/me/summary`, `GET /api/v1/auth/me` (identity confirm).
- **Content:** greeting with `display_name`; loyalty tier + points balance; preferred categories/colors/styles as chips; usual size / fit preference; a prominent "Chat with your stylist" CTA that creates a session (`POST /api/v1/sessions`) and navigates to Chat; cart summary widget (item count, from local cart state).
- **Status:** In scope — explicitly required by the user.

## 3. Chat (Agent Assistant)
- **Purpose:** the core interaction — free-text conversation with the agent backend, with structured results rendered alongside the reply.
- **API:** `POST /api/v1/chat` per turn (requires an active `session_id` from Home or auto-created on entry); optionally `GET /api/v1/sessions/{id}/context` to restore state on reload.
- **Content:** scrolling message list (user bubbles + assistant bubbles); assistant turns can inline-render a product carousel/grid (`ChatResponse.products`), a fit-result card (`ChatResponse.fit`), an upsell offer card (`ChatResponse.upsell`); a lightweight agent-activity strip (`ChatResponse.agent_activity`) showing which agents ran (e.g. "Styling Agent ✓ · Fit Agent ✓"); message input; "Add to cart" action on each product card; tapping a product can pass `selected_sku` on the next chat turn (for fit follow-ups, per the `fitFollowup` example in the contract).
- **Status:** In scope — the core screen.

## 4. Product Detail (modal or drawer, launched from a product card in Chat)
- **Purpose:** let the user inspect a recommended product before adding to cart — bigger image, price, available sizes, reason codes ("why we picked this"), and (if already fetched) the fit verdict.
- **API:** none new — hydrated entirely from the `ProductCard` / `FitResult` already in the chat transcript. Requesting fit for a size not yet evaluated sends a new chat turn with `selected_sku` + a message like "will size 12 fit me?".
- **Status:** In scope (can ship as a simple modal, not a separate route).

## 5. Cart
- **Purpose:** review items added from chat, adjust quantity/size, remove items, see subtotal.
- **API:** **none in the current contract** — client-side only, backed by `localStorage` behind a `CartRepository` interface (see [03-api-integration.md](03-api-integration.md) Gap #1) so it can be swapped for a real cart endpoint later.
- **Status:** In scope for UI; explicitly requested by the user. No checkout button beyond a disabled/"coming soon" affordance, since there is no order/payment endpoint.

## 6. Profile / Account
- **Purpose:** view (read-only) the same data driving Home's personalization, plus logout.
- **API:** `GET /api/v1/customers/me/summary`, `POST /api/v1/auth/logout`.
- **Status:** In scope, small.

## 7. Wardrobe / Virtual Try-On
- **Purpose:** a lightweight styling toy — pick from a small hardcoded t-shirt catalog and preview it live on the customer's own camera feed before adding to cart.
- **API:** none — the catalog (`src/screens/TryOn/tshirts.ts`) and the shirt artwork are both hardcoded/generated client-side (see Gap #4 below); this is not the chat-driven discovery flow and doesn't call `/api/v1/chat`. The camera feed never leaves the browser — nothing is uploaded, recorded, or sent to any endpoint.
- **Content:** grid of t-shirt thumbnails (color/pattern only, no photos — rendered as inline SVG); a preview panel (`CameraTryOn.tsx`) that requests the device camera via `getUserMedia`, runs client-side body tracking (TensorFlow.js MoveNet — `poseTracking.ts`), and draws the selected tee onto a canvas (`drawShirtOnCanvas.ts`) warped to the tracked shoulder position/rotation/width each frame, with fabric-style shading so it reads as worn cloth rather than a flat sticker; a "Fit" slider for fine-tuning size since there's no real 3D body model; graceful fallback states for permission-denied, no-camera-found, no-person-in-frame, and generic errors; "Add to cart" using the same `CartRepository` as Chat/Cart.
- **Status:** In scope — explicitly requested by the user as a standalone feature, separate from the out-of-scope full product catalog below.

## 8. Session/Error boundaries
- **401 / session-expired interstitial:** any API call returning 401 clears the token and redirects to Login with a "your session expired" message.
- **Generic error state:** for 500s (`ErrorResponse`), show retry affordance; surface `trace_id` in a "details" disclosure for support/debugging.
- **Status:** In scope (cross-cutting, not a distinct route).

## Explicitly out of scope for this phase (flagged, not built)
- **Full product catalog/browse/search screen** — no list/search endpoint exists; discovery of real, purchasable stock only happens through chat. (The Wardrobe/Try-On screen above is a separate, hardcoded styling toy — it is not this.)
- **Order history / checkout** — no order or payment endpoints exist.
- **Session history list** ("all my past conversations") — the contract has `GET /sessions/{id}` (single) and `POST /sessions` (create), but no "list my sessions" endpoint. Can revisit if backend adds one.
- **Stylist/Admin consoles** — `AuthUser.role` supports these roles but no screens are designed for them here.

## Navigation map
```
Login ──(success)──▶ Home ──▶ Chat ◀──▶ Product Detail (modal)
                       │        │
                       ├──▶ Try-On ────────────┐
                       ├──▶ Cart ◀──────────────┴ (Add to cart)
                       └──▶ Profile ──▶ Logout ──▶ Login
```
