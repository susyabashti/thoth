set shell := ["bash", "-uc"]

# List available recipes
default:
    @just --list

# Install dependencies
install:
    bun install --frozen-lockfile

# Type-check the project
check:
    bunx tsc --noEmit

# Trigger a dry-run of the publish workflow on GitHub (no packages touched)
dry-run tag="v0.0.0-test":
    gh workflow run publish.yml -f dry_run=true -f fake_tag={{tag}}
    @echo "Check progress with: gh run watch"

# Bump version, tag, push, and create a GitHub release.
# bun pm version bumps package.json AND creates the git tag in one atomic step,
# so they can never drift out of sync. Creating the GitHub release triggers
# the publish.yml workflow automatically.
release bump="patch": check
    #!/usr/bin/env bash
    set -euo pipefail

    if [[ -n $(git status --porcelain) ]]; then
      echo "Working tree not clean — commit or stash changes first." >&2
      exit 1
    fi

    current_branch=$(git branch --show-current)
    if [[ "$current_branch" != "main" ]]; then
      echo "Not on main (currently on $current_branch) — aborting." >&2
      exit 1
    fi

    git pull --ff-only

    # Bumps package.json version + creates matching git tag (e.g. v0.2.0)
    bun pm version {{bump}}

    git push --follow-tags

    version=$(jq -r .version package.json)
    gh release create "v${version}" --generate-notes --title "v${version}"

    echo "✅ Released v${version} — publish.yml will run automatically."
