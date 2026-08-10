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

const DOUBLE_QUOTE_ESCAPES = { '"': '"', "\\": "\\", n: "\n", t: "\t", r: "\r" };

// Unescapes a YAML plain-scalar value that was wrapped in quotes. Double
// quotes support backslash escapes (`\"`, `\\`, `\n`, `\t`, `\r`; any other
// escape is left as-is rather than guessed at). Single quotes only support a
// doubled `''` as an escaped literal quote.
function unquote(value) {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\(.)/g, (raw, ch) => DOUBLE_QUOTE_ESCAPES[ch] ?? raw);
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
}

// Splits the lines following a block-scalar header into { blank } / { text }
// entries, stripping exactly the indentation of the block's first non-blank
// line (preserving any deeper relative indentation) and dropping trailing
// blank entries (YAML "clip" chomping — the default, and the only chomping
// mode this generator supports). `keyIndent` is the indentation of the
// `field:` header line itself — a content line must be indented deeper than
// that to count as part of the block; otherwise the block has no body (e.g.
// `description: |` immediately followed by the next frontmatter key).
function readBlockScalarLines(lines, startIndex, keyIndent) {
  const entries = [];
  let baseIndent = null;
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      entries.push({ blank: true });
      continue;
    }
    const indent = line.match(/^ */)[0].length;
    if (baseIndent === null) {
      if (indent <= keyIndent) break;
      baseIndent = indent;
    } else if (indent < baseIndent) {
      break;
    }
    entries.push({ blank: false, text: line.slice(baseIndent) });
  }
  while (entries.length > 0 && entries[entries.length - 1].blank) {
    entries.pop();
  }
  return entries;
}

// Literal style (`|`): line breaks are preserved as-is.
function joinLiteralBlock(entries) {
  return entries.map((entry) => (entry.blank ? "" : entry.text)).join("\n");
}

// Folded style (`>`, YAML 1.2 §8.1.3): a single line break between two
// non-blank lines folds to a space; a run of N blank lines folds to N line
// breaks. This does not implement the "more-indented line" exception, which
// doesn't apply to single-level plain-text skill descriptions.
function joinFoldedBlock(entries) {
  let result = "";
  let blankRun = 0;
  for (const entry of entries) {
    if (entry.blank) {
      blankRun += 1;
      continue;
    }
    if (result !== "") {
      result += blankRun > 0 ? "\n".repeat(blankRun) : " ";
    }
    blankRun = 0;
    result += entry.text;
  }
  return result;
}

function extractFrontmatterLines(skillMd) {
  const match = skillMd.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    fail("SKILL.md is missing YAML frontmatter");
  }
  return match[1].split(/\r?\n/);
}

// Reads a single `field:` scalar from frontmatter lines. `description` may
// use a YAML block scalar (`|`/`>`); other fields (e.g. `name`) are expected
// to be plain single-line values.
function parseFrontmatterField(lines, field, { allowBlockScalar = false } = {}) {
  const headerPattern = new RegExp(`^${field}:\\s*(.*)$`);
  const headerIndex = lines.findIndex((line) => headerPattern.test(line));
  if (headerIndex === -1) {
    fail(`SKILL.md frontmatter is missing ${field}`);
  }

  const keyIndent = lines[headerIndex].match(/^ */)[0].length;
  const inlineValue = lines[headerIndex].match(headerPattern)[1].trim();

  if (/^[|>]/.test(inlineValue)) {
    if (!allowBlockScalar) {
      fail(`SKILL.md frontmatter "${field}" must be a plain single-line value, not a block scalar`);
    }
    if (!/^[|>][-+]?$/.test(inlineValue)) {
      fail(
        `unsupported YAML block scalar header "${inlineValue}" in ${field} ` +
          "(explicit indentation indicators like |2 aren't supported)",
      );
    }
    const folded = inlineValue.startsWith(">");
    const entries = readBlockScalarLines(lines, headerIndex + 1, keyIndent);
    if (entries.length === 0) {
      fail(`SKILL.md frontmatter "${field}" block scalar has no content`);
    }
    const joined = folded ? joinFoldedBlock(entries) : joinLiteralBlock(entries);
    return joined.trim();
  }

  return unquote(inlineValue);
}

function parseFrontmatter(skillMd) {
  const lines = extractFrontmatterLines(skillMd);
  return {
    name: parseFrontmatterField(lines, "name"),
    description: parseFrontmatterField(lines, "description", { allowBlockScalar: true }),
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
  if (normalizeJson(existing) !== normalizeJson(generatedText)) {
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
