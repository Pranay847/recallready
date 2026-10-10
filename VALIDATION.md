# Validation record

Validated locally on Windows with Node 24.11.1, September 6–8, October 6 and October 10, 2026.

## Automated checks

`npm test`: **56 passing, 0 failing** (October 10), including the additional CSV checks published on October 8.

Coverage includes exact product/lot decisions, missing and conflicting identifiers, initial and resolved drill totals, shipment links, malformed quantities and CSVs, source provenance, text-PDF extraction, image-only PDF rejection, local-host and origin checks, secret-free health responses, unconfigured inference, structured model-response handling, candidate invoice quantities, state restoration, stale analysis and export escaping.

`npm run build`: **passed**. React/Vite production assets are generated in `dist/`.

Dependency audit: **0 reported vulnerabilities** after updating PDF.js to 6.4.299 and source-map-js to its patched release. The PDF text-extraction and image-only rejection checks pass with the updated loading-task cleanup API.

Hosted-mode checks cover required HTTPS configuration, secret-free health output, allowed host/origin checks, missing/incorrect judge codes blocking provider calls, input-size limits, concurrency slots, hourly extraction limits, and shared PDF/API request limits. These tests use controlled model responses, not live inference.

On October 6, the production frontend was checked in a browser through a local proxy running hosted mode: sample totals loaded, an incorrect judge code was rejected, the valid test code unlocked extraction, the extracted candidate required operator review, and refreshing cleared the unlock. This used a fixture provider response and does not establish live inference or public TLS availability.

The Linux container build and startup checks passed in [GitHub Actions](https://github.com/Pranay847/recallready/actions/runs/37572183697). They verify health, the frontend, public sample access and blocked unauthenticated extraction.

## Public deployment check, October 10

[recallready.onrender.com](https://recallready.onrender.com) is deployed on Render Free. The verified deployment at the start of this check was `f35ad92`.

- Public HTTPS health returned 200 with hosted mode, a configured model and required judge access.
- Extraction without a judge code returned 401; the generated judge code unlocked the browser session.
- The initial sample showed 42 warehouse cartons, 52 dispatched cartons, 3 customers and 1 gap. Verifying INV-103 changed this to 54 / 60 / 4 / 0.
- The reviewed HTML packet downloaded successfully and retained the resolved record, affected quantities, customer drafts and synthetic-data label.
- A live fictional recall notice reached Nebius but returned HTTP 402. No candidate was produced or silently substituted. Hosted notice inference and receiving-document inference remain blocked pending the account's credit/billing resolution.
- A regression check covers the clearer credit-recovery message in both extraction paths, with no retries or provider response details exposed.

Render's idle startup delay was observed. No paid hosting or account top-up was purchased.

## Completed browser checks

| Check | Observed result |
|---|---|
| Initial sample | 42 warehouse cartons; 52 dispatched cartons; 3 customers; 1 evidence gap |
| Verify INV-103 | 54 warehouse cartons; 60 dispatched cartons; 4 customers; 0 evidence gaps |
| Customer grouping | Lakeview Market 24, Juniper Grocery 12, Birch Corner Store 8, Harbor Pantry 16 cartons after resolution |
| Operator hold and export | Practice hold recorded; reviewed HTML packet downloaded successfully |
| Manual receiving-document intake | 20 cartons received in the source, 7 current cartons entered; trace used 7, not 20 |
| Case replacement | Custom RX-900 inventory replaced by the sample without stale-result crashes; 6 sample records restored |
| Invalid CSV | Non-numeric quantity rejected with row-specific error; existing inventory retained |
| CSV round trip | Imported synthetic inventory and shipment templates reproduced 42 / 52 / 3 / 1 totals |
| Inventory search | Searching INV-103 returned one matching row |
| Connection status | Correctly reported an absent key initially; reported configured after a key was added and the server restarted |
| Live recall notice extraction | Harbor Mill fictional notice opened the scope-review dialog with correct product, brand, SKU HM-SES-40, lots HM-260901-A and HM-260901-B, date 2026-09-08 and blank unknown UPC; confirmation required operator review |
| API outage | Simulated failed analysis showed unavailable determinations, with no reconciled-success message; Retry check restored results |
| Mobile | Navigation, evidence dialog and Escape close worked at 390 × 844; final page width stayed within the viewport |
| Final desktop | Fresh sample restored and preview captured at 1440 × 1080 |

Some browser checks intentionally generated 400/503 responses. Those expected HTTP errors do not indicate an unhandled application failure. A hidden table-label overflow discovered during mobile testing was corrected and retested.

## Live extraction repair, September 8

An authenticated request accepted the response-format setting but returned unexpected fields (`quote` and `lot_codes`). Adding the full JSON schema and explicit JSON-only instructions to the system prompt produced the required fields. The normal browser extraction route then completed using `nvidia/nemotron-3-super-120b-a12b` in approximately 2.6 seconds with 1,101 total tokens. Server source-quote validation passed. The candidate was left pending operator review.

The parser accepts one complete outer Markdown code fence while retaining normal field and exact-source validation. It rejects partial JSON, prose surrounding JSON, multiple objects, truncated responses and refusals. Regression tests cover these cases and verify that notice and receiving-document prompts include the requested schema.

## Limits of this evidence

- Live notice extraction was verified for one fictional scenario. Live receiving-document extraction remains unverified. External model responses are controlled fixtures in automated tests; this is not a model-quality benchmark.
- The sample is fictional. No real distributor pilot, timing study, accuracy benchmark or customer validation has occurred.
- Image-only PDF OCR, photo/vision intake and Tavily are not implemented. The hosted sample was verified; hosted live inference still needs a successful run after the credit issue is resolved.
- This is a prototype, not a certification of food safety or production readiness.

`sample-response.html` is the actual response downloaded during the synthetic drill. Its operator-review flag and hold confirmation are test actions, not real business actions. `preview.png` shows the initial local sample workspace.
