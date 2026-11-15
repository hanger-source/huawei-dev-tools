#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH='' cd -- "$SCRIPT_DIR/.." && pwd)
PARENT=$(dirname -- "$ROOT")
OUTPUT=${1:-"$PARENT/huawei-dev-tools-lite-$(date +%Y%m%d)-macos-arm64.tar.gz"}

case "$OUTPUT" in
"$ROOT"/*)
	echo "压缩包不能放进 huawei-dev-tools 自身目录：$OUTPUT" >&2
	exit 1
	;;
esac

COPYFILE_DISABLE=1 tar \
	--exclude='huawei-dev-tools/official/command-line-tools' \
	--exclude='huawei-dev-tools/official/installers/deveco-studio-26.0.0.621-aarch64.dmg' \
	--exclude='huawei-dev-tools/.hvigor' \
	--exclude='*/.trash' \
	--exclude='*/.tmp' \
	--exclude='huawei-dev-tools/.DS_Store' \
	--exclude='huawei-dev-tools/**/.DS_Store' \
	-czf "$OUTPUT" \
	-C "$PARENT" huawei-dev-tools

shasum -a 256 "$OUTPUT" | tee "$OUTPUT.sha256"
