#!/usr/bin/env bash
set -euo pipefail
cd /workspace/Outlook_Clone
export npm_config_cache=/workspace/.cache/npm
export electron_config_cache=/workspace/.cache/electron
export ELECTRON_BUILDER_CACHE=/workspace/.cache/electron-builder
export XDG_CACHE_HOME=/workspace/.cache
export NODE_USE_ENV_PROXY=1
node -e "if(Number(process.versions.node.split('.')[0])<24) throw new Error('Node.js 24 oder neuer erforderlich');"
npm ci --no-audit --no-fund
# Electron 44 requires an explicit, checksum-verified binary installation.
node node_modules/electron/install.js
bash scripts/cloud-tools.sh
npm run build
npm test
