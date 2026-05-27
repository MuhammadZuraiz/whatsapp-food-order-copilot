# WhatsApp Food Order AI Copilot

Local-first project foundation for a WhatsApp Business food-order assistant.

This repository currently includes the Milestone 8C.1 foundation: the monorepo, app boundaries, shared TypeScript package, health endpoint, local SQLite database layer with Prisma, a manual chat analyzer for pasted WhatsApp exports, an optional AI-assisted analyzer path with a rule-based fallback, menu/product knowledge, historical chat import, brand style learning, customer memory, and an internal Chrome extension bridge for manually analyzing the currently open WhatsApp Web chat and manually inserting selected replies into the compose box with stale-chat protection across popup reopens.

## What Is Included

- `apps/api`: Node.js, Express, TypeScript API with `GET /health`
- `apps/api/prisma`: Prisma schema for the local SQLite database
- `apps/api/src/ai`: AI provider abstraction, mock provider, OpenAI-compatible provider, and task service
- `apps/api/src/modules/chat`: manual paste parser, rule extractor, optional AI merge layer, and suggested reply templates
- `apps/api/src/modules/chats`: exported `.txt` chat import endpoint
- `apps/api/src/modules/brandStyle`: brand style profile analysis and retrieval
- `apps/dashboard`: React, Vite, Tailwind dashboard with Manual Chat Analyzer, Menu / Products, Import Chats, Brand Style, and Customers pages
- `apps/extension`: Chrome Manifest V3 extension bridge for manually capturing the currently open visible WhatsApp Web chat
- `packages/shared`: shared TypeScript types and Zod schemas
- root workspace config for pnpm and TypeScript

## Not Implemented Yet

- background WhatsApp scraping or all-chat scanning
- analytics dashboard
- automatic message sending

The assistant must never auto-send WhatsApp messages. Reply insertion only happens after a human clicks `Insert Reply`, and sending remains manual inside WhatsApp.

Historical chat import uses exported WhatsApp `.txt` text. The Chrome extension can read the currently open visible WhatsApp Web chat only after the user clicks `Analyze Current Chat`; it does not scan chats in the background or send messages.

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

To try a free-tier OpenAI-compatible provider, set these in `apps/api/.env`:

```env
AI_PROVIDER=openai-compatible
AI_ANALYZER_ENABLED=true
AI_API_KEY=your-api-key
AI_BASE_URL=https://provider.example.com/v1
AI_MODEL=provider-model-name
```

`AI_BASE_URL` should point at an OpenAI-compatible API base. The backend appends `/chat/completions` unless the URL already ends with that path. API keys are read only by `apps/api`; do not put API keys in dashboard/frontend environment variables.

Recommended first real-provider setup, using Groq's OpenAI-compatible API:

```env
AI_PROVIDER=openai-compatible
AI_ANALYZER_ENABLED=true
AI_API_KEY=your_groq_api_key
AI_BASE_URL=https://api.groq.com/openai/v1
AI_MODEL=<choose a currently available Groq chat model>
```

OpenRouter alternative:

```env
AI_PROVIDER=openai-compatible
AI_ANALYZER_ENABLED=true
AI_API_KEY=your_openrouter_api_key
AI_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=openrouter/free
```

Free tiers, model names, and rate limits can change. Check the provider dashboard/docs before choosing the model. Never commit real API keys.

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

Use the Menu / Products page to maintain active menu context. Active products are included in analyzer prompts and rule-based item matching, but the product list is context only and is not treated as proof of an order.

Use the Import Chats page to paste or upload exported WhatsApp `.txt` chats. Imports store parsed conversations/messages locally as `source = imported_txt`. If the customer memory or brand style checkboxes are enabled and `AI_PROVIDER=openai-compatible` is configured, the imported text needed for those AI tasks is sent to the configured provider. With `AI_PROVIDER=mock`, those tasks stay local and deterministic.

Use the Brand Style page to view the saved style profile or analyze stored business messages. Brand style affects suggested-reply wording only; backend safety rules, missing-field checks, product facts, and payment rules still win.

Use the Customers page to view repeat customer memory, profile summaries, usual address, preferences, notes, recent conversations, and recent likely orders. Customer memory is advisory only: it can help wording such as asking whether to use a usual address, but current-chat details and missing-field safety always win.

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

## Chrome Extension Bridge

Milestone 8C.1 includes an internal-use Chrome extension bridge for WhatsApp Web. The extension reads only the currently open visible chat when you click `Analyze Current Chat`. It sends the captured text to the local API at `http://localhost:4000/api/chat/analyze-manual`; the extension never talks directly to Groq/OpenAI-compatible providers.

Use it like this:

```sh
pnpm dev:api
pnpm build:extension
```

Then:

1. Open Chrome and go to `chrome://extensions`.
2. Enable Developer mode.
3. Click `Load unpacked`.
4. Select `apps/extension/dist`.
5. Open `https://web.whatsapp.com`.
6. Open one chat.
7. Click the extension icon.
8. Click `Analyze Current Chat`.
9. Review the captured chat preview, analysis session status, order summary, and suggested replies.
10. Click `Copy Reply` to copy a suggestion, or click `Insert Reply` to place it into the WhatsApp compose box.
11. Review the inserted text in WhatsApp.
12. Press Send manually in WhatsApp only if you choose to send it.

Extension limitations:

- Reads visible loaded messages only.
- Does not scroll or load older chat history.
- Does not open, search, or scan other chats.
- `Insert Reply` fills the WhatsApp text box only after a user click.
- Insert is protected by an analysis-session check. If you switch chats, the visible messages change, or the adapter version changes after analysis, insertion is blocked until you click `Analyze Current Chat` again.
- The popup restores the last compact analysis after it is closed and reopened. It stores only the chat name, message counts, first/last preview lines, fingerprint, warnings, suggested replies, and order summary; it does not store the full raw transcript.
- Restored results are checked against the currently visible WhatsApp chat before insertion. If the restored result is stale or belongs to a different chat, `Insert Reply` and `Replace Draft` are disabled until you re-analyze.
- `Copy Reply` still works if a result is stale because it does not touch WhatsApp.
- `Clear saved analysis` removes the restored popup result from extension storage.
- Insert never presses Enter and never clicks the Send button.
- Existing WhatsApp drafts are protected; replacing a non-empty draft requires confirmation.
- General/unrelated chat replies are copy-only until `Allow inserting general-chat replies` is checked.
- Does not auto-send messages.
- Requires the local API to be running first.
- WhatsApp DOM selectors can change. The current adapter is versioned as `2026-05-visible-chat-v1` and fails with a clear layout-changed message when capture is not possible.
- The current composer adapter is versioned as `2026-05-compose-v1` and fails clearly if the WhatsApp compose box cannot be found.

## API Routes

- `GET /health`
- `GET /api/ai/config`
- `POST /api/ai/test`
- `GET /api/brand-style`
- `POST /api/brand-style/analyze`
- `POST /api/chat/analyze-manual`
- `POST /api/chats/import`
- `GET /api/products`
- `POST /api/products`
- `PATCH /api/products/:id`
- `DELETE /api/products/:id`
- `GET /api/customers`
- `GET /api/customers/:id`
- `GET /api/customers/:id/timeline`
- `POST /api/customers`
- `PATCH /api/customers/:id`
- `POST /api/customers/:id/notes`
- `POST /api/customers/:id/refresh-memory`
- `GET /api/orders`
- `GET /api/orders/:id`
- `PATCH /api/orders/:id`

Request bodies are validated with Zod. Invalid request bodies return `400`; missing records return `404`.

`GET /api/customers` supports `search`, `limit`, and `offset` query parameters and returns conversation/order/note counts plus last conversation date. `GET /api/customers/:id` returns parsed preferences, customer notes, recent conversations, and recent orders.

## AI Config And Test Endpoints

The AI foundation can be tested without API keys because `AI_PROVIDER=mock` is the default.

Check safe AI configuration:

```powershell
Invoke-RestMethod -Method Get -Uri http://localhost:4000/api/ai/config
```

Expected mock output:

```json
{
  "provider": "mock",
  "activeProviderUsesExternalApi": false,
  "analyzerEnabled": true,
  "model": null,
  "baseUrlConfigured": false,
  "apiKeyConfigured": false
}
```

The endpoint never returns the actual API key.

Direct provider test:

```powershell
$body = @{
  task = "generate"
  text = "Say hello in one short sentence."
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/ai/test -ContentType "application/json" -Body $body
```

Expected mock output includes:

```json
{
  "provider": "mock",
  "result": {
    "text": "Hello from the mock AI provider. Human approval is still required."
  }
}
```

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

Supported test tasks:

- `generate`
- `classifyIntent`
- `extractOrder`
- `updateCustomerMemory`
- `generateSuggestedReplies`
- `analyzeBrandStyle`

If `AI_PROVIDER=openai-compatible` is selected and the provider is misconfigured or unavailable, `/api/ai/test` returns a `502` JSON response with a safe error message and no API key. The Manual Chat Analyzer catches provider failures and returns `analysis.source = "ai_fallback"` with the rule-based result.

`updateCustomerMemory` is intentionally a lightweight current-chat summary task for now. It does not build full historical customer memory yet.

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

No database migration is needed for Milestone 6. Optional manual customer identity hints are accepted as `customerKey` or `customerPhone`; without those, the analyzer continues to fall back to `chatName`.

## Historical Chat Import Sample

PowerShell import example:

```powershell
$sample = @"
24/05/2026, 7:15 PM - Customer: Hi, can I see the menu?
24/05/2026, 7:16 PM - My Business: Sure, I'll send it now.
24/05/2026, 7:20 PM - Customer: I want 2 Chicken Biryani Tray for tomorrow dinner
24/05/2026, 7:21 PM - My Business: Sure, I can arrange that for tomorrow dinner.
24/05/2026, 7:22 PM - Customer: Less spicy please
24/05/2026, 7:23 PM - My Business: Noted, I'll make it less spicy.
24/05/2026, 7:24 PM - Customer: What payment methods do you accept?
24/05/2026, 7:25 PM - My Business: We accept cash or bank transfer. Please send your delivery address so I can confirm the details.
"@

$body = @{
  chatName = "Historical Customer"
  businessSenderNames = @("My Business", "Business", "You")
  rawText = $sample
  runBrandStyleAnalysis = $true
  runCustomerMemoryUpdate = $true
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Method Post `
  -Uri http://localhost:4000/api/chats/import `
  -ContentType "application/json" `
  -Body $body
```

Expected output includes:

```json
{
  "conversation": {
    "source": "imported_txt"
  },
  "import": {
    "messageCount": 8,
    "businessMessageCount": 4,
    "customerMessageCount": 4
  },
  "brandStyle": {
    "updated": true
  }
}
```

Check the current brand style:

```powershell
Invoke-RestMethod -Method Get -Uri http://localhost:4000/api/brand-style
```

Analyze stored business messages again:

```powershell
$body = @{
  businessSenderNames = @("My Business", "Business", "You")
  limit = 200
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Method Post `
  -Uri http://localhost:4000/api/brand-style/analyze `
  -ContentType "application/json" `
  -Body $body
```

Brand style profiles store short tone summaries, common phrases, rules, and short example-like reply patterns. They do not store full imported chat transcripts.

## Customer Memory Sample

Import a repeat customer chat:

```powershell
$sample = @"
24/05/2026, 7:15 PM - Customer: Hi, can I order again?
24/05/2026, 7:16 PM - My Business: Sure, what would you like this time?
24/05/2026, 7:20 PM - Customer: Same Chicken Biryani Tray as last time, less spicy
24/05/2026, 7:21 PM - Customer: Deliver to Villa 12, Street 4, Gulberg
24/05/2026, 7:22 PM - My Business: Noted, I'll keep it less spicy and use Villa 12, Street 4, Gulberg.
"@

$body = @{
  chatName = "Repeat Customer"
  customerKey = "repeat-customer-1"
  businessSenderNames = @("My Business", "Business", "You")
  rawText = $sample
  runBrandStyleAnalysis = $false
  runCustomerMemoryUpdate = $true
} | ConvertTo-Json -Depth 10

$import = Invoke-RestMethod -Method Post `
  -Uri http://localhost:4000/api/chats/import `
  -ContentType "application/json" `
  -Body $body
```

Refresh memory from stored chats:

```powershell
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:4000/api/customers/$($import.customer.id)/refresh-memory"
```

Expected memory includes a less-spicy preference and usual address if the configured AI provider extracts them. With the mock provider, the usual address is extracted from `Deliver to Villa 12, Street 4, Gulberg`.

Test analyzer with memory:

```powershell
$sample = @"
24/05/2026, 7:15 PM - Customer: Hi, same as usual for tomorrow dinner?
24/05/2026, 7:16 PM - Customer: Less spicy please
"@

$body = @{
  chatName = "Repeat Customer"
  customerKey = "repeat-customer-1"
  businessSenderNames = @("My Business", "Business", "You")
  rawText = $sample
  useAi = $true
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Method Post `
  -Uri http://localhost:4000/api/chat/analyze-manual `
  -ContentType "application/json" `
  -Body $body
```

Expected analyzer behavior:

- `customerMemoryUsed = true`
- suggestions may ask whether to use the usual item/address
- required fields such as `items`, `quantity`, `address`, `paymentMethod`, and `paymentStatus` remain missing until confirmed in the current chat
- no automatic confirmation or sending behavior

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
