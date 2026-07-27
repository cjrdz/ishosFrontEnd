# Deployment

## Versioning

This project follows [Semantic Versioning](https://semver.org/):

- `MAJOR.MINOR.PATCH`
- `MAJOR` — incompatible UI/UX or API contract changes
- `MINOR` — new features that are backward compatible
- `PATCH` — bug fixes and small improvements

The current version is stored in `package.json` at the repository root and must
be updated in the same commit that promotes a release.

### Branch flow

```
feature/bugfix work  →  dev  →  sec  →  main
```

- `dev` — active development, integration branch
- `sec` — staging/pre-production sanity gate
- `main` — production releases

### Release process

1. Merge all planned work into `dev`.
2. Bump `package.json` version (or `VERSION` in the backend) and update this
   doc if the release process itself changed.
3. Open/merge a PR from `dev` → `sec` and validate in staging.
4. Open/merge a PR from `sec` → `main`.
5. Tag the merge commit on `main` as `v<VERSION>` (e.g. `v0.0.1`).

### Tags

- `v0.0.1` — initial clean baseline for all three branches.

## Build

```sh
pnpm run build
```

## Deploy targets

- **Vercel**: `pnpm run build:vercel`
- **Cloudflare Workers**: `pnpm run build:cloudflare && wrangler deploy`

## Required environment

See `.env.example` for the full list. Production deploys must align with the
backend on:

- `PUBLIC_API_BASE_URL`
- CORS `ALLOWED_ORIGINS` on the backend
- store tracking and settings routes

## Smoke checks

```sh
curl https://<host>/health
curl https://<host>/api/v1/products
curl https://<host>/api/v1/categories
curl https://<host>/api/v1/settings/store/public
```
