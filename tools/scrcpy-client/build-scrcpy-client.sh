#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
SCRCPY_PROJECT=${SCRCPY_PROJECT_ROOT:-"$SCRIPT_DIR/../../../scrcpy"}
if [ ! -d "$SCRCPY_PROJECT" ]; then
	echo "HarmonyOS scrcpy project does not exist: $SCRCPY_PROJECT" >&2
	exit 1
fi
PROJECT_ROOT=$(CDPATH='' cd -- "$SCRCPY_PROJECT" && pwd)
SCRCPY_SOURCE=${SCRCPY_SOURCE:-"$PROJECT_ROOT/third-party/scrcpy"}
BUILD_DIR=${SCRCPY_CLIENT_BUILD_DIR:-"$SCRCPY_SOURCE/build-harmony"}
EXPECTED_VERSION=4.1

if [ ! -f "$SCRCPY_SOURCE/meson.build" ]; then
	echo "scrcpy source does not exist: $SCRCPY_SOURCE" >&2
	exit 1
fi

SOURCE_VERSION=$(sed -n "s/.*version: '\([^']*\)'.*/\1/p" "$SCRCPY_SOURCE/meson.build" | sed -n '1p')
if [ "$SOURCE_VERSION" != "$EXPECTED_VERSION" ]; then
	echo "scrcpy source version must be $EXPECTED_VERSION, got ${SOURCE_VERSION:-unknown}" >&2
	exit 1
fi

if [ -f "$BUILD_DIR/build.ninja" ]; then
	meson setup --reconfigure "$BUILD_DIR" "$SCRCPY_SOURCE" \
		--buildtype=release \
		-Dcompile_app=true \
		-Dcompile_server=false \
		-Dusb=false
else
	meson setup "$BUILD_DIR" "$SCRCPY_SOURCE" \
		--buildtype=release \
		-Dcompile_app=true \
		-Dcompile_server=false \
		-Dusb=false
fi

meson compile -C "$BUILD_DIR"

CLIENT="$BUILD_DIR/app/scrcpy"
if [ ! -x "$CLIENT" ]; then
	echo "scrcpy client was not produced: $CLIENT" >&2
	exit 1
fi

ACTUAL_VERSION=$($CLIENT --version | sed -n '1s/^scrcpy \([^ ]*\).*/\1/p')
if [ "$ACTUAL_VERSION" != "$EXPECTED_VERSION" ]; then
	echo "built scrcpy version must be $EXPECTED_VERSION, got ${ACTUAL_VERSION:-unknown}" >&2
	exit 1
fi

echo "scrcpy_client=$CLIENT"
