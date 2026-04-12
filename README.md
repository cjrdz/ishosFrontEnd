# Ishos Frontend — Panel Administrativo

Frontend administrativo de **IshosFactory** construido con Astro + Svelte.

Este panel opera sobre la API en Go (`ishosBackend`) para autenticación, gestión de órdenes, catálogo, empleados y media library.

---

## 1) Objetivo del Panel

El panel está orientado a operación interna del local:

- Login de personal (`admin` / `employee`)
- Gestión de órdenes (crear, editar, aprobar/rechazar, cambiar estado, eliminar)
- Gestión de categorías (CRUD)
- Gestión de productos (CRUD + galería de imágenes)
- Gestión de empleados (crear, editar estado, eliminar)

---

## 2) Arquitectura actual

### Stack

- **Astro 5**: shell de páginas y layout
- **Svelte 5**: UI interactiva del panel (client-side)
- **Tailwind + DaisyUI**: estilos del panel
- **Fetch API**: cliente HTTP hacia backend Go

### Flujo de ejecución

1. Astro sirve rutas (`/admin/login`, `/admin`) con layout base.
2. Componentes Svelte se hidratan con `client:load`.
3. Login llama `POST /auth/login` y establece `auth_token` en cookie `HttpOnly`.
4. Middleware de Astro valida sesión del cookie contra `/api/admin/session` antes de permitir rutas protegidas.
5. Cada acción de UI llama endpoints `/api/v1/...` del backend.

### Estructura principal

```text
src/
	pages/
		admin/login.astro     # pantalla login
		admin/index.astro     # dashboard admin
	components/svelte/
		AdminLoginForm.svelte
		AdminDashboard.svelte
		admin/
			OrdersTab.svelte
			CategoriesTab.svelte
			ProductsTab.svelte
			EmployeesTab.svelte
	lib/
		api/
			client.ts           # wrapper fetch + manejo de errores
			auth.ts             # auth endpoints
			admin.ts            # endpoints del panel
		auth/session.ts       # caché de sesión en memoria (solo navegador)
		config.ts             # PUBLIC_API_BASE_URL
```

---

## Seguridad de Sesión (estado actual)

- Cookie `auth_token` es `HttpOnly`, `SameSite=Lax`, con `Cache-Control: no-store` en respuestas de auth.
- El frontend **no** usa `localStorage` para tokens de autenticación.
- El middleware del panel no se limita a verificar existencia de cookie: valida sesión activa vía BFF (`/api/admin/session`).
- El backend aplica revocación server-side en logout, por lo que un token revocado queda inválido antes de expiración.

---

## 3) Integración con `ishosBackend` API

Base URL configurada por:

- `PUBLIC_API_BASE_URL`
- `PUBLIC_AUTH_COOKIE_TTL_HOURS` (cookie `auth_token` emitida por el BFF)
- Default local: `http://localhost:8080/api/v1`

### Endpoints usados actualmente por el panel

#### Auth
- `POST /auth/login`
- `GET /auth/session`
- `POST /auth/logout`

#### Orders
- `GET /orders`
- `GET /orders/{id}`
- `POST /orders`
- `PATCH /orders/{id}`
- `POST /orders/{id}/approve`
- `POST /orders/{id}/reject`
- `PATCH /orders/{id}/status`
- `DELETE /orders/{id}` (solo admin)

#### Categories
- `GET /categories` (con `?all=true` para admin)
- `POST /categories`
- `PATCH /categories/{id}`
- `DELETE /categories/{id}`

#### Products
- `GET /products?all=true`
- `POST /products`
- `PATCH /products/{id}`
- `DELETE /products/{id}`

#### Employees
- `GET /employees`
- `POST /employees`
- `PATCH /employees/{id}`
- `DELETE /employees/{id}`

#### Upload / Media Library
- `GET /upload/images`
- `POST /upload/image` (`multipart/form-data`)
- `DELETE /upload/image`

---

## 4) ¿Está usando todas las features del backend?

**No al 100%.** El panel usa la mayor parte del API administrativo, pero no todas las rutas disponibles.

### Funcionalidad backend disponible pero no usada en UI actual

1. `PATCH /products/{id}/availability`
	 - El panel cambia disponibilidad vía `PATCH /products/{id}` con `is_available`.
	 - No usa la ruta dedicada de toggle.

2. `PATCH /orders/{id}/notes`
	 - Existe endpoint dedicado para notas.
	 - UI actualmente edita notas dentro de `PATCH /orders/{id}`.

3. `POST /employees/{id}/deactivate`
	 - Existe endpoint de desactivación explícita.
	 - UI gestiona estado por `PATCH /employees/{id}` y también permite `DELETE`.

4. Endpoints públicos/no administrativos no consumidos por este panel
	 - `GET /products/{id}`
	 - `GET /categories/{slug}`
	 - `GET /health`
	 - (esperable, porque son para storefront, integración externa o monitoreo)

---

## 5) ¿Qué features faltan desde la perspectiva del Panel vs API?

Para el alcance actual del panel, **no hay bloqueos críticos de API**: las operaciones principales sí tienen soporte backend.

Pendientes recomendados (si se quiere cobertura total):

- Integrar ruta dedicada de toggle de disponibilidad (`/products/{id}/availability`).
- Integrar flujo explícito de desactivación de empleado (`/employees/{id}/deactivate`) separado de edición.
- Integrar endpoint dedicado de notas (`/orders/{id}/notes`) para edición liviana.

---

## 6) Notas de consistencia

Hay diferencias entre documentación histórica y rutas activas del servidor en algunos casos (sobre todo empleados/órdenes). La referencia confiable es el enrutado actual en `ishosBackend/internal/server/server.go`.

---

## 7) Desarrollo local

### Requisitos

- Node.js 20+
- pnpm
- Backend `ishosBackend` corriendo

### Variables de entorno

Crea `.env` (opcional) con:

```env
PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
PUBLIC_AUTH_COOKIE_TTL_HOURS=24
```

### Comandos

```bash
pnpm install
pnpm dev
```

Build producción:

```bash
pnpm build
pnpm preview
```

Deploy a Cloudflare Workers:

```bash
pnpm deploy
```

`pnpm deploy` recompila antes de publicar. Esto es importante porque `PUBLIC_API_BASE_URL` queda embebida en el bundle SSR si no se reconstruye.
