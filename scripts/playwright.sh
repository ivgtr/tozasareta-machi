#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(dirname -- "$script_dir")"
user_data_dir="${XDG_DATA_HOME:-${HOME}/.local/share}"
playwright_lib_dir="${PLAYWRIGHT_LIB_DIR:-${user_data_dir}/playwright-deps/usr/lib/x86_64-linux-gnu}"

if [[ -d "$playwright_lib_dir" ]]; then
  export LD_LIBRARY_PATH="${playwright_lib_dir}${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"
fi

exec "$project_dir/node_modules/.bin/playwright" "$@"
