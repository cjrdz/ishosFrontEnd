# IshosFactory Frontend

Full-stack frontend for **IshosFactory** gelato shop, built with Astro + Svelte and deployed on Cloudflare Workers.

The application includes two surfaces:
- **Admin Panel** — internal operations: orders, catalog, employees, analytics, settings.
- **Storefront** — public-facing menu, cart checkout, and order tracking.

Both communicate with the Go backend (`ishosBackEnd`) through an Astro BFF (Backend-for-Frontend) layer.

---

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Astro 5 (SSR, Cloudflare Workers adapter) |
| UI components | Svelte 5 |
| Styling | Tailwind CSS + DaisyUI |
| HTTP client | Fetch API (via typed BFF wrappers) |
| Deployment | Cloudflare Workers (`wrangler`) |

---

## Architecture

### Request flow

1. Browser requests an Astro page; the middleware validates the session cookie before rendering protected routes.
2. Astro server renders the shell (layout + initial data).
3. Svelte components hydrate client-side with `client:load`.
4. UI actions call Astro API routes under `/api/admin/...` or `/api/store/...` (the BFF).
5. BFF routes proxy to the Go backend at `PUBLIC_API_BASE_URL`, forwarding the `Authorization` header derived from the cookie.

### BFF design

All backend requests from the client go through Astro API routes, not directly to the Go API. This keeps:
- The backend URL and auth token server-side only.
- Non-JSON backend errors surfaced correctly (BFF parses response by `Content-Type`, no unconditional `.json()`).

### Session security

- `auth_token` cookie is `HttpOnly`, `SameSite=Lax`, with `Cache-Control: no-store` on auth responses.
- The middleware validates an active session via the BFF (`/api/admin/session`) before allowing protected routes — it does not only check cookie presence.
- Logout triggers server-side token revocation on the backend, so a revoked token is invalid before JWT expiry.
- `localStorage` is NOT used for authentication tokens.

---

## Pages

| Route | Description |
| --- | --- |
| `/` | Storefront home with featured products |
| `/menu` | Full catalog with category filter |
| `/order/cart` | Cart checkout (order submission) |
| `/order/tracking` | Public order status tracking (via secure link) |
| `/admin/login` | Staff login |
| `/admin` | Admin dashboard (tabbed panel) |
| `/admin/analytics` | Sales analytics and KPI charts |
| `/admin/settings` | Admin panel configuration |

### Admin dashboard tabs

| Tab | Functionality |
| --- | --- |
| Orders | View, update, approve/reject, advance status, delete |
| Categories | CRUD + image management |
| Products | CRUD + image upload + flavor/addon assignment |
| Flavors | CRUD for available gelato flavors |
| Addons | CRUD for available toppings/add-ons |
| Employees | Create, deactivate, delete staff accounts |
| Users | Customer directory (admin) |
| Tools | Export orders (CSV), purge old orders |
| Settings | Panel tab order + token TTL configuration |

---

## Project Structure

```text
src/
├── middleware.ts                   # Session validation for protected routes
├── layouts/
│   ├── AdminLayout.astro
│   └── StoreLayout.astro
├── pages/
│   ├── index.astro                 # Storefront home
│   ├── menu.astro                  # Public product catalog
│   ├── order/
│   │   ├── cart.astro              # Cart / checkout
│   │   └── tracking.astro          # Order tracking
│   ├── admin/
│   │   ├── login.astro
│   │   ├── index.astro             # Dashboard shell
│   │   ├── analytics.astro
│   │   └── settings.astro
│   └── api/
│       ├── admin/                  # BFF routes (proxy to Go backend)
│       │   ├── login.ts, logout.ts, session.ts
│       │   ├── orders/, categories/, products/
│       │   ├── flavors/, addons/, employees/, users/
│       │   ├── images/, settings/
│       │   ├── analytics/, export/
│       └── store/                  # Storefront BFF routes
├── components/
│   ├── astro/store/                # Server-rendered store shell components
│   └── svelte/
│       ├── admin/
│       │   ├── AdminDashboard.svelte
│       │   ├── AdminHeader.svelte
│       │   ├── AdminLoginForm.svelte
│       │   ├── AdminTabPanels.svelte
│       │   └── tabs/
│       │       ├── OrdersTab.svelte
│       │       ├── CategoriesTab.svelte
│       │       ├── ProductsTab.svelte
│       │       ├── FlavorsTab.svelte
│       │       ├── AddonsTab.svelte
│       │       ├── EmployeesTab.svelte
│       │       ├── UsersTab.svelte
│       │       ├── ToolsTab.svelte
│       │       └── SettingsTab.svelte
│       └── store/
│           ├── MenuCatalog.svelte
│           ├── CartCheckout.svelte
│           └── OrderTracking.svelte
└── lib/
    ├── config.ts                   # Environment config
    ├── api/                        # Typed HTTP client wrappers
    ├── bff/                        # BFF proxy helpers
    ├── auth/                       # Session cache
    ├── store/                      # Cart state + order tracking
    ├── stores/                     # Svelte writable stores (admin)
    └── validators/                 # Request validation
```

---

## Integration with `ishosBackEnd`

BFF routes under `/api/admin/...` map to Go backend endpoints at `PUBLIC_API_BASE_URL`.

### Backend endpoints consumed by the admin panel

#### Auth
- `POST /auth/login`
- `GET /auth/session`
- `POST /auth/logout`

#### Orders
- `GET /orders` (with `status`, `page`, `limit` filters)
- `GET /orders/{id}`
- `PATCH /orders/{id}`
- `POST /orders/{id}/approve`
- `POST /orders/{id}/reject`
- `PATCH /orders/{id}/status`
- `PATCH /orders/{id}/notes`
- `DELETE /orders/{id}` (admin only)
- `GET /export/orders` (CSV export, admin only)
- `DELETE /export/orders` (purge, admin only)

#### Categories
- `GET /categories`
- `POST /categories`
- `PATCH /categories/{slug}`
- `DELETE /categories/{slug}`

#### Products
- `GET /products?all=true`
- `POST /products`
- `PATCH /products/{id}`
- `PATCH /products/{id}/availability`
- `DELETE /products/{id}`
- `POST /products/{id}/flavors/{flavorId}`
- `DELETE /products/{id}/flavors/{flavorId}`
- `POST /products/{id}/addons/{addonId}`
- `DELETE /products/{id}/addons/{addonId}`

#### Flavors
- `GET /flavors`
- `POST /flavors`
- `PATCH /flavors/{id}`
- `DELETE /flavors/{id}`

#### Addons
- `GET /addons`
- `POST /addons`
- `PATCH /addons/{id}`
- `DELETE /addons/{id}`

#### Employees
- `GET /employees`
- `POST /employees`
- `PATCH /employees/{id}`
- `PATCH /employees/{id}/deactivate`
- `DELETE /employees/{id}`

#### Users (customer directory)
- `GET /users`
- `GET /users/{id}`
- `GET /users/{id}/orders`
- `POST /users`
- `PATCH /users/{id}`
- `DELETE /users/{id}`

#### Analytics
- `GET /analytics/overview`
- `GET /analytics/orders-over-time`
- `GET /analytics/top-products`

#### Settings
- `GET /settings/tabs`
- `PATCH /settings/tabs`
- `GET /settings/panel-config`
- `PATCH /settings/panel-config`

#### Upload / Media Library
- `GET /upload/images`
- `POST /upload/image` (`multipart/form-data`)
- `DELETE /upload/image`

### Backend endpoints consumed by the storefront

- `GET /products` (public catalog)
- `GET /categories` (public list)
- `GET /flavors` (public list)
- `GET /addons` (public list)
- `POST /orders` (checkout, rate-limited)
- `GET /orders/track?order_number=...&tracking_token=...` (public tracking)

---

## Local Development

### Prerequisites

- Node.js 20+
- pnpm
- `ishosBackEnd` running locally

### Environment variables

Create `.env`:

```env
PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
PUBLIC_AUTH_COOKIE_TTL_HOURS=24
```

### Commands

```bash
pnpm install
pnpm dev
```

Production build:

```bash
pnpm build
pnpm preview
```

Deploy to Cloudflare Workers:

```bash
pnpm deploy
```

`pnpm deploy` rebuilds before publishing. This is important because `PUBLIC_API_BASE_URL` is embedded in the SSR bundle at build time — always rebuild when changing environment variables before deploying.
