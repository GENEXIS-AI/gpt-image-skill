#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SKILL_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const REPOSITORY_ROOT = path.resolve(SKILL_ROOT, "..");
const failures = [];

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function requireCondition(condition, message) {
  if (!condition) failures.push(message);
}

const requiredFiles = [
  path.join(REPOSITORY_ROOT, "README.md"),
  path.join(REPOSITORY_ROOT, "AGENT_INSTALL.md"),
  path.join(REPOSITORY_ROOT, ".github", "workflows", "validate.yml"),
  path.join(SKILL_ROOT, "SKILL.md"),
  path.join(SKILL_ROOT, "agents", "openai.yaml"),
  path.join(SKILL_ROOT, "references", "image-workflows.md"),
  path.join(SKILL_ROOT, "references", "platform-setup.md"),
  path.join(SKILL_ROOT, "references", "subscription-runtime.md"),
  path.join(SKILL_ROOT, "scripts", "gpt_image.mjs"),
];

for (const target of requiredFiles) {
  requireCondition(await exists(target), `Missing required file: ${path.relative(REPOSITORY_ROOT, target)}`);
}

const skillPath = path.join(SKILL_ROOT, "SKILL.md");
const runnerPath = path.join(SKILL_ROOT, "scripts", "gpt_image.mjs");
const readmePath = path.join(REPOSITORY_ROOT, "README.md");
const skill = await readFile(skillPath, "utf8");
const runner = await readFile(runnerPath, "utf8");
const readme = await readFile(readmePath, "utf8");

const frontmatter = skill.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
requireCondition(Boolean(frontmatter), "SKILL.md must start with YAML frontmatter.");
const name = frontmatter?.[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
const description = frontmatter?.[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
requireCondition(name === path.basename(SKILL_ROOT), "Skill name must match its directory name.");
requireCondition(Boolean(description && description.length >= 80), "Skill description must explain concrete triggers.");
requireCondition(skill.split(/\r?\n/).length < 500, "SKILL.md must stay below 500 lines; move details to references.");

for (const match of skill.matchAll(/(?<!!)\[[^\]]+\]\(([^)]+)\)/g)) {
  const href = match[1];
  if (/^(?:https?:|#)/.test(href)) continue;
  const target = path.resolve(SKILL_ROOT, href);
  requireCondition(await exists(target), `Broken SKILL.md link: ${href}`);
}

for (const match of readme.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
  const href = match[1].replace(/^<|>$/g, "").split("#", 1)[0];
  if (!href || /^(?:https?:|#)/.test(href) || path.isAbsolute(href)) continue;
  const target = path.resolve(REPOSITORY_ROOT, href);
  requireCondition(await exists(target), `Broken README link: ${href}`);
}

for (const token of [
  "OPENAI_API_KEY",
  "CODEX_ACCESS_TOKEN",
  "https://chatgpt.com/codex/install.sh",
  "https://chatgpt.com/codex/install.ps1",
  "resolveWindowsCodexInvocation",
  "platformRuntime",
  "best_practice_pass",
  "inspectInputImage",
  "PROMPT FIDELITY CONTRACT",
  "BEGIN USER PROMPT",
  "Pass every numbered image",
  "This Codex turn is ephemeral",
  "gettingStartedGuide",
  "common_aspect_ratios",
  "friendly_status",
  "--edit-target",
  "--reference-role",
  "--preserve",
  "--exact-text",
  "capabilities",
  "require-transparency",
  "inspect",
  "plan",
]) {
  requireCondition(runner.includes(token), `Runner is missing required guard or platform token: ${token}`);
}

requireCondition(!runner.includes("https://api.openai.com"), "Runner must not contain an OpenAI API endpoint.");
requireCondition(!runner.includes("/v1/images"), "Runner must not contain an Images API endpoint.");
requireCondition(!runner.includes('readFile(path.join(os.homedir(), ".codex", "auth.json"'), "Runner must not read auth.json.");
requireCondition(
  (runner.match(/createHash\("sha256"\)/g) || []).length === 1,
  "SHA-256 must be limited to official installer verification, not generated images.",
);
requireCondition(!runner.includes("generation_dry_run"), "Bootstrap must not require a no-image generation check.");

for (const token of ["Windows", "WSL2", "Node.js 22", "best_practice_pass", "verify-installers", "bootstrap --target all --yes", "$gpt-image", "/gpt-image", "Multiple references", "--edit-target", "--reference-role", "capabilities --json", "inspect --input", "prompt is authoritative", "Revisions always edit the latest result", "Why generated images no longer have SHA receipts", "What the agent shows after installation", "Common aspect-ratio requests", "translated into the user's language", "setup check that does not create an image"]) {
  requireCondition(readme.includes(token), `README is missing cross-platform guidance: ${token}`);
}

for (const token of ["pass it through unchanged", "generated-images/inputs/", "previously returned output", "every bridge call as ephemeral", "Do not require SHA-256", "present `getting_started` once", "Do not repeat this guide", "setup check that does not create an image"]) {
  requireCondition(skill.includes(token), `SKILL.md is missing a lightweight fidelity/reference rule: ${token}`);
}
requireCondition(!skill.includes("For vague requests"), "SKILL.md must not encourage inferred prompt expansion.");

requireCondition(runner.includes('const SKILL_NAME = "gpt-image"'), "Runner skill name must be gpt-image.");
requireCondition(runner.includes("owned-legacy-link"), "Runner must safely migrate repository-owned legacy links.");

const result = {
  ok: failures.length === 0,
  checks: {
    api_endpoint_absent: !runner.includes("https://api.openai.com") && !runner.includes("/v1/images"),
    description_present: Boolean(description),
    reference_workflows_present: await exists(path.join(SKILL_ROOT, "references", "image-workflows.md")),
    required_files: requiredFiles.length,
    skill_lines: skill.split(/\r?\n/).length,
  },
  failures,
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (failures.length) process.exitCode = 1;
