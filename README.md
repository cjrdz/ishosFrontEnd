# IshosFactory Frontend

Astro 6 + Svelte 5 storefront and admin panel for IshosFactory. The frontend is an SSR app with an Astro BFF layer in front of the Go backend, so browser clients never talk to the backend directly.

The app has two surfaces:
- Storefront: home, menu, cart checkout, secure order tracking.
- Admin: authentication, orders, catalog, employees, customer directory, analytics, offers, and settings.

## Stack

| Layer | Technology |
| --- | --- |
| SSR framework | Astro 6 |
| Interactive UI | Svelte 5 |
| Styling | Tailwind CSS 4 + DaisyUI |
| Runtime adapters | Cloudflare Workers primary, Vercel adapter kept for alternate builds |
| Testing | Vitest |
| Typechecking | TypeScript + `astro check` |

## Architecture

### Request flow

1. The browser requests an Astro page.
2. [src/middleware.ts](src/middleware.ts) applies security headers and protects admin routes by validating the current session.
3. Astro renders the page shell and hydrates Svelte components where needed.
4. Client-side actions call Astro API routes under `/api/admin/...` and `/api/store/...`.
5. Those BFF routes proxy to `PUBLIC_API_BASE_URL`, forwarding auth through the server and normalizing backend errors.

### Source layout

The frontend now follows a feature-first structure with stable entrypoints:

```text
src/
├── core/                 # Infra and app-wide primitives
│   ├── api/              # Low-level fetch client
│   ├── bff/              # Proxy helpers for Astro API routes
│   ├── config.ts         # Environment config
│   ├── errors/           # Shared API/domain errors
│   └── stores/           # App-level state
├── features/             # Domain modules
│   ├── admin-management/ # Dashboard shell, CRUD handlers, BFF wrappers
│   ├── analytics/        # Analytics display + tracking utilities
│   ├── auth/             # Session/cache helpers
│   ├── catalog/          # Storefront menu, cart, public order flow
│   ├── inventory/        # Stock tracking
│   ├── orders/           # Admin order management
│   ├── products/         # Products, categories, flavors, addons, offers
│   └── settings/         # Admin settings page
├── shared/               # Shared UI, utilities, validators, theme
├── layouts/              # Astro layouts
├── pages/                # Astro routes and BFF routes
├── styles/               # Global and component CSS
└── types/                # Cross-domain shared types only
```

Each feature exposes a root `index.ts` barrel and should be imported through `@features/<feature>` from outside that feature. Alias mappings are defined in [tsconfig.json](/home/jrdz/Dev/fullStack/ishosFrontEnd/tsconfig.json), [astro.config.mjs](/home/jrdz/Dev/fullStack/ishosFrontEnd/astro.config.mjs), and [vitest.config.ts](/home/jrdz/Dev/fullStack/ishosFrontEnd/vitest.config.ts).

### Security and session handling

- Browser auth uses an `HttpOnly` `auth_token` cookie.
- Admin page protection validates the live session, not just cookie presence.
- Logout revokes the backend token server-side.
- The BFF parses backend responses by `Content-Type` so non-JSON upstream errors are not masked.
- BFF routes validate incoming requests with Zod and map validation errors to structured field-level responses.
- Public order tracking uses `order_number + tracking_token`, and the tracking token is persisted client-side only for the secure tracking flow.
- **CSRF posture:** The BFF does not use CSRF tokens. State-changing admin routes are protected by the `SameSite=Lax` auth cookie plus same-origin `Origin`/`Referer` checks in `src/middleware.ts`. This decision is documented and should be revisited only if cross-origin admin embedding is ever introduced.

## Routes

### Pages

| Route | Description |
| --- | --- |
| `/` | Storefront landing page with featured products and offers |
| `/menu` | Product catalog and menu browsing |
| `/order/cart` | Public checkout flow |
| `/order/tracking` | Secure public order tracking page |
| `/admin/login` | Staff login |
| `/admin` | Admin dashboard shell |
| `/admin/analytics` | Dedicated analytics page |
| `/admin/settings` | Admin settings page (store, archive, rate limits, panel config) |

### BFF routes

| Prefix | Purpose |
| --- | --- |
| `/api/admin/*` | Authenticated admin/staff proxy routes |
| `/api/store/*` | Public storefront proxy routes |

Store BFF routes include `categories`, `featured`, `offers`, `orders`, `products`, `settings`, and tracking under `/api/store/tracking/[orderNumber]`.

Admin BFF routes cover orders (including approve, reject, status, notes, archive), catalog (products, categories, flavors, addons, container types), employees, customers, analytics, export, upload, archive config, rate limits, and panel config.

## Quality gates

Local validation commands:

```bash
pnpm lint
pnpm test
pnpm build
pnpm check:store-boundary
```

- `pnpm lint` runs `tsc --noEmit` and `astro check`.
- `pnpm test` runs Vitest.
- `pnpm build` validates the production SSR bundle.
- [.github/workflows/frontend-ci.yml](.github/workflows/frontend-ci.yml) runs the same checks in CI on push and pull request.

## Local development

### Prerequisites

- Node.js 20+
- pnpm
- Running `ishosBackEnd` instance

### Environment

Create `.env`:

```env
PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
PUBLIC_AUTH_COOKIE_TTL_HOURS=24
```

If you test on LAN, include the backend port explicitly in `PUBLIC_API_BASE_URL`.

### Commands

```bash
pnpm install
pnpm generate:api-types   # creates src/types/api-generated.ts (gitignored)
pnpm dev
pnpm test
pnpm lint
```

`src/types/api-generated.ts` is generated from `../ishosBackEnd/api/openapi.yaml` and is gitignored so it never lands in `main`.

Alternate builds:

```bash
pnpm build
pnpm preview
pnpm build:cloudflare
pnpm build:vercel
```

Deployment:

```bash
pnpm deploy
```

`pnpm deploy` rebuilds before publishing. Rebuild whenever environment variables change because `PUBLIC_API_BASE_URL` is embedded into the SSR bundle at build time.

## Backend integration

The frontend consumes the backend only through the Astro BFF. Important upstream route groups are:

- Auth: `/auth/login`, `/auth/logout`, `/auth/session`
- Catalog: `/products`, `/categories`, `/flavors`, `/addons`, `/container-types`
- Orders: `/orders`, `/orders/{id}`, `/orders/{id}/approve`, `/orders/{id}/reject`, `/orders/{id}/status`, `/orders/{id}/notes`, `/orders/{id}/archive`, `/orders/track`, `/admin/orders/archive/run`
- Settings: `/settings/store/public`, `/settings/store`, `/settings/tabs`, `/settings/archive`, `/settings/rate-limits`, `/settings/panel-config`
- Admin-only data: `/employees`, `/users`, `/analytics/*`, `/export/orders`, `/upload/*`, `/upload/images`

The canonical contract is the generated [OpenAPI spec](../ishosBackEnd/api/openapi.yaml); see the backend docs in [../ishosBackEnd/docs](../ishosBackEnd/docs) for narrative guidance.
