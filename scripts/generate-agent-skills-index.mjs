#!/usr/bin/env node
/**
 * Regenerate .well-known/agent-skills/index.json from skills skill directories.
 *
 * Agent Skills Discovery RFC v0.2.0 — each entry includes name, type, description
 * (YAML frontmatter), raw GitHub URL, and sha256 digest of the SKILL.md bytes.
 *
 * Usage (from repo root):
 *   node scripts/generate-agent-skills-index.mjs
 *   node scripts/generate-agent-skills-index.mjs --check   # exit 1 if index is stale
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const SCHEMA_URL = "https://agentskills.dev/schemas/index.v0.2.0.json";
const GITHUB_ORG_REPO = "uptimerobot/ai";
const DEFAULT_BRANCH = "main";
const SKILLS_DIR = path.join(REPO_ROOT, "skills");
const OUTPUT_PATH = path.join(REPO_ROOT, ".well-known", "agent-skills", "index.json");

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const branchArg = args.find((arg) => arg.startsWith("--branch="));
const branch = branchArg ? branchArg.slice("--branch=".length) : DEFAULT_BRANCH;

function fail(message) {
  console.error(`generate-agent-skills-index: ${message}`);
  process.exit(1);
}

// Every skill's frontmatter uses a plain single-line value for both `name`
// and `description` (true of every current skills/*/SKILL.md). YAML block
// scalars (`description: |` / `>`) and escapes other than `\"`/`\\` are
// deliberately unsupported rather than hand-rolled: this repo has no YAML
// dependency, and re-implementing YAML's block-scalar folding/indentation
// rules from scratch (previously attempted here) turned into a recurring
// source of subtle parsing bugs for a form nothing in this repo actually
// uses. Unsupported input fails the build loudly instead of guessing.
// A double-quoted value with every quote/backslash properly escaped: zero or
// more (non-quote/backslash chars, or a backslash followed by any char), then
// the real closing quote. Rejects malformed/unterminated values like `"foo\"`
// that endsWith('"') alone can't distinguish from a real closing quote — that
// trailing quote is itself escaped, not a terminator.
const DOUBLE_QUOTED_PATTERN = /^"(?:[^"\\]|\\.)*"$/;
// Single-quoted YAML: `''` is an escaped literal quote, anything else ends
// the string. Same rationale as DOUBLE_QUOTED_PATTERN — a value that merely
// startsWith("'") without being a complete, validly-terminated quoted string
// (e.g. `'unterminated`) should fail, not be published as literal text with
// a stray leading quote character.
const SINGLE_QUOTED_PATTERN = /^'(?:[^']|'')*'$/;

function unquote(value, field) {
  if (value.startsWith('"')) {
    if (!DOUBLE_QUOTED_PATTERN.test(value)) {
      fail(`malformed double-quoted value in ${field} (missing or misplaced closing quote)`);
    }
    return value.slice(1, -1).replace(/\\(.)/g, (raw, ch) => {
      if (ch === '"' || ch === "\\") return ch;
      fail(
        `unsupported escape "\\${ch}" in ${field} (only \\" and \\\\ are supported — ` +
          "write it as plain text instead)",
      );
      return raw;
    });
  }
  if (value.startsWith("'")) {
    if (!SINGLE_QUOTED_PATTERN.test(value)) {
      fail(`malformed single-quoted value in ${field} (missing or misplaced closing quote)`);
    }
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
}

function extractFrontmatterLines(skillMd) {
  // The closing fence must be its own line (`(?:\r?\n|$)` after it), not
  // just a `---` substring at the start of a longer line — otherwise a
  // frontmatter value containing a stray leading "---" could be mistaken
  // for the real terminator and truncate the block early.
  const match = skillMd.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    fail("SKILL.md is missing YAML frontmatter");
  }
  return match[1].split(/\r?\n/);
}

// Reads a single `field:` scalar from frontmatter lines.
function parseFrontmatterField(lines, field) {
  const headerPattern = new RegExp(`^${field}:\\s*(.*)$`);
  let inlineValue;
  for (const line of lines) {
    const match = line.match(headerPattern);
    if (match) {
      inlineValue = match[1].trim();
      break;
    }
  }
  if (inlineValue === undefined) {
    fail(`SKILL.md frontmatter is missing ${field}`);
  }

  if (/^[|>]/.test(inlineValue)) {
    fail(
      `SKILL.md frontmatter "${field}" uses a YAML block scalar ("${inlineValue}"), ` +
        "which isn't supported — write it as a single (optionally quoted) line instead.",
    );
  }

  return unquote(inlineValue, field);
}

function parseFrontmatter(skillMd) {
  const lines = extractFrontmatterLines(skillMd);
  return {
    name: parseFrontmatterField(lines, "name"),
    description: parseFrontmatterField(lines, "description"),
  };
}

function digestFor(bytes) {
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  return `sha256:${hash}`;
}

function buildIndex() {
  if (!fs.existsSync(SKILLS_DIR)) {
    fail(`skills directory not found: ${SKILLS_DIR}`);
  }

  const skillNames = fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (skillNames.length === 0) {
    fail("no skill directories found under skills/");
  }

  const skills = skillNames.map((name) => {
    const skillPath = path.join(SKILLS_DIR, name, "SKILL.md");
    if (!fs.existsSync(skillPath)) {
      fail(`missing SKILL.md for skill "${name}"`);
    }

    const bytes = fs.readFileSync(skillPath);
    const content = bytes.toString("utf8");
    const frontmatter = parseFrontmatter(content);
    if (frontmatter.name !== name) {
      fail(
        `skill directory "${name}" has a mismatched frontmatter name ` +
          `"${frontmatter.name}" in SKILL.md`,
      );
    }
    return {
      name,
      type: "skill-md",
      description: frontmatter.description,
      url: `https://raw.githubusercontent.com/${GITHUB_ORG_REPO}/${branch}/skills/${name}/SKILL.md`,
      digest: digestFor(bytes),
    };
  });

  return {
    $schema: SCHEMA_URL,
    skills,
  };
}

function serializeIndex(index) {
  return `${JSON.stringify(index, null, 2)}\n`;
}

function normalizeJson(text) {
  return JSON.stringify(JSON.parse(text));
}

const generated = buildIndex();
const generatedText = serializeIndex(generated);

if (checkOnly) {
  if (!fs.existsSync(OUTPUT_PATH)) {
    fail(`index not found at ${OUTPUT_PATH}; run without --check to generate`);
  }

  const existing = fs.readFileSync(OUTPUT_PATH, "utf8");
  if (normalizeJson(existing) !== JSON.stringify(generated)) {
    fail(
      "index.json is stale — run: node scripts/generate-agent-skills-index.mjs",
    );
  }

  console.log(`ok: ${OUTPUT_PATH} matches ${generated.skills.length} skills`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, generatedText);
console.log(`wrote ${OUTPUT_PATH} (${generated.skills.length} skills)`);
