#!/usr/bin/env bash
# Build the ZIP uploaded to OpenAI's plugin portal (ChatGPT + Codex directory).
#
# The package uses the Codex compatibility layout: .codex-plugin/plugin.json,
# .mcp.json, skills/ and assets/. Claude Code and Cursor manifests stay out of it,
# and so does the `setup` skill (its steps are written for Claude Code and Cursor).
# AGENTS.md is included because several skills link to it.
#
# Usage (from repo root):
#   scripts/build-openai-plugin-zip.sh            # writes dist/uptimerobot-openai-<version>.zip
set -euo pipefail

cd "$(dirname "$0")/.."

EXCLUDED_SKILLS=(setup)

fail() { echo "build-openai-plugin-zip: $*" >&2; exit 1; }

[ ! -e hooks ] || fail "hooks/ exists; OpenAI rejects packages with lifecycle hooks"
[ ! -e .app.json ] || fail ".app.json exists; OpenAI rejects packages with app references"

version="$(python3 -c 'import json; print(json.load(open(".codex-plugin/plugin.json"))["version"])')"

# Check the listing limits that final submission enforces.
python3 - <<'PY'
import json, sys
m = json.load(open(".codex-plugin/plugin.json"))
i = m["interface"]
errors = []
if m.get("mcpServers") != "./.mcp.json":
    errors.append('mcpServers must be "./.mcp.json"')
for key, limit in (("displayName", 30), ("shortDescription", 30), ("longDescription", 4000), ("developerName", 80)):
    if not i.get(key) or len(i[key]) > limit:
        errors.append(f"interface.{key} is missing or longer than {limit} characters")
for key in ("websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"):
    if not str(i.get(key, "")).startswith("https://"):
        errors.append(f"interface.{key} must be an HTTPS URL")
prompts = i.get("defaultPrompt", [])
if len(prompts) > 3 or any(len(p) > 128 or "@" in p for p in prompts) or len(set(prompts)) != len(prompts):
    errors.append("interface.defaultPrompt: at most 3 unique prompts, 128 characters each, no @mentions")
if i.get("screenshots"):
    errors.append("interface.screenshots: only allowed when the MCP server returns custom UI")
if errors:
    sys.exit("build-openai-plugin-zip: " + "; ".join(errors))
PY

out="dist/uptimerobot-openai-${version}.zip"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT

mkdir -p "$stage/.codex-plugin" "$stage/assets" "$stage/skills"
cp .codex-plugin/plugin.json "$stage/.codex-plugin/"
cp .mcp.json AGENTS.md LICENSE "$stage/"
cp assets/logo.png "$stage/assets/"
for dir in skills/*/; do
  name="$(basename "$dir")"
  for excluded in "${EXCLUDED_SKILLS[@]}"; do
    [ "$name" != "$excluded" ] || continue 2
  done
  cp -R "$dir" "$stage/skills/$name"
done

# Drop list items that link to an excluded skill, in the packaged copy only.
for excluded in "${EXCLUDED_SKILLS[@]}"; do
  grep -rlF "](../${excluded}/SKILL.md)" "$stage/skills" | while read -r file; do
    sed -i "\#^- .*](\.\./${excluded}/SKILL\.md)#d" "$file"
  done
  if grep -rnF "](../${excluded}/SKILL.md)" "$stage/skills"; then
    fail "a packaged skill still links to the excluded ${excluded} skill"
  fi
done

mkdir -p dist
rm -f "$out"
(cd "$stage" && zip -qrX - .) > "$out"
echo "wrote $out"
unzip -Z1 "$out"
