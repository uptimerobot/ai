#!/usr/bin/env bash
# Build the ZIP uploaded to OpenAI's plugin portal (ChatGPT + Codex directory).
#
# The package uses the Codex compatibility layout: .codex-plugin/plugin.json,
# .mcp.json, skills/ and assets/. The Claude Code and Cursor manifests stay out
# of it. AGENTS.md is included because several skills link to it.
#
# Usage (from repo root):
#   scripts/build-openai-plugin-zip.sh            # writes dist/uptimerobot-openai-<version>.zip
set -euo pipefail

cd "$(dirname "$0")/.."

fail() { echo "build-openai-plugin-zip: $*" >&2; exit 1; }

[ ! -e hooks ] || fail "hooks/ exists; OpenAI rejects packages with lifecycle hooks"
[ ! -e .app.json ] || fail ".app.json exists; OpenAI rejects packages with app references"

version="$(python3 -c 'import json; print(json.load(open(".codex-plugin/plugin.json"))["version"])')"

# Check the listing limits that final submission enforces, and that every skill
# a packaged skill points to (`uptimerobot:<name>` or `../<name>/SKILL.md`) is packaged.
python3 - <<'PY'
import json, pathlib, re, sys
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
if isinstance(prompts, str):
    prompts = [prompts]
if (len(prompts) > 3 or len(set(prompts)) != len(prompts)
        or any(len(p) > 128 or re.search(r"(^|\s)@\w", p) for p in prompts)):
    errors.append("interface.defaultPrompt: at most 3 unique prompts, 128 characters each, no @mentions")
if i.get("screenshots"):
    errors.append("interface.screenshots: only allowed when the MCP server returns custom UI")
skills = {p.parent.name for p in pathlib.Path("skills").glob("*/SKILL.md")}
for path in sorted(pathlib.Path("skills").glob("*/SKILL.md")):
    text = path.read_text(encoding="utf-8")
    refs = set(re.findall(r"uptimerobot:([a-z0-9-]+)", text)) | set(re.findall(r"\]\(\.\./([a-z0-9-]+)/SKILL\.md", text))
    for ref in sorted(refs - skills):
        errors.append(f"{path} refers to skill {ref!r}, which isn't packaged")
if errors:
    sys.exit("build-openai-plugin-zip: " + "; ".join(errors))
PY

out="dist/uptimerobot-openai-${version}.zip"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT

mkdir -p "$stage/.codex-plugin" "$stage/assets"
cp .codex-plugin/plugin.json "$stage/.codex-plugin/"
cp .mcp.json AGENTS.md LICENSE "$stage/"
cp assets/logo.png "$stage/assets/"
cp -R skills "$stage/"

mkdir -p dist
rm -f "$out"
(cd "$stage" && zip -qrX - .) > "$out"
echo "wrote $out"
unzip -Z1 "$out"
