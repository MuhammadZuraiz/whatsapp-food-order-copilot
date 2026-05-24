# WhatsApp Food Order AI Copilot

Local-first project foundation for a WhatsApp Business food-order assistant.

This repository is Milestone 0 only. It sets up the monorepo, app boundaries, shared TypeScript package, a health endpoint, a basic dashboard, and a Chrome Manifest V3 extension shell.

## What Is Included

- `apps/api`: Node.js, Express, TypeScript API with `GET /health`
- `apps/dashboard`: React, Vite, Tailwind dashboard shell
- `apps/extension`: Chrome Manifest V3 extension shell
- `packages/shared`: shared TypeScript types and placeholder Zod schemas
- root workspace config for pnpm and TypeScript

## Not Implemented Yet

- WhatsApp scraping or DOM reading
- AI provider integration
- database, Prisma, or SQLite
- order logic
- customer memory
- analytics
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
