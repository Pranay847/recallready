# RecallReady

Trace recalled food lots, resolve missing evidence, and prepare a response packet.

An early prototype for independent food distributors, runnable locally or as a hosted demonstration. The sample drill works without an API key. Live document extraction uses NVIDIA Nemotron on Nebius Token Factory; product and lot determinations use deterministic checks after operator confirmation.

## Run

Install Node.js 22.13 or newer (Node 24 recommended). From this folder:

```sh
npm ci
npm run build
npm start
```

Open **http://127.0.0.1:4317**. The server binds to your computer only. Keep it running while using the app. Dependencies and the production build are already present in the original delivered folder, so `npm start` is sufficient there.

For development, keep `npm run server` running in one terminal and `npm run dev` in another. Open http://127.0.0.1:4316. The native Vite configuration loader avoids directory traversal by the configuration bundler in restricted Windows environments.

## Try the complete drill

1. Click **Load sample drill** and confirm. All sample businesses, products and records are fictional.
2. The initial trace shows **42 warehouse cartons**, **52 dispatched cartons**, **3 customers**, and **1 evidence gap**.
3. Open **Review missing evidence**, then **Review this record** for `INV-103`.
4. Click **Use sample receiving note**, check the operator-verification box, and save.
5. The trace becomes **54 warehouse cartons**, **60 dispatched cartons**, **4 customers**, and **0 evidence gaps**.
6. Open **Response packet**. Record a practice stock hold, review the customer drafts, and export HTML or CSV.

The sample receiving note shortcut is available only for the unchanged original sample notice and inventory. Editing or replacing those sources disables it. Unknown lots stay unresolved until an operator supplies evidence.

## Host a demo

See [DEPLOY.md](DEPLOY.md) for the Render Free Blueprint and Docker deployment instructions. Hosted mode allows visitors to try the fictional sample drill. Live AI requires a judge access code and has shared request limits. Keep the Nebius key and judge code in the host's secret settings. A hosted HTTPS URL must pass the deployment checks before being shared with judges.

## Connect live Nemotron extraction

Copy `.env.example` to `.env`, fill in `NEBIUS_API_KEY`, and restart the server:

```dotenv
NEBIUS_API_KEY=your-key-here
NEBIUS_MODEL=nvidia/nemotron-3-super-120b-a12b
NEBIUS_BASE_URL=https://api.tokenfactory.nebius.com/v1
```

Obtain a key through the [Nebius Token Factory quickstart](https://docs.tokenfactory.nebius.com/quickstart). If your account uses a regional API endpoint, set `NEBIUS_BASE_URL` to the endpoint specified by Nebius. Model availability must be checked in your account.

Open **AI connection** to inspect configuration status. A configured key is not proof of successful inference: a live extraction must complete to verify access. Keys stay on the server and are not stored in browser state, returned by the health endpoint, or included in exports.

In **Source records**:

- Open a text-based recall PDF/TXT or paste its text. Choose **Extract with Nemotron**, check the candidate against the original source, correct the identifiers and complete explicit lot list, then confirm.
- For invoice/receiving documents, use **Extract inventory**. Review each proposed row and enter **current warehouse cartons**. Received or billed quantities are reference values, not current stock. Confirming replaces inventory and clears its old shipment links and confirmations.
- Both workflows also support manual entry from document text.

The browser sends document text to Nebius only when you explicitly request extraction. PDF text extraction and CSV import run on the app server, without a model call. With the local setup this is your computer; on a hosted demo, uploads are processed by the hosting service. Image-only scans and label photos are not supported in this build. AI output is unconfirmed candidate data, and quoted evidence must occur in the source document.

On September 8, 2026, a live Nemotron notice extraction was verified through the browser using a fictional Harbor Mill notice: product, brand, SKU, two explicit lots and date matched the input, missing UPC remained blank, and operator confirmation was required. The request includes the complete schema in both the system prompt and response format. Live receiving-document extraction and a broader model-quality benchmark remain to be completed. Automated tests use controlled responses at the external HTTP boundary.

## Input files

Download templates from the app or use `public/samples/`.

Inventory CSV headers:

```csv
id,product,brand,sku,upc,lot,quantity,unit,location
```

Shipment CSV headers:

```csv
id,recordId,customer,quantity
```

- `id` must be unique within each file. Shipment `recordId` must match an inventory ID.
- Inventory `quantity` is **current stock**. Shipment `quantity` is **already dispatched**; it is not subtracted from current stock.
- All quantities are nonnegative whole cartons. Inventory `unit` must be `cartons`.
- Keep UPCs, SKUs and lots as text, including leading zeros. Empty quantities are errors; empty lots remain unresolved.
- Quoted commas, multiline cells, UTF-8 BOM, and CRLF are supported. Each row retains its filename, original text and row number.
- Importing inventory explicitly replaces inventory and clears shipment links, resolutions and hold confirmations. Import shipments next.
- Mark imported example data as synthetic in the confirmation dialog. The app tracks notice, inventory and shipment provenance separately and flags mixed data.

## How matching works

1. Validate records and shipment links.
2. Require an operator-confirmed notice before using it to determine any record.
3. Compare exact product identifiers. Conflicting identifiers or incomplete identity require review. Exact brand and product can establish identity when identifiers are unavailable.
4. Compare the effective lot against the complete explicit recall lot list. Missing lots remain unresolved. Case and whitespace are normalized; meaningful lot punctuation is preserved.
5. Trace affected records to shipments and group customers. Review records and their shipments remain visible but are separate from confirmed affected totals.
6. After an operator records evidence for a missing lot, recalculate all relevant results. Clear that record’s previous hold confirmation.

“Outside this recall” refers only to the confirmed scope and supplied records. It is not a general food-safety clearance.

## Exports and storage

HTML packets include source provenance, confirmed totals, all inventory determinations, unresolved linked shipments, evidence excerpts, operator confirmations, customer drafts, and verification history. Open the HTML in a browser and print to PDF if needed. CSV manifests escape formula-like cell values.

Cases are saved in this browser's local storage. The API processes uploads in memory and does not save them to disk. Invalid saved cases are backed up before replacement when possible; if a backup cannot be made, the original saved value is not overwritten. Hosted live extraction uses a shared judge code; it is not an individual user account. There is no database, multi-user case sharing or encrypted case vault in this early build. Use fictional records in the public demonstration.

## Verification

```sh
npm test
npm run build
```

Tests cover matching and quantities, unknown/conflicting evidence, linked shipments, CSV validation, PDF extraction, API errors, external model-response handling, state restoration, stale analysis, provenance, and exports. See `VALIDATION.md` for the completed browser checks and their limits.

## Project layout

| Path | Responsibility |
|---|---|
| `src/App.jsx` | Operator workflow and local case state |
| `src/InvoiceIntake.jsx` | Invoice/receiving document intake and review |
| `src/case-state.mjs` | Case provenance, restoration and current-analysis checks |
| `src/exports.mjs` | Evidence packet, manifest and customer grouping |
| `server/domain.mjs` | Deterministic matching and case validation |
| `server/ai.mjs` | Nebius/Nemotron document extraction |
| `server/csv.mjs` | CSV validation and source preservation |
| `server/pdf.mjs` | Local text-based PDF extraction |
| `server/index.mjs` | Local HTTP API and built-app hosting |
| `server/hosting.mjs` | Hosted access code, origin checks and shared request limits |
| `public/samples/` | Fictional sample source files |
| `tests/` | Automated regression checks |

## Before a hackathon submission

This prototype is not yet a completed hackathon submission. Follow `HACKATHON_PLAN.md` to evaluate live inference more broadly, conduct a real operator pilot, verify a judge-accessible deployment, and record the video under three minutes. The deployment configuration is included; a working public demo URL and video must still be supplied. No messages to operators or customers, or real warehouse actions, have been performed.

MIT licensed. The interface uses Lucide icons (ISC license) and DM Sans via Google Fonts with system-font fallbacks. Text rendering still works without the font service.
