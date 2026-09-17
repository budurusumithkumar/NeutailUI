# Chat Response → UI Rendering Contract

Every `POST /api/v1/chat` call returns one `ChatResponse`. It always carries free text (`message`) **and** may carry zero or more structured payloads in the same turn. The UI's job is: render the text, then render whichever structured sections are present, in a fixed order, without assuming any one of them is present.

## Rendering algorithm (per turn)
Given a `ChatResponse`, the Chat screen appends **one assistant turn** to the transcript containing, in this order:

1. **Text bubble** — always render `message` verbatim (markdown-safe escaping, no raw HTML injection).
2. **Product section** — if `products.length > 0`: render a horizontally-scrollable card grid, one `ProductCard` each (image, name, brand, price_gbp, a subtle score/why-recommended badge from `reason_codes`, "Add to cart" button, disabled state if `available === false`). Tapping a card opens Product Detail (modal) and/or sets it as the session's `selected_sku` context for the next message.
3. **Fit section** — if `fit` is non-null: render a compact fit-result card (requested vs. recommended size, confidence as a percentage, `risk_band` as a colored tag — green/LOW, amber/MEDIUM, red/HIGH — and `explanation` text).
4. **Upsell section** — if `upsell` is non-null, `upsell.status === "OFFER_AVAILABLE"`, and `upsell.should_offer === true`: render a distinct consent-first offer card using `offer.title`, `offer.description`, and `message`. `STYLING_ADVISORY` is presented as value-first styling support; `STYLE_PLUS_TRIAL` / `STYLE_PLUS` require a review-and-confirm step. If status is `NO_OFFER` or `FAILED`, render no customer-facing offer. Development/demo builds may show the deterministic decision, reasons, LLM path, and trace id in a separate disclosure.
5. **Agent activity strip** — always render a slim, low-emphasis trace of `agent_activity` (e.g. `Styling Agent ✓  Fit Agent ✓  Upsell Agent —`), mapping `status` to an icon: `STARTED` → spinner (only meaningful for streaming; for a synchronous response this should not linger), `COMPLETED` → check, `FAILED` → warning icon (and if any agent `FAILED`, keep the rest of the turn's content but visually note "partial response"), `SKIPPED` → dash. This is transparency/debug affordance, collapsible, not blocking.

## Intent-specific emphasis (not exclusivity)
`intent` tells you what the turn was primarily about, but does **not** gate which sections render — always drive rendering off presence of `products`/`fit`/`upsell`, not off `intent`, since a `FIT_QUERY` turn could in principle also carry `products` (e.g. alternative sizes). Suggested per-intent emphasis only:
- `PRODUCT_DISCOVERY` → product grid is primary.
- `FIT_QUERY` → fit card is primary.
- `SERVICE_QUERY` → upsell/service card is primary.
- `GENERAL_QUERY` / `CLARIFICATION` → text-only turn is expected and fine; no structured section required.

## Actions available on a rendered turn
- **Add to cart** (product card) → local cart mutation only (see Gap #1 in [03-api-integration.md](03-api-integration.md)); no new chat call.
- **Ask about fit for this item** (product card) → composes the next user message with `selected_sku` set to that product's `sku`, prefilling input with "Will size ___ fit me?" for the user to edit/send.
- **Accept upsell** → explicit customer action only. With the current API, the UI sends a clear follow-up chat turn and never claims enrollment or subscription. Replace this bridge with a dedicated authenticated offer-event endpoint when the backend publishes one.
- **Dismiss / decline upsell** → send an explicit follow-up so the orchestrator can record the customer's choice; persist the resolved card state within the browser session.
- **Retry** (only on a failed/500 turn) → resend the same `{session_id, message, selected_sku}` payload.

## Failure/partial-response handling
- HTTP-level failure (`400`/`500`/network) → the turn renders as a failed-turn placeholder with the raw `message` from `ErrorResponse` and a Retry button; nothing from the (absent) `ChatResponse` is rendered.
- HTTP 200 but an individual agent `FAILED` in `agent_activity` → still render everything else in the response normally; the activity strip is the only place a partial failure surfaces (backend is expected to degrade gracefully and still return a usable `message`).
