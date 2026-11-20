#!/usr/bin/env bash
# Builds the site on this machine and publishes it to the hosting server.
#
#   npm run deploy
#
# Needs an SSH host alias (default "friend", override with DEPLOY_HOST) and,
# on the server, Node in ~/.local/opt/node, cloudflared in ~/.local/bin and the
# tunnel token in ~/.cloudflared/tunnel-token. Contact-form secrets live in
# ~/micolabs/.env on the server and are never copied from here.
set -euo pipefail

SERVER="${DEPLOY_HOST:-friend}"
cd "$(dirname "$0")/.."

npm run build

ssh "$SERVER" 'mkdir -p ~/micolabs/bin ~/micolabs/logs'
rsync -az --delete dist/ "$SERVER:micolabs/dist/"
rsync -az package.json package-lock.json "$SERVER:micolabs/"
rsync -az --chmod=u=rwx,go= deploy/ensure-running.sh "$SERVER:micolabs/bin/"

ssh "$SERVER" 'bash -s' <<'REMOTE'
set -euo pipefail
cd ~/micolabs
export PATH="$HOME/.local/opt/node/bin:$PATH"

# Reinstall runtime dependencies only when the lockfile changed.
if [ ! -d node_modules ] || ! sha256sum --quiet -c .installed-lock 2> /dev/null; then
  npm ci --omit=dev --no-audit --no-fund
  sha256sum package-lock.json > .installed-lock
fi

# Start everything at boot and restart anything that stops, checked every minute.
ensure="$HOME/micolabs/bin/ensure-running.sh"
{ crontab -l 2> /dev/null | grep -vF "$ensure" || true
  echo "@reboot $ensure"
  echo "* * * * * $ensure"
} | crontab -

# Restart the website on the new build.
pkill -u "$(id -u)" -f "$HOME/micolabs/dist/server/entry.mjs" || true
for _ in $(seq 20); do
  pgrep -u "$(id -u)" -f "$HOME/micolabs/dist/server/entry.mjs" > /dev/null || break
  sleep 0.5
done
"$ensure"

for _ in $(seq 30); do
  if curl -fs -o /dev/null http://127.0.0.1:4321/; then
    echo "Website is running on the server."
    exit 0
  fi
  sleep 1
done
echo "The website did not answer after 30 seconds. Recent log:" >&2
tail -n 30 logs/site.log >&2
exit 1
REMOTE
