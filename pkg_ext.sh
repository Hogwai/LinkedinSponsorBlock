#!/usr/bin/env bash
set -euo pipefail

# Check arguments
if [ -z "${1:-}" ]; then
  echo "Usage: $0 <platform>"
  echo
  echo "Examples:"
  echo "  $0 firefox"
  echo "  $0 chrome"
  exit 1
fi

PLATFORM="$1"

# Validate platform
if [[ "$PLATFORM" != "firefox" && "$PLATFORM" != "chrome" ]]; then
  echo "❌ Available platforms: firefox, chrome"
  exit 1
fi

# Read version from versions.json
VERSION=$(jq -r ".$PLATFORM" versions.json)

case "$PLATFORM" in
  firefox)
    if ! command -v web-ext >/dev/null 2>&1; then
      echo "❌ Error: web-ext not found."
      echo "   Install it with: npm install -g web-ext"
      exit 1
    fi

    echo "🔍 Linting Firefox extension..."
    web-ext lint -s dist/firefox

    echo "📦 Building Firefox extension..."
    web-ext build -s dist/firefox
    ;;

  chrome)
    if ! command -v zip >/dev/null 2>&1; then
      echo "❌ Error: zip utility not found. Install it (e.g., 'apt install zip' or 'brew install zip')"
      exit 1
    fi

    OUTFILE="LinkedinSponsorBlock-chrome-${VERSION}.zip"
    rm -f "$OUTFILE"

    echo "📦 Creating Chrome archive (v${VERSION})..."
    cd dist/chrome
    zip -r -q "../../$OUTFILE" .
    cd ../..
    echo "✅ Archive created: $OUTFILE"
    ;;
esac

echo "🎉 Operation completed for $PLATFORM!"
