# WhatsApp Food Order AI Copilot

Local-first project foundation for a WhatsApp Business food-order assistant.

This repository currently includes the Milestone 4 foundation: the monorepo, app boundaries, shared TypeScript package, health endpoint, basic dashboard, Chrome Manifest V3 shell, local SQLite database layer with Prisma, a manual chat analyzer for pasted WhatsApp exports, and an optional AI-assisted analyzer path with a rule-based fallback.

## What Is Included

- `apps/api`: Node.js, Express, TypeScript API with `GET /health`
- `apps/api/prisma`: Prisma schema for the local SQLite database
- `apps/api/src/ai`: AI provider abstraction, mock provider, OpenAI-compatible provider, and task service
- `apps/api/src/modules/chat`: manual paste parser, rule extractor, optional AI merge layer, and suggested reply templates
- `apps/dashboard`: React, Vite, Tailwind manual chat analyzer page with an AI assistance toggle
- `apps/extension`: Chrome Manifest V3 extension shell
- `packages/shared`: shared TypeScript types and Zod schemas
- root workspace config for pnpm and TypeScript

## Not Implemented Yet

- WhatsApp scraping or DOM reading
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

The AI layer defaults to the zero-cost mock provider:

```env
AI_PROVIDER=mock
AI_ANALYZER_ENABLED=true
```

`AI_ANALYZER_ENABLED=true` allows requests with `useAi: true` to use the AI-assisted analyzer. If the variable is missing, the API treats it as enabled because the mock provider is safe and free. If this is set to `false`, the analyzer returns the rule-based result.

To try a free-tier OpenAI-compatible provider later, set these in `apps/api/.env`:

```env
AI_PROVIDER=openai-compatible
AI_ANALYZER_ENABLED=true
AI_API_KEY=your-api-key
AI_BASE_URL=https://provider.example.com/v1
AI_MODEL=provider-model-name
```

`AI_BASE_URL` should point at an OpenAI-compatible API base. The backend appends `/chat/completions` unless the URL already ends with that path.

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

Open the dashboard and use the Manual Chat Analyzer to paste an exported WhatsApp chat. The dashboard calls the API at `POST /api/chat/analyze-manual` and saves parsed messages plus any likely draft order data locally.

Use the `Use AI assistance` toggle to send `useAi: true`. The analyzer still starts with the deterministic Milestone 2 parser and extractor, then optionally asks the AI service for intent, order extraction, customer summary, and suggested replies. If AI fails, the API returns `analysis.source = "ai_fallback"` and uses the rule-based result.

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
- `POST /api/ai/test`
- `POST /api/chat/analyze-manual`
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

## AI Test Endpoint

The AI foundation can be tested without API keys because `AI_PROVIDER=mock` is the default.

PowerShell example:

```powershell
$body = @{
  task = "classifyIntent"
  text = "Hi, can I order 2 biryani boxes for tomorrow dinner?"
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/ai/test -ContentType "application/json" -Body $body
```

Expected output includes:

```json
{
  "provider": "mock",
  "result": {
    "intent": "new_order",
    "orderLikely": true
  }
}
```

Other supported test tasks:

- `extractOrder`
- `generateSuggestedReplies`
- `analyzeBrandStyle`

The task service also includes `updateCustomerMemory()` for later wiring, but it is not exposed through the test endpoint in this milestone.

## Manual Chat Analyzer Sample

Paste this into the dashboard:

```txt
24/05/2026, 7:15 PM - Customer: Hi, can I see the menu?
24/05/2026, 7:17 PM - My Business: Sure, we have biryani, pasta, rice boxes, and dessert platters.
[24/05/2026, 7:20:00 PM] Customer: I want 2 biryani boxes for tomorrow dinner
[24/05/2026, 7:21:00 PM] Customer: Please make it less spicy
[24/05/2026, 7:22:00 PM] Customer: Address is Villa 12, Street 4, Gulberg
[24/05/2026, 7:24:00 PM] My Business: We can do bank transfer or cash.
```

Use `Sample Customer` as the chat name and `My Business, Business, You` as business sender names.

Expected behavior:

- messages are parsed with customer/business sender types
- intent is detected as a likely order
- items, quantity, delivery timing, address, payment method, and custom request are extracted
- missing fields include `paymentStatus` until payment proof or explicit business confirmation appears
- 2-3 template suggested replies are shown and stored

With AI assistance enabled, expected behavior also includes:

- `analysis.source` is `ai_assisted` when the AI provider succeeds
- `analysis.source` is `ai_fallback` if AI fails and rule-based analysis is returned
- `analysis.customerSummary` may contain a short current-chat summary
- payment questions such as `What payment methods do you accept?` do not select a payment method by themselves

No database migration is needed for Milestone 4. Optional manual customer identity hints are accepted as `customerKey` or `customerPhone`; without those, the analyzer continues to fall back to `chatName`.

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

Future WhatsApp Web DOM selectors should live behind a `WhatsAppDomAdapter`, include a version stamp, and fail loudly with a clear "WhatsApp layout changed" message instead of silently breaking.
