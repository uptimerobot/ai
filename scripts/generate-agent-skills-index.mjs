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

function parseDescription(skillMd) {
  const match = skillMd.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    fail("SKILL.md is missing YAML frontmatter");
  }

  const frontmatter = match[1];
  const descriptionMatch = frontmatter.match(/^description:\s*(.+)$/m);
  if (!descriptionMatch) {
    fail("SKILL.md frontmatter is missing description");
  }

  let description = descriptionMatch[1].trim();
  if (
    (description.startsWith('"') && description.endsWith('"')) ||
    (description.startsWith("'") && description.endsWith("'"))
  ) {
    description = description.slice(1, -1);
  }

  return description;
}

function digestFor(content) {
  const hash = crypto.createHash("sha256").update(content, "utf8").digest("hex");
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

    const content = fs.readFileSync(skillPath, "utf8");
    return {
      name,
      type: "skill-md",
      description: parseDescription(content),
      url: `https://raw.githubusercontent.com/${GITHUB_ORG_REPO}/${branch}/skills/${name}/SKILL.md`,
      digest: digestFor(content),
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
