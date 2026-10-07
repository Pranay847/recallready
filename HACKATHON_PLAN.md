# RecallReady: path to a credible hackathon entry

## Product claim

RecallReady helps small food distributors turn a recall notice and scattered receiving/shipping records into an evidence-backed response. It exposes missing lot information, lets an operator resolve the gap, then updates affected stock and customer shipments.

The initial build is a working local prototype. The demo figures describe an invented fixture, not real customers, measured time savings, or model performance.

## Next checkpoints

1. **Verify live inference.** Configure a Nebius key and run both a recall notice and a receiving document through Nemotron. Save actual model, input/output token usage, latency, failures and operator corrections. Check that source excerpts and product identifiers are accurate.
2. **Interview three operators.** Find independent specialty-food distributors or wholesalers. Ask for a walkthrough of their last recall or recall drill and permission to use redacted example records. Confirm where lot information lives and how stock movements are reconciled.
3. **Run one supervised pilot.** Use a historical notice with authorized, redacted records. Have the operator establish the correct affected lots and shipments before evaluating the app. Record mistakes as carefully as successes.
4. **Create a held-out evaluation.** Separate development examples from test cases. Include exact matches, unrelated UPCs, conflicting SKU/UPC, similar names, missing lots, lots outside the list, unreadable scans and notices with unsupported scope restrictions. Compare the complete workflow to keyword matching and a single model extraction. Report detection precision/recall, unresolved-rate, incorrect exclusions, operator corrections, end-to-end time and measured cost.
5. **Prepare a judge-accessible demo.** Use `DEPLOY.md` and the included Render Blueprint/Docker configuration. Hosted mode adds a judge code for live extraction and shared request limits. Deploy the service, then verify the public sample, blocked unauthorized AI access and a live extraction over HTTPS before sharing the URL.
6. **Finish the submission.** Publish the source with its license and README, supply a working demo URL, record a public YouTube video under three minutes, and provide specific feedback on Nebius/NVIDIA tooling.

## Interview guide

- When a supplier sends a recall, what do you open first?
- Show the steps from the notice to the affected stock and customers.
- Are lot codes present on invoices, receiving sheets, package labels or elsewhere?
- What happens when a lot number is missing?
- Which quantities come from receipts, current stock and dispatched shipments?
- What evidence must another person see before approving a response?
- Which mistake would make this tool unusable?
- Can we run a supervised drill with redacted records and compare the result with yours?

No interviews have been conducted for this build, and no interview invitations have been sent.

## Three-minute demo storyboard

| Time | Show | Explain |
|---|---|---|
| 0:00–0:20 | Original notice, inventory and shipment records | Who uses the product and why missing lot evidence interrupts a recall response |
| 0:20–0:55 | Document extraction and operator scope review | Show a real Nebius/Nemotron runtime call and what the operator confirms |
| 0:55–1:30 | Inventory trace and linked source excerpts | Distinguish confirmed matches, exclusions and uncertainty |
| 1:30–2:15 | Resolve INV-103 using the sample receiving note | Show totals changing from 42/52/3 to 54/60/4; clearly identify this as a synthetic drill |
| 2:15–2:40 | Hold checklist, unsent customer drafts, exported report | Show a complete response workflow and honest action status |
| 2:40–2:55 | Actual evaluation and operator feedback | Report measured results, limitations and which sponsor services were used |

Do not present the provided source-link checks as proof that Nemotron itself is accurate. The model evaluation requires live runs and independent labels.

## Scope limits to keep visible

The current engine supports one packaged product, a complete explicit lot list and whole cartons. It does not evaluate geography, expiration dates, multiple product variants in one notice, ingredient transformations, complex range rules, inventory movements over time or recalled-product disposal requirements. Invoice stock values require manual confirmation. Image-only PDFs and photos need an OCR/vision extension.

Tavily integration is optional future work: retrieving manufacturer evidence could be useful after the main workflow is reliable. It has not been implemented or claimed as used in this build.

## Official references

- [Hackathon overview and submission requirements](https://nebiusglobalaihackathon.devpost.com/)
- [Official rules](https://nebiusglobalaihackathon.devpost.com/rules)
- [Nebius Token Factory quickstart](https://docs.tokenfactory.nebius.com/quickstart)
- [Nebius structured outputs](https://docs.tokenfactory.nebius.com/ai-models-inference/json)
- [FDA recall identification guidance](https://www.fda.gov/food/buy-store-serve-safe-food/food-recalls-what-you-need-know)

The event page consulted during planning listed October 30, 2026 at 10:00 a.m. Pacific as the submission deadline. Recheck the organizer’s current rules before submission and keep the demo accessible for the required judging period.
