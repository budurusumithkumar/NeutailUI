# Neu.Tail — Frontend Product Spec

## Scope
This repo delivers **only** the ReactJS web frontend for Neu.Tail. The backend (FastAPI) is owned and built by a separate team; the contract between the two is [`NeuTail_Mission4_UI_Backend_OpenAPI.json`](../NeuTail_Mission4_UI_Backend_OpenAPI.json) at the repo root. This document, and the other files in `docs/`, are the SDD (Spec-Driven Development) artifacts that precede any React code. No frontend code should be written until these are agreed.

## Product summary
Neu.Tail is an AI-shopping-assistant experience. A logged-in customer talks to a multi-agent backend (product discovery, fit/sizing, upsell/service agents) through a chat interface. Each backend turn can return, in one response: a natural-language message, a list of recommended products, a fit/sizing verdict, an upsell offer, and a trace of which agents ran. The customer can act on what the agents surface — most importantly, add a recommended product to a cart.

## Actors
- **Customer** — the only role in scope for this phase. Logs in, lands on a personal home screen, chats with the agent system, browses/reacts to recommended products, manages a cart.
- **Stylist / Admin** — present in the auth contract (`AuthUser.role`) but **out of scope** for this phase. No stylist/admin screens are designed here; only note that the login/session layer must not assume `role === "customer"`.

## Goals
1. Authenticate the customer and persist their session (JWT).
2. Give the customer a personalized home screen (loyalty tier, points, style/size preferences pulled from `/api/v1/customers/me/summary`).
3. Let the customer converse with the agent backend via `/api/v1/chat`, rendering both the free-text reply and any structured payload (products / fit / upsell) in the same turn.
4. Let the customer add a recommended product to a cart and view/manage that cart.
5. Surface agent transparency (`agent_activity`) unobtrusively (e.g. a small "thinking… → styling agent → fit agent" trace), without blocking the chat UX.

## Non-goals (this phase)
- Checkout / payment / order placement — there is no order or payment endpoint in the OpenAPI contract.
- Product catalog browsing independent of chat — there is no `GET /products` or search endpoint; products only arrive as part of a `ChatResponse`.
- Cart persistence on the backend — there is no cart endpoint in the contract today (see [Gap] in [03-api-integration.md](03-api-integration.md)). Cart is client-side (localStorage) for this phase, built behind an interface so it can be swapped for a real endpoint later without touching screens.
- Stylist/admin tooling.
- Multi-language / i18n, and full WCAG audit (basic accessibility hygiene only).

## Key constraints from the API contract
- Auth is JWT bearer (`POST /api/v1/auth/login` → `access_token`); every other call requires `Authorization: Bearer <token>`.
- The UI **must never send `customer_id`** on `/api/v1/chat` — identity comes from the JWT. This is stated explicitly in the OpenAPI description and must be enforced in the API client (don't even expose a field for it).
- A chat turn needs a `session_id`. Sessions are created via `POST /api/v1/sessions` and must exist before the first chat call.
- `ChatResponse.products` / `.fit` / `.upsell` are independently nullable/optional — the UI must render whichever subset is present per turn (see [04-chat-response-rendering.md](04-chat-response-rendering.md)).

## Success criteria
- A user can log in, land on a home screen with their own data, open the chat, get a product recommendation, add it to a cart, and see it reflected in a cart screen — all without a page reload and without ever touching a hardcoded customer id.
