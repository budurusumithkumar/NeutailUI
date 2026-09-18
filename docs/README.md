# Neu.Tail Frontend — SDD Artifacts

Spec-driven artifacts, written before any React code, derived from the API contract at [`../NeuTail_Mission4_UI_Backend_OpenAPI.json`](../NeuTail_Mission4_UI_Backend_OpenAPI.json). Read in this order:

1. [00-product-spec.md](00-product-spec.md) — scope, actors, goals, non-goals, constraints.
2. [01-screens.md](01-screens.md) — screen inventory + navigation map.
3. [02-user-flows.md](02-user-flows.md) — step-by-step flows through the screens.
4. [03-api-integration.md](03-api-integration.md) — screen/action → endpoint mapping, and contract gaps (cart, transcript persistence, session list, catalog).
5. [04-chat-response-rendering.md](04-chat-response-rendering.md) — how one `ChatResponse` JSON payload turns into rendered UI + user actions.
6. [05-architecture.md](05-architecture.md) — proposed stack, folder structure, state ownership.
7. [06-data-models.md](06-data-models.md) — TypeScript types mirrored from the OpenAPI schemas, plus the client-only Cart model.

Once these are confirmed, React code generation proceeds screen-by-screen against them.

## Proposals (not built)

- [07-photorealistic-tryon-options.md](07-photorealistic-tryon-options.md) — the live camera try-on's realism ceiling, and two sketched options to get past it: a backend-mediated AI-generated snapshot (unbuilt), or a WebGPU-based live 3D render (time-boxed spike built at `src/screens/TryOn3D/`, route `/try-on-3d`, not linked from navigation — see the doc for results).
