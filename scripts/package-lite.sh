#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd -P)
ROOT=$(CDPATH='' cd -- "$SCRIPT_DIR/.." && pwd -P)
PARENT=$(dirname -- "$ROOT")
ARCHIVE_ROOT_NAME=$(basename -- "$ROOT")
OUTPUT=${1:-"$PARENT/huawei-dev-tools-lite-$(date +%Y%m%d)-macos-arm64.tar.gz"}
OUTPUT_DIRECTORY=$(CDPATH='' cd -- "$(dirname -- "$OUTPUT")" && pwd -P)
OUTPUT="$OUTPUT_DIRECTORY/$(basename -- "$OUTPUT")"

case "$OUTPUT" in
"$ROOT"/*)
	echo "压缩包不能放进 huawei-dev-tools 自身目录：$OUTPUT" >&2
	exit 1
	;;
esac

COPYFILE_DISABLE=1 tar \
	--exclude="$ARCHIVE_ROOT_NAME/official/command-line-tools" \
	--exclude="$ARCHIVE_ROOT_NAME/official/installers" \
	--exclude="$ARCHIVE_ROOT_NAME/.git" \
	--exclude="$ARCHIVE_ROOT_NAME/.hvigor" \
	--exclude="$ARCHIVE_ROOT_NAME/tools/huawei-cli/data" \
	--exclude="$ARCHIVE_ROOT_NAME/tools/huawei-cli/docs" \
	--exclude="$ARCHIVE_ROOT_NAME/.env" \
	--exclude="$ARCHIVE_ROOT_NAME/.env.*" \
	--exclude='*/.trash' \
	--exclude='*/.tmp' \
	--exclude="$ARCHIVE_ROOT_NAME/.DS_Store" \
	--exclude="$ARCHIVE_ROOT_NAME/**/.DS_Store" \
	-czf "$OUTPUT" \
	-C "$PARENT" "$ARCHIVE_ROOT_NAME"

shasum -a 256 "$OUTPUT" | tee "$OUTPUT.sha256"
