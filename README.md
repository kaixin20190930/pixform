# Pixform

English image-to-image studio built with Next.js App Router and deployed with OpenNext on Cloudflare Workers. The staged launch plan is in [docs/EXECUTION_CN.md](docs/EXECUTION_CN.md).

## Local preview

```sh
npm install
npm run dev -- --port 3100
```

The UI works without secrets; generation is explicitly unavailable until configured. `.dev.vars` is ignored by Git. Set `REPLICATE_API_TOKEN` there for Cloudflare local preview, never in a public variable. `JOB_SIGNING_SECRET` must have at least 32 characters. `REPLICATE_SDXL_VERSION` pins the verified `stability-ai/sdxl` model version.

## Cloudflare

Bindings:

- `DB`: D1 database `pixform`, jobs and atomic 10-attempt rolling one-hour IP quota.
- `MEDIA`: private R2 bucket `pixform-private-media`.
- `WORKER_SELF_REFERENCE`: OpenNext self-reference.

Platform Secrets: `REPLICATE_API_TOKEN`, `JOB_SIGNING_SECRET`, `REPLICATE_SDXL_VERSION`.

```sh
npm test
npm run typecheck
npm run cf:build
npm run preview
```

`npm run deploy` publishes the already-built artifact. Check account identity and the actual D1 ID first. Keep generation disabled until the model, private input fetch, output download, quota and hourly retention have been verified. Preview hosts receive `X-Robots-Tag: noindex, nofollow`; the canonical hostname `pixform.ai` is indexable.

The scheduled handler reconciles active jobs and deletes expired input/output objects once per minute. Signed media access also checks the database expiry; object deletion failures retain the job row for a later cleanup. Unknown provider POST outcomes are not automatically resubmitted. Only known transient terminal model errors receive one retry.

No GA4/Plausible property is configured yet. Frontend `pixform:event` hooks currently emit only in-browser events; they are not proof of analytics delivery. The live-model success rate and wait time remain unmeasured.

Email Routing must be configured and verified before publishing `hello@pixform.ai` as a working support mailbox. The destination address is intentionally absent from this repository.
