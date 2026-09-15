# Frontend Architecture

## Tech stack (proposed — flag if you want a different stack before code generation starts)
- **React 18 + TypeScript**, bundled with **Vite**.
- **React Router** for the screens in [01-screens.md](01-screens.md).
- **TanStack Query** for all server calls (login, session, chat, customer summary) — gives request de-dupe, retry, and loading/error states for free; matches the "each screen owns its own fetch, nothing global except auth" model below.
- **Zustand** (or React Context if the team prefers zero extra deps) for the two pieces of truly cross-screen client state: **auth** (token/user) and **cart**. Chat transcript state lives local to the Chat screen (+ `sessionStorage` cache per Gap #2), not in global state.
- **Axios** instance with a request interceptor (attach bearer token) and a response interceptor (401 → global logout/redirect), per [03-api-integration.md](03-api-integration.md).
- Styling: Tailwind CSS (fast to build the card/grid/chat-bubble layouts this spec needs). Swap for the team's existing design system if one exists.
- Types generated/hand-mirrored from the OpenAPI schema — see [06-data-models.md](06-data-models.md).

## Folder structure
```
src/
  api/
    client.ts          # axios instance + interceptors
    auth.ts             # login, me, logout
    sessions.ts         # createSession, getSession, getSessionContext, closeSession
    chat.ts             # postChat
    customer.ts         # getCustomerSummary
    types.ts            # mirrors OpenAPI components/schemas — see 06-data-models.md
  cart/
    CartRepository.ts   # interface: getItems, addItem, updateQty, removeItem, clear
    LocalCartRepository.ts # localStorage implementation (today's only implementation)
    cartStore.ts         # Zustand store wrapping CartRepository
  auth/
    authStore.ts         # token + user + status (idle/authenticating/authenticated/expired)
  screens/
    Login/
    Home/
    Chat/
      components/ProductCard.tsx
      components/FitCard.tsx
      components/UpsellCard.tsx
      components/AgentActivityStrip.tsx
      components/ProductDetailModal.tsx
    Cart/
    Profile/
  routes/
    AppRouter.tsx         # route table + auth guard
    RequireAuth.tsx
  components/              # shared, cross-screen primitives only (Button, Chip, Toast, ErrorBoundary)
```

## State ownership rules (to keep this maintainable)
- **Global:** auth (token/user), cart. Nothing else.
- **Route-local:** chat transcript, session id, per-screen loading/error — via TanStack Query + local component state.
- **No component reaches into `localStorage`/`sessionStorage` directly** except `LocalCartRepository` and the sessionStorage transcript cache — everything else goes through the `api/` and `cart/` modules.

## Auth guard
`RequireAuth` wraps every route except Login: checks `authStore` for a token; if absent, calls `getCurrentUser` once to validate a token that might exist from a previous visit (Flow F); on any 401 anywhere, the Axios interceptor clears `authStore` and the router redirects to `/login`.

## Testing approach (brief — full plan can use the `testing-strategy` skill if wanted)
- Unit test `CartRepository`/`LocalCartRepository` (pure logic, no DOM).
- Unit test the chat-rendering algorithm in [04-chat-response-rendering.md](04-chat-response-rendering.md) against fixture `ChatResponse` payloads (with/without products, with/without fit, failed agent, etc.) — this is the highest-risk piece of UI logic.
- Integration test Login → Home → Chat → Add to cart → Cart with a mocked API layer (e.g. MSW), since there is no real backend to hit yet.
