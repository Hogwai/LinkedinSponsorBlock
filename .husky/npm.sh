#!/usr/bin/env sh

find_npm() {
    if command -v npm >/dev/null 2>&1; then
        command -v npm
        return 0
    fi

    if command -v npm.cmd >/dev/null 2>&1; then
        command -v npm.cmd
        return 0
    fi

    for path in \
        "/c/Program Files/nodejs/npm.cmd" \
        "/c/Program Files (x86)/nodejs/npm.cmd" \
        "/mnt/c/Program Files/nodejs/npm.cmd" \
        "/mnt/c/Program Files (x86)/nodejs/npm.cmd"
    do
        if [ -f "$path" ]; then
            printf '%s\n' "$path"
            return 0
        fi
    done

    return 1
}

NPM_CMD="$(find_npm)" || {
    echo "npm was not found in this Git shell; skipping npm-based hook checks." >&2
    echo "CI will still run the required validation/build checks." >&2
    exit 0
}
