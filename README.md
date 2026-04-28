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
│   ├── guards/           # Route guards
│   └── stores/           # App-level state
├── features/             # Domain modules
│   ├── admin-management/
│   ├── analytics/
│   ├── auth/
│   ├── catalog/
│   ├── offers/
│   ├── orders/
│   ├── products/
│   └── settings/
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
- Public order tracking uses `order_number + tracking_token`, and the tracking token is persisted client-side only for the secure tracking flow.

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
| `/admin/settings` | Admin settings page |

### BFF routes

| Prefix | Purpose |
| --- | --- |
| `/api/admin/*` | Authenticated admin/staff proxy routes |
| `/api/store/*` | Public storefront proxy routes |

Current store BFF routes include `categories`, `featured`, `orders`, `products`, `settings`, and tracking under `/api/store/tracking/[orderNumber]`.

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
pnpm dev
pnpm test
pnpm lint
```

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
- Catalog: `/products`, `/categories`, `/flavors`, `/addons`
- Orders: `/orders`, `/orders/{id}`, `/orders/{id}/approve`, `/orders/{id}/reject`, `/orders/{id}/status`, `/orders/{id}/notes`, `/orders/track`
- Settings: `/settings/store/public`, `/settings/store`, `/settings/tabs`, `/settings/panel-config`
- Admin-only data: `/employees`, `/users`, `/analytics/*`, `/export/orders`, `/upload/*`

See the backend docs in [../ishosBackEnd/docs](../ishosBackEnd/docs) for the canonical API contract.
