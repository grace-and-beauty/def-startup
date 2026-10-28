#!/usr/bin/env bash
# Puts the Google Wallet service-account key into .env.local without printing it.
#   bash scripts/wallet-env.sh ~/Downloads/<key-file>.json
# Writes GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL and GOOGLE_WALLET_PRIVATE_KEY
# (one line, newlines as \n — docs/google-wallet-test-plan.md §2).
set -euo pipefail

key_file="${1:?Usage: bash scripts/wallet-env.sh <key-file>.json}"
env_file="$(cd "$(dirname "$0")/.." && pwd)/.env.local"

KEY_FILE="$key_file" ENV_FILE="$env_file" node <<'EOF'
const fs = require("node:fs");
const key = JSON.parse(fs.readFileSync(process.env.KEY_FILE, "utf8"));
if (!key.client_email || !key.private_key) throw new Error("Not a service-account key file");
const values = {
  GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL: key.client_email,
  // Quoted: the key has spaces ("BEGIN PRIVATE KEY"), and shells `source` .env.local too.
  GOOGLE_WALLET_PRIVATE_KEY: `"${key.private_key.replace(/\n/g, "\\n")}"`,
};
let env = fs.existsSync(process.env.ENV_FILE) ? fs.readFileSync(process.env.ENV_FILE, "utf8") : "";
for (const [name, value] of Object.entries(values)) {
  const line = `${name}=${value}`;
  const re = new RegExp(`^${name}=.*$`, "m");
  env = re.test(env) ? env.replace(re, () => line) : `${env.replace(/\n?$/, "\n")}${line}\n`;
}
fs.writeFileSync(process.env.ENV_FILE, env);
console.log(`OK: key for ${key.client_email} saved to .env.local`);
EOF
