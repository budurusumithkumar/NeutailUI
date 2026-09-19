# Neu.Tail Frontend

ReactJS web frontend for Neu.Tail, an AI shopping-assistant experience. This repo is frontend-only — the FastAPI backend is owned by a separate team; the base contract lives at [`NeuTail_Mission4_UI_Backend_OpenAPI.json`](NeuTail_Mission4_UI_Backend_OpenAPI.json), with additive contracts for [Upsell](NeuTail_Upsell_UI_Backend_OpenAPI.json) and [Home recommendations](NeuTail_Home_Recommendations_OpenAPI.json).

The authenticated Home screen now loads in-stock product sections from
`GET /api/v1/recommendations/home`, using the customer's category affinities
and preferences. Product cards support detail views, local cart actions,
engagement-triggered governed Upsell, and a Fit handoff into Chat.

The Cart now supports a local demo checkout through
`POST /api/v1/demo/checkout`. A successful purchase displays the committed
profiling/loyalty transition and refreshes Home recommendations plus the
customer summary. The login screen includes Alice (Affluent) and Bob
(non-affluent) selectors for the third-purchase segmentation demo.

**Start with [docs/README.md](docs/README.md)** — the SDD (spec-driven development) artifacts written before this code, covering scope, screens, user flows, the API integration map (including contract gaps like cart), the chat-response rendering contract, and architecture. Read those before making structural changes here.

## Stack
React 18 + TypeScript, Vite, React Router, TanStack Query, Zustand, Axios, Tailwind CSS v4. See [docs/05-architecture.md](docs/05-architecture.md) for the rationale and folder structure.

## Getting started
```bash
npm install
cp .env.example .env   # point VITE_API_BASE_URL at your backend, defaults to http://localhost:8000
npm run dev
```

## Scripts
- `npm run dev` — start the Vite dev server.
- `npm run build` — type-check (`tsc -b`) then production build.
- `npm run lint` — oxlint.
- `npm run preview` — preview the production build locally.

## Cart scope
Cart contents remain client-side (`src/cart/`) behind a `CartRepository`
interface, so they do not sync across devices. The demo checkout is not a full
commerce cart API: it commits a purchase event using authoritative backend
product prices so the profiling sequence can be demonstrated end to end.
