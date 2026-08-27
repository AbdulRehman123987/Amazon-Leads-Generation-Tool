#!/bin/sh
# `prisma generate` needs to download a schema-engine binary the first time
# it runs for a given Prisma version/platform. In some Docker network setups
# Node's fetch cannot complete that download (it hangs/times out) even though
# a plain wget against the same URL works fine. To avoid depending on which
# behavior a given build host has, this script always fetches the engine
# itself via wget into Prisma's cache dir ($XDG_CACHE_HOME must be set), then
# serves that cache over a loopback HTTP server so `prisma generate` only
# ever talks to 127.0.0.1 — never to the outside network.
set -e

if [ -z "$XDG_CACHE_HOME" ]; then
  echo "XDG_CACHE_HOME must be set before running this script" >&2
  exit 1
fi

ENGINE_VERSION=$(node -p "require('@prisma/engines-version').enginesVersion")
PLATFORM="linux-musl-openssl-3.0.x"
CACHE_DIR="$XDG_CACHE_HOME/prisma/all_commits/$ENGINE_VERSION/$PLATFORM"
mkdir -p "$CACHE_DIR"

echo "Fetching schema-engine ($ENGINE_VERSION, $PLATFORM) via wget..."
wget -q -P "$CACHE_DIR" \
  "https://binaries.prisma.sh/all_commits/$ENGINE_VERSION/$PLATFORM/schema-engine.gz" \
  "https://binaries.prisma.sh/all_commits/$ENGINE_VERSION/$PLATFORM/schema-engine.gz.sha256" \
  "https://binaries.prisma.sh/all_commits/$ENGINE_VERSION/$PLATFORM/schema-engine.sha256"

MIRROR_ROOT="/tmp/prisma-mirror-root"
mkdir -p "$MIRROR_ROOT"
ln -sfn "$XDG_CACHE_HOME/prisma" "$MIRROR_ROOT/prisma-cache-link"
node -e "
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join('$MIRROR_ROOT', 'prisma-cache-link');
http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url));
  fs.readFile(p, (err, data) => {
    if (err) { res.statusCode = 404; res.end(); return; }
    res.end(data);
  });
}).listen(4873, '127.0.0.1', () => console.log('local prisma engine mirror up on :4873'));
" &
MIRROR_PID=$!
trap 'kill $MIRROR_PID 2>/dev/null || true' EXIT

# give the server a moment to start listening
for i in 1 2 3 4 5; do
  wget -q -O /dev/null "http://127.0.0.1:4873/" >/dev/null 2>&1 && break
  sleep 0.5
done

echo "Running prisma generate against the local mirror..."
PRISMA_ENGINES_MIRROR="http://127.0.0.1:4873" PRISMA_BINARIES_MIRROR="http://127.0.0.1:4873" npx prisma generate
