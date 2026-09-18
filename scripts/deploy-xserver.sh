#!/usr/bin/env bash
set -euo pipefail

: "${XSERVER_HOST:?Set XSERVER_HOST}"
: "${XSERVER_USER:?Set XSERVER_USER}"
: "${XSERVER_SSH_KEY:?Set XSERVER_SSH_KEY}"
: "${XSERVER_KNOWN_HOSTS:?Set XSERVER_KNOWN_HOSTS}"
[[ "$XSERVER_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]+$ ]] || exit 1
[[ "$XSERVER_USER" =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]*$ ]] || exit 1
test -s dist/index.html
test -s dist/.htaccess
test -d dist/assets

ssh_dir=$(mktemp -d)
trap 'rm -rf -- "$ssh_dir"' EXIT
chmod 700 "$ssh_dir"
printf '%s\n' "$XSERVER_SSH_KEY" | tr -d '\r' > "$ssh_dir/key"
printf '%s\n' "$XSERVER_KNOWN_HOSTS" > "$ssh_dir/known_hosts"
chmod 600 "$ssh_dir/key" "$ssh_dir/known_hosts"
export RSYNC_RSH="ssh -p 10022 -i $ssh_dir/key -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$ssh_dir/known_hosts"
ssh_options=(-p 10022 -i "$ssh_dir/key" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$ssh_dir/known_hosts")
target="$XSERVER_USER@$XSERVER_HOST"
# Fixed, scoped destination; never delete existing assets or touch the parent site.
destination="/home/$XSERVER_USER/merylomm.com/public_html/waripon"
ssh "${ssh_options[@]}" "$target" "test -d '$destination'"
rsync -rtz --chmod=D755,F644 --exclude='index.html' --exclude='*.zip' dist/ "$target:$destination/"
# Publish HTML only after all its assets are present. Rename is atomic.
rsync -tz --chmod=F644 dist/index.html "$target:$destination/.index-deploy.html"
ssh "${ssh_options[@]}" "$target" "mv -f '$destination/.index-deploy.html' '$destination/index.html'"
