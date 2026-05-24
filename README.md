# WhatsApp Food Order AI Copilot

Local-first project foundation for a WhatsApp Business food-order assistant.

This repository currently includes the Milestone 1 foundation: the monorepo, app boundaries, shared TypeScript package, health endpoint, basic dashboard, Chrome Manifest V3 shell, and a local SQLite database layer with Prisma.

## What Is Included

- `apps/api`: Node.js, Express, TypeScript API with `GET /health`
- `apps/api/prisma`: Prisma schema for the local SQLite database
- `apps/dashboard`: React, Vite, Tailwind dashboard shell
- `apps/extension`: Chrome Manifest V3 extension shell
- `packages/shared`: shared TypeScript types and placeholder Zod schemas
- root workspace config for pnpm and TypeScript

## Not Implemented Yet

- WhatsApp scraping or DOM reading
- AI provider integration
- chat parser
- reply generation
- analytics dashboard
- automatic WhatsApp message insertion
- automatic message sending

The assistant must never auto-send WhatsApp messages. Future reply insertion should only happen after a human click, and sending remains manual.

## Requirements

- Node.js `22.13.0` or newer
- pnpm `11.x`

If pnpm is not installed, enable it with Corepack:

```sh
corepack enable
corepack prepare pnpm@11.3.0 --activate
```

## Setup

```sh
pnpm install
```

Create the API environment file:

```sh
cp apps/api/.env.example apps/api/.env
```

On Windows PowerShell:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
```

The default SQLite URL is `file:./dev.db`, which Prisma stores beside the schema under `apps/api/prisma/dev.db`.

Generate Prisma Client:

```sh
pnpm --filter @wfo/api prisma generate
```

Create the initial SQLite migration:

```sh
pnpm --filter @wfo/api prisma migrate dev --name init
```

## Run During Development

Run the API:

```sh
pnpm dev:api
```

The API listens on `http://localhost:4000` by default.

Check health:

```sh
curl http://localhost:4000/health
```

List products:

```sh
curl http://localhost:4000/api/products
```

Run the dashboard:

```sh
pnpm dev:dashboard
```

The dashboard runs on `http://localhost:5173` by default.

Run both API and dashboard:

```sh
pnpm dev
```

## Build

Build every workspace package:

```sh
pnpm build
```

Build only the Chrome extension:

```sh
pnpm build:extension
```

After building, load `apps/extension/dist` as an unpacked extension in Chrome.

## API Routes

- `GET /health`
- `GET /api/products`
- `POST /api/products`
- `PATCH /api/products/:id`
- `DELETE /api/products/:id`
- `GET /api/customers`
- `GET /api/customers/:id`
- `POST /api/customers`
- `POST /api/customers/:id/notes`
- `GET /api/orders`
- `GET /api/orders/:id`
- `PATCH /api/orders/:id`

Request bodies are validated with Zod. Invalid request bodies return `400`; missing records return `404`.

## Project Shape

```txt
apps/
  api/
  dashboard/
  extension/
packages/
  shared/
```

The WhatsApp Web integration layer is intentionally isolated in `apps/extension` so it can later be replaced or supplemented by the official WhatsApp Business API without reshaping the whole project.
