#!/bin/bash
# Swap Vercel PRODUCTION Stripe env to live keys and redeploy.
# Prompts read with hidden input — keys never echo or enter shell history.
# Preview/dev keep the test keys, so preview deploys stay a safe playground.
set -euo pipefail

cd "$(dirname "$0")/.."

read -rsp "Paste the LIVE secret key (sk_live_…): " SK; echo
read -rsp "Paste the LIVE webhook signing secret (whsec_…): " WH; echo

[[ $SK == sk_live_* ]] || { echo "✗ That doesn't start with sk_live_ — aborting (no changes made)."; exit 1; }
[[ $WH == whsec_* ]]   || { echo "✗ That doesn't start with whsec_ — aborting (no changes made)."; exit 1; }

echo "Replacing production env vars…"
vercel env rm STRIPE_SECRET_KEY production --yes >/dev/null 2>&1 || true
vercel env rm STRIPE_WEBHOOK_SECRET production --yes >/dev/null 2>&1 || true
printf '%s' "$SK" | vercel env add STRIPE_SECRET_KEY production >/dev/null
printf '%s' "$WH" | vercel env add STRIPE_WEBHOOK_SECRET production >/dev/null
unset SK WH
echo "✓ Production env updated (preview still on test keys)"

echo "Redeploying production…"
vercel --prod --yes

echo
echo "✓ Done. Smoke test: RSVP on https://www.m2021.co with a REAL card and"
echo "  watch the row flip pending → paid in Supabase within seconds."
