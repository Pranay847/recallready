# Hosted hackathon demo

The public sample drill needs no account. Live Nemotron extraction requires a
judge access code. Both the Nebius key and the access code are runtime secrets,
never files in the repository or Docker image. Give judges the access code in
the private Devpost testing instructions, not in the public repository.

## Render Free deployment

1. Publish this folder as the root of a public GitHub repository.
2. In Render, create a Blueprint from the repository's `render.yaml`.
3. Confirm that the service plan is **Free**. Paste the Nebius API key in the
   `NEBIUS_API_KEY` secret field. Render generates `DEMO_ACCESS_CODE` for you.
4. Deploy. Render supplies `RENDER_EXTERNAL_URL`; the app uses it to validate
   public hostnames and request origins. A custom domain requires setting
   `PUBLIC_URL` to its exact HTTPS origin instead.
5. After the service is live, visit its HTTPS URL. Check the sample drill first.
6. Retrieve `DEMO_ACCESS_CODE` from the service's Environment settings and enter
   it under **AI connection**. Run a fictional notice and receiving document.
7. Give judges the demo URL, this access code, and the test sequence below.

Render Free services sleep after inactivity, so the first request can be slow.
Free instances and included bandwidth/build minutes have provider limits.
Review them at https://render.com/docs/free before publishing the demo URL.
Auto-deploy is off: deploy a reviewed commit manually after tests pass.

## Other container hosts

Build `Dockerfile`, set `RECALLREADY_HOSTED=true`, `PUBLIC_URL` to the actual
HTTPS origin, `NEBIUS_API_KEY`, and a random `DEMO_ACCESS_CODE` of at least
16 characters. The app listens on `0.0.0.0:$PORT` (default 4317). The platform
must terminate TLS and forward requests with the public Host header. Health
checks use `/api/health`, which also allows a loopback Host header.

The runtime image runs as an unprivileged user. It includes the built frontend,
server, public sample data, and production dependencies only. The `.env` file
is excluded from both Git and the Docker build context.

## Usage limits and data

- Live AI: 20 attempts per hour per server process, at most 2 concurrent;
  20,000 input characters per request. Failed provider attempts count too.
- Model output: at most 4,096 tokens for notices and 8,192 for inventory.
- PDF extraction: 10 requests per minute per process.
- All API mutations: 240 requests per minute per process.
- These shared limits reset on restart or instance replacement. They are abuse
  controls, **not a persistent spending cap**. Use one instance and check the
  Nebius balance/usage. Configure provider budget controls where available.
- Only fictional data is intended for this public demonstration. Cases remain
  in each visitor's browser. There is no shared database or multi-user account.
- The access code stays in tab memory and is forgotten on refresh. The provider
  key never reaches the browser. Extraction must remain explicitly requested.

## Judge test sequence

1. Load the sample drill: 42 warehouse cartons, 52 dispatched, 3 customers,
   1 gap. All names and records in the drill are fictional.
2. Verify INV-103 using its sample receiving note: 54 warehouse cartons,
   60 dispatched, 4 customers, 0 gaps.
3. Open Response packet, review drafts and export the HTML report.
4. Open AI connection and unlock with the separately supplied judge code.
5. In Source records, paste a fictional recall notice and choose extraction.
   Confirm that the fields and cited source appear for operator review.

The health endpoint's `aiConfigured` means a key is present; only a successful
extraction demonstrates live model access.

## Rollback

Use the host's rollback/redeploy action to restore the last verified commit or
image. No database migration is needed. Confirm `/api/health`, the sample
drill, and blocked extraction without a code after rollback. Do not remove the
judge access code while leaving paid extraction enabled; startup rejects that
configuration.

## Verification before sharing

Run `npm test` and `npm run build`. The repository's GitHub Actions workflow
also builds the Docker image on Linux. Test the deployed HTTPS URL, unauthorized
AI access, and one live extraction before marking the demo as deployed.
