#!/usr/bin/env bash
# Runs Blender on the Windows PC for the diorama models, through the restricted gate there
# (C:\pi-blender\gate.ps1; see the "blender-pc" entry in ~/.ssh/config). Files travel as base64.
#   blender-pc.sh put <file> [name]    copy a file into the PC's jobs folder
#   blender-pc.sh get <name> [file]    copy a file back
#   blender-pc.sh run <script.py> [args...]
#   blender-pc.sh script <local.py> [args...]  send a script compressed and run it (see boot.py)
#   blender-pc.sh ls
# Piped uploads over about 30 KB stall on the gate, so larger files should travel compressed.
set -euo pipefail
case "${1:-}" in
  put)
    # A stale session can hang silently: give each attempt a minute, then confirm the size arrived.
    name="${3:-$(basename "$2")}"
    for attempt in 1 2 3; do
      if base64 -w0 "$2" | timeout 60 ssh blender-pc put "$name" \
        && [ "$(timeout 30 ssh blender-pc ls | awk -F'\t' -v n="$name" '$1 == n { print $2 }' | tr -d '\r')" = "$(stat -c%s "$2")" ]; then exit 0; fi
      echo "upload of $name failed (attempt $attempt), retrying" >&2
    done
    exit 1 ;;
  get) ssh blender-pc get "$2" | base64 -d > "${3:-$2}" ;;
  run) shift; ssh blender-pc run "$@" ;;
  script)
    packed="$(mktemp --suffix=.gz)"; gzip -9 -c "$2" > "$packed"
    "$0" put "$packed" "$(basename "$2").gz"; rm -f "$packed"
    name="$(basename "$2").gz"; shift 2
    ssh blender-pc run boot.py "$name" "$@" ;;
  ls) ssh blender-pc ls ;;
  *) sed -n '2,10p' "$0"; exit 1 ;;
esac
