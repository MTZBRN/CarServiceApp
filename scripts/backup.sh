#!/usr/bin/env bash
set -euo pipefail
umask 077
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
command -v python3 >/dev/null || { printf '%s\n' 'Python 3.12+ with sqlite3 is required.' >&2; exit 1; }
exec python3 -I -S "$script_dir/ops_storage.py" backup "$@"
