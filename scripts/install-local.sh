#!/bin/sh
set -eu
SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
TOOLS_ROOT=$(CDPATH='' cd -- "$SCRIPT_DIR/.." && pwd)
NODE="$TOOLS_ROOT/official/command-line-tools/tool/node/bin/node"
INSTALLER="$TOOLS_ROOT/tools/huawei-cli/scripts/install-local.mjs"
case "${1:-}" in
  --help|-h) exec "$NODE" "$INSTALLER" "$@" ;;
esac
if [ "$#" -ne 0 ]; then
  echo "用法：$0（查看帮助使用 --help）" >&2
  exit 1
fi
"$NODE" "$TOOLS_ROOT/tools/huawei-cli/node_modules/typescript/bin/tsc" -p "$TOOLS_ROOT/tools/huawei-cli/tsconfig.json"
exec "$NODE" "$INSTALLER"
