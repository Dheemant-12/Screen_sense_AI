#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

PYTHON_CMD="${PYTHON_CMD:-python3}"

if ! command -v "$PYTHON_CMD" >/dev/null 2>&1; then
  if command -v python >/dev/null 2>&1; then
    PYTHON_CMD="python"
  else
    echo "Python was not found on PATH."
    echo "Install Python 3.10 or newer, then run this script again."
    exit 1
  fi
fi

"$PYTHON_CMD" --version
"$PYTHON_CMD" -m pip install -r requirements-local-whisper.txt
"$PYTHON_CMD" local_whisper_server.py
