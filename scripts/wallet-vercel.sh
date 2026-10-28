#!/usr/bin/env bash
# Copies the three GOOGLE_WALLET_* values from .env.local to Vercel Production
# without printing them. Run from anywhere:
#   bash ~/Projects/def-startup/scripts/wallet-vercel.sh
set -euo pipefail
cd "$(dirname "$0")/.."

for name in GOOGLE_WALLET_ISSUER_ID GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL GOOGLE_WALLET_PRIVATE_KEY; do
  value="$(grep -E "^${name}=" .env.local | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"
  if [ -z "$value" ]; then echo "Missing $name in .env.local" >&2; exit 1; fi
  npx --yes vercel@latest env rm "$name" production --yes >/dev/null 2>&1 || true
  printf '%s' "$value" | npx --yes vercel@latest env add "$name" production >/dev/null
  echo "OK: $name added to Vercel Production"
done
