# PAYMENT_WEBHOOKS Security Report

## Status: N/A

## Findings

No Stripe or other payment webhook implementation was found in the audited application.

- Searches for `stripe`, `payment_intent`, `invoice.payment_failed`, `customer.subscription.deleted`, and `construct_event` returned no payment-processing code.
- The only webhook system present is the app's Discord/editorial/operational/security notification pipeline:
  - [server/routes/register-integration-routes.js](/d:/dev/nekomorto/server/routes/register-integration-routes.js)
  - [server/lib/webhooks/](/d:/dev/nekomorto/server/lib/webhooks)

## What's at risk

If payment webhooks are added later without signature verification and idempotency, attackers could forge billing events or replay them.

## What's already secure

- No payment webhook endpoint is currently exposed.
- Existing non-payment webhooks are provider-validated and audited separately.

## Recommendations

1. If Stripe or another payment provider is added later, require signature verification and idempotency from day one.
2. Add explicit handlers for success, failure, cancellation, and past-due lifecycle events if payments are introduced.
