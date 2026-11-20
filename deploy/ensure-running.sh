#!/bin/sh
# Runs on the hosting server. Starts the website and the Cloudflare Tunnel if
# either is not running. Cron calls it at boot and every minute, and
# scripts/deploy.sh calls it after publishing a new build.
#
# The website listens on 127.0.0.1 only; visitors reach it through the tunnel,
# so the server's address never appears in DNS.
set -u

APP="$HOME/micolabs"
NODE="$HOME/.local/opt/node/bin/node"
CLOUDFLARED="$HOME/.local/bin/cloudflared"
TOKEN="$HOME/.cloudflared/tunnel-token"
LOGS="$APP/logs"
ME="$(id -u)"

mkdir -p "$LOGS"

# Keep each log to about 5 MB plus one previous copy.
for log in "$LOGS/site.log" "$LOGS/tunnel.log"; do
  if [ -f "$log" ] && [ "$(wc -c < "$log")" -gt 5000000 ]; then
    mv "$log" "$log.1"
  fi
done

if ! pgrep -u "$ME" -f "$APP/dist/server/entry.mjs" > /dev/null; then
  cd "$APP" || exit 1
  HOST=127.0.0.1 PORT=4321 setsid nohup "$NODE" --env-file-if-exists=.env \
    "$APP/dist/server/entry.mjs" >> "$LOGS/site.log" 2>&1 < /dev/null &
fi

if ! pgrep -u "$ME" -x cloudflared > /dev/null; then
  setsid nohup "$CLOUDFLARED" tunnel --no-autoupdate run --token-file "$TOKEN" \
    >> "$LOGS/tunnel.log" 2>&1 < /dev/null &
fi
