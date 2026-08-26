#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { constants as fsConstants, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SKILL_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const SKILL_NAME = "gpt-image";
const LEGACY_SKILL_NAME = "gpt-image-workspace";
const LEGACY_SKILL_ROOT = path.resolve(path.dirname(SKILL_ROOT), LEGACY_SKILL_NAME);
const MIN_NODE_MAJOR = 22;
const CODEX_INSTALLER_URLS = {
  darwin: "https://chatgpt.com/codex/install.sh",
  linux: "https://chatgpt.com/codex/install.sh",
  win32: "https://chatgpt.com/codex/install.ps1",
};
const ALLOWED_INSTALLER_HOSTS = new Set(["chatgpt.com", "releases.openai.com"]);
const DEFAULT_TIMEOUT_MS = 12 * 60 * 1000;
const MAX_CAPTURE_BYTES = 24 * 1024 * 1024;
const CONTRACT_VERSION = 4;
const IMAGE_MODES = new Set(["auto", "generate", "edit", "variation"]);
const REPEATABLE_FLAGS = new Set([
  "reference",
  "reference-role",
  "preserve",
  "avoid",
  "exact-text",
]);

class CliError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

function parseArgs(argv) {
  const result = {
    _: [],
    reference: [],
    "reference-role": [],
    preserve: [],
    avoid: [],
    "exact-text": [],
  };
  const booleanFlags = new Set([
    "dry-run",
    "json",
    "overwrite",
    "verbose",
    "yes",
    "require-transparency",
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      result._.push(token);
      continue;
    }

    const raw = token.slice(2);
    const equalIndex = raw.indexOf("=");
    const key = equalIndex === -1 ? raw : raw.slice(0, equalIndex);
    let value = equalIndex === -1 ? undefined : raw.slice(equalIndex + 1);

    if (booleanFlags.has(key)) {
      result[key] = value === undefined ? true : value !== "false";
      continue;
    }

    if (value === undefined) {
      index += 1;
      value = argv[index];
    }
    if (value === undefined || value.startsWith("--")) {
      throw new CliError(`Missing value for --${key}`, 2);
    }

    if (REPEATABLE_FLAGS.has(key)) result[key].push(value);
    else result[key] = value;
  }

  return result;
}

function usage() {
  return `GPT Image Skill — ChatGPT subscription only

Usage:
  node scripts/gpt_image.mjs bootstrap --yes [--target all|codex|claude] [--json]
  node scripts/gpt_image.mjs install [--target all|codex|claude] [--dry-run] [--json]
  node scripts/gpt_image.mjs verify-installers [--json]
  node scripts/gpt_image.mjs install-codex --yes
  node scripts/gpt_image.mjs login
  node scripts/gpt_image.mjs doctor [--json]
  node scripts/gpt_image.mjs guide [--json]
  node scripts/gpt_image.mjs capabilities [--json]
  node scripts/gpt_image.mjs inspect --input PATH [--require-transparency] [--json]
  node scripts/gpt_image.mjs plan --prompt TEXT [options]
  node scripts/gpt_image.mjs generate --prompt TEXT [options]

Plan and generate options:
  --mode MODE             auto, generate, edit, or variation. Default: auto.
  --out PATH              Workspace-relative or absolute PNG path.
  --cwd PATH              Workspace root. Defaults to the current directory.
  --edit-target PATH      Primary image to change. Required for edit/variation.
  --reference PATH        Supporting visual reference. Repeat for multiple images.
  --reference-role TEXT   Role for the matching reference by order. Repeatable.
  --region TEXT           Spatial area to change in an edit.
  --preserve TEXT         Invariant that must remain unchanged. Repeatable.
  --avoid TEXT            Content or behavior to exclude. Repeatable.
  --exact-text TEXT       Exact in-image text, capitalization preserved. Repeatable.
  --quality TEXT          Prompt instruction, e.g. draft or final.
  --size TEXT             Prompt instruction, e.g. square or 1536x1024.
  --background TEXT       Prompt instruction, e.g. transparent or opaque.
  --timeout-seconds N     Default: ${DEFAULT_TIMEOUT_MS / 1000}
  --overwrite             Replace the exact output path.
  --dry-run               Generate only: check sign-in and paths without creating an image.
  --json                  Print machine-readable output.
  --verbose               Generate only: show sanitized Codex bridge output.

Reference attachment order is deterministic: edit target first, then references.
The user prompt is forwarded unchanged; attachment labels are routing metadata only.
Planning and the no-image setup check are optional troubleshooting tools, not generation prerequisites.

Runtime:
  Node.js ${MIN_NODE_MAJOR}+ is required; the latest supported LTS is recommended.
  macOS, Linux, Windows native, and WSL2 are supported. WSL1 is not supported.

This program never calls the OpenAI Images API and never uses OPENAI_API_KEY.
`;
}

function nodeRuntime() {
  const major = Number.parseInt(process.versions.node.split(".")[0], 10);
  return {
    major,
    supported: Number.isInteger(major) && major >= MIN_NODE_MAJOR,
    version: process.version,
  };
}

function platformRuntime() {
  const release = os.release().toLowerCase();
  const wsl =
    process.platform === "linux" &&
    (Boolean(process.env.WSL_DISTRO_NAME) || release.includes("microsoft"));
  const wslVersion = wsl
    ? release.includes("wsl2") || release.includes("microsoft-standard")
      ? 2
      : 1
    : null;
  const baseSupported = Object.hasOwn(CODEX_INSTALLER_URLS, process.platform);
  return {
    arch: process.arch,
    environment: wsl ? `wsl${wslVersion}` : process.platform,
    platform: process.platform,
    supported: baseSupported && wslVersion !== 1,
    wsl,
    wslVersion,
  };
}

function subscriptionEnvironment() {
  const env = { ...process.env };
  for (const key of [
    "OPENAI_API_KEY",
    "OPENAI_BASE_URL",
    "OPENAI_ORG_ID",
    "OPENAI_PROJECT_ID",
    "CODEX_ACCESS_TOKEN",
  ]) {
    delete env[key];
  }
  return env;
}

function sanitizeText(value) {
  return String(value ?? "")
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, "[REDACTED_OPENAI_KEY]")
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/access[_-]?token["'=:\s]+[A-Za-z0-9._~+\/-]+=*/gi, "access_token=[REDACTED]");
}

function runSyncCapture(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: subscriptionEnvironment(),
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    code: result.status,
    error: result.error,
    stderr: sanitizeText(result.stderr),
    stdout: sanitizeText(result.stdout),
  };
}

function resolveWindowsCodexInvocation() {
  const where = runSyncCapture("where.exe", ["codex"]);
  const candidates = where.code === 0
    ? where.stdout.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
    : [];

  for (const candidate of candidates) {
    const extension = path.extname(candidate).toLowerCase();
    if ((extension === ".exe" || extension === ".com") && existsSync(candidate)) {
      return { command: candidate, prefix: [], source: "windows-standalone" };
    }
  }

  for (const candidate of candidates) {
    const extension = path.extname(candidate).toLowerCase();
    if (extension !== ".cmd" && extension !== ".bat") continue;
    const npmEntry = path.join(
      path.dirname(candidate),
      "node_modules",
      "@openai",
      "codex",
      "bin",
      "codex.js",
    );
    if (existsSync(npmEntry)) {
      return { command: process.execPath, prefix: [npmEntry], source: "windows-npm-shim" };
    }
  }

  return null;
}

function resolveCodexInvocation() {
  if (process.platform === "win32") return resolveWindowsCodexInvocation();
  return { command: "codex", prefix: [], source: "path" };
}

function probeCodex() {
  const invocation = resolveCodexInvocation();
  if (!invocation) {
    return { available: false, invocation: null, source: null, version: null };
  }
  const probe = runSyncCapture(invocation.command, [...invocation.prefix, "--version"]);
  return {
    available: !probe.error && probe.code === 0,
    invocation,
    source: probe.code === 0 ? invocation.source : null,
    version: probe.code === 0 ? probe.stdout.trim() || probe.stderr.trim() : null,
  };
}

function runCodexSyncCapture(args) {
  const invocation = resolveCodexInvocation();
  if (!invocation) {
    return { code: null, error: new Error("Codex CLI not found"), stderr: "", stdout: "" };
  }
  return runSyncCapture(invocation.command, [...invocation.prefix, ...args]);
}

function parseDoctorJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function detectAuthEvidence(loginText, doctor) {
  const login = loginText.toLowerCase();
  if (/logged in using chatgpt|chatgpt auth/.test(login)) {
    return { verified: true, state: "chatgpt", evidence: "codex login status: ChatGPT" };
  }
  if (/logged in.*api key|api[- ]key auth|using an api key/.test(login)) {
    return { verified: false, state: "api-key", evidence: "codex login status: API key" };
  }
  if (/not logged in|signed out|no active (?:login|session)/.test(login)) {
    return { verified: null, state: "signed-out", evidence: "codex login status: signed out" };
  }

  const reachability = doctor?.checks?.["network.provider_reachability"]?.details;
  const mode = reachability?.["reachability mode"];
  if (typeof mode === "string" && mode.toLowerCase() === "chatgpt auth") {
    return { verified: true, state: "chatgpt", evidence: "codex doctor: reachability mode=ChatGPT auth" };
  }
  if (typeof mode === "string" && /api/.test(mode.toLowerCase())) {
    return { verified: false, state: "api-key", evidence: `codex doctor: reachability mode=${mode}` };
  }

  const serialized = JSON.stringify(doctor || {}).toLowerCase();
  if (serialized.includes("chatgpt auth")) {
    return { verified: true, state: "chatgpt", evidence: "codex doctor: ChatGPT auth" };
  }
  if (serialized.includes("api key auth") || serialized.includes("api-key auth")) {
    return { verified: false, state: "api-key", evidence: "codex doctor: API key auth" };
  }
  return { verified: null, state: "unknown", evidence: "No redacted ChatGPT-auth evidence found" };
}

function inspectSubscriptionAuth(deep = false) {
  const codex = probeCodex();
  if (!codex.available) {
    return {
      codex,
      verified: null,
      authState: "codex-missing",
      evidence: "Codex CLI is not installed",
      configStatus: null,
    };
  }

  const login = runCodexSyncCapture(["login", "status"]);
  const loginText = `${login.stdout}\n${login.stderr}`;
  let doctor = null;
  let auth = detectAuthEvidence(loginText, doctor);

  // Normal generation needs one quick auth check. Reserve Codex Doctor for
  // explicit diagnostics or an ambiguous login-status response.
  if (deep || auth.state === "unknown") {
    const doctorRun = runCodexSyncCapture(["doctor", "--json"]);
    doctor = parseDoctorJson(doctorRun.stdout);
    auth = detectAuthEvidence(loginText, doctor);
  }

  return {
    codex,
    verified: auth.verified,
    authState: auth.state,
    evidence: auth.evidence,
    configStatus: doctor?.checks?.["config.load"]?.status ?? null,
  };
}

function slugify(text) {
  const slug = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "generated-image";
}

function timestampSlug() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  );
}

async function exists(target) {
  try {
    await access(target, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveWorkspace(raw) {
  const workspace = path.resolve(raw || process.cwd());
  const info = await stat(workspace).catch(() => null);
  if (!info?.isDirectory()) {
    throw new CliError(`Workspace directory does not exist: ${workspace}`, 2);
  }
  return workspace;
}

async function resolveInputPath(raw, workspace, label = "Input image") {
  const resolved = path.resolve(workspace, raw);
  const info = await stat(resolved).catch(() => null);
  if (!info?.isFile()) {
    throw new CliError(`${label} is not a readable file: ${resolved}`, 2);
  }
  return resolved;
}

async function chooseOutputPath(raw, workspace, prompt, overwrite) {
  const defaultName = `${slugify(prompt)}-${timestampSlug()}.png`;
  let output = path.resolve(workspace, raw || path.join("generated-images", defaultName));

  if (!isWithin(workspace, output)) {
    throw new CliError(`Output must stay inside the active workspace: ${output}`, 2);
  }
  if (!path.extname(output)) output += ".png";
  if (path.extname(output).toLowerCase() !== ".png") {
    throw new CliError("The subscription bridge saves PNG files; use a .png output path.", 2);
  }
  if (overwrite || !(await exists(output))) return output;

  const base = output.slice(0, -4);
  for (let version = 2; version < 10_000; version += 1) {
    const candidate = `${base}-v${version}.png`;
    if (!(await exists(candidate))) return candidate;
  }
  throw new CliError(`Could not choose a non-conflicting output path near ${output}`);
}

function detectImageFormat(buffer) {
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(png)) return "png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

function inspectPng(buffer) {
  if (detectImageFormat(buffer) !== "png" || buffer.length < 33) return null;
  if (
    buffer.readUInt32BE(8) !== 13 ||
    buffer.subarray(12, 16).toString("ascii") !== "IHDR"
  ) {
    return null;
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const colorType = buffer[25];
  if (![0, 2, 3, 4, 6].includes(colorType)) return null;
  let transparencyChunk = false;
  let complete = false;
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const next = offset + 12 + length;
    if (next > buffer.length) break;
    if (type === "tRNS") transparencyChunk = true;
    if (type === "IEND") {
      complete = true;
      break;
    }
    offset = next;
  }
  if (!complete) return null;
  return {
    width,
    height,
    color_type: colorType,
    has_transparency: colorType === 4 || colorType === 6 || transparencyChunk,
  };
}

async function validateImage(output, options = {}) {
  const info = await stat(output).catch(() => null);
  if (!info?.isFile() || info.size < 64) {
    throw new CliError(`No usable image was written: ${output}`);
  }
  const bytes = await readFile(output);
  const format = detectImageFormat(bytes);
  if (!format) {
    throw new CliError(`Output is not a recognized PNG, JPEG, or WebP image: ${output}`);
  }
  if (format !== "png") {
    throw new CliError(`Output must contain PNG bytes to match its .png path; detected ${format}: ${output}`);
  }
  const png = inspectPng(bytes);
  if (!png || png.width < 1 || png.height < 1) {
    throw new CliError(`Output has an invalid PNG header or dimensions: ${output}`);
  }
  if (options.requireTransparency && !png.has_transparency) {
    throw new CliError(
      `Transparent background was requested, but the saved PNG has no alpha or transparency chunk: ${output}`,
    );
  }
  return {
    bytes: info.size,
    format,
    width: png.width,
    height: png.height,
    has_transparency: png.has_transparency,
  };
}

async function inspectInputImage(raw, workspace, label) {
  const input = await resolveInputPath(raw, workspace, label);
  const info = await stat(input);
  if (info.size < 64) {
    throw new CliError(`${label} is too small to be a usable image: ${input}`, 2);
  }
  const bytes = await readFile(input);
  const format = detectImageFormat(bytes);
  if (!format) {
    throw new CliError(`${label} is not a recognized PNG, JPEG, or WebP image: ${input}`, 2);
  }
  const png = format === "png" ? inspectPng(bytes) : null;
  return {
    path: input,
    format,
    dimensions: png ? `${png.width}x${png.height}` : null,
  };
}

function markdownFor(output) {
  const portable = process.platform === "win32" ? output.replaceAll("\\", "/") : output;
  const target = portable.includes(" ") ? `<${portable}>` : portable;
  return `![generated image](${target})`;
}

function printResult(result, asJson) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  for (const [key, value] of Object.entries(result)) {
    if (value === null || value === undefined || typeof value === "object") continue;
    process.stdout.write(`${key.toUpperCase()}=${value}\n`);
  }
}

function gettingStartedGuide() {
  return {
    show_once_after_install: true,
    present_in_user_language: true,
    summary: "Ask naturally. Include an aspect ratio or quality phrase only when it matters.",
    prompt_pattern: "<what to create or change>, <aspect ratio>, <quality or detail level>.",
    common_aspect_ratios: [
      { ratio: "1:1", use: "square posts, icons, and product images" },
      { ratio: "16:9", use: "wide banners, slides, and video thumbnails" },
      { ratio: "9:16", use: "vertical mobile and social images" },
      { ratio: "4:3", use: "landscape illustrations and presentations" },
      { ratio: "3:4", use: "portrait illustrations and posters" },
    ],
    quality_phrases: [
      { phrase: "draft", use: "early exploration" },
      { phrase: "high quality", use: "a polished result" },
      { phrase: "high detail, final quality", use: "a final asset with more detail" },
    ],
    examples: {
      codex: "$gpt-image Create a cozy reading room at sunset, 16:9, high quality.",
      claude: "/gpt-image Create a square product image of a blue glass robot, 1:1, high detail, final quality.",
      reference: "/gpt-image Use @references/character.png as the character reference and place it in a rainy city, 9:16, high quality.",
      revision: "/gpt-image Edit the last image: change only the jacket to red.",
    },
    note: "Ratios and quality phrases are natural-language requests, not fixed API presets. Exact pixel dimensions may vary with built-in image generation.",
  };
}

function printGettingStartedGuide(guide, asJson) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(guide, null, 2)}\n`);
    return;
  }
  process.stdout.write("GPT Image Skill is ready. No image was generated during setup.\n\n");
  process.stdout.write("Ask naturally and add a ratio or quality phrase when it matters.\n");
  process.stdout.write(
    `Common aspect ratios: ${guide.common_aspect_ratios.map((item) => item.ratio).join(", ")}\n`,
  );
  process.stdout.write(
    `Quality phrases: ${guide.quality_phrases.map((item) => item.phrase).join("; ")}\n\n`,
  );
  process.stdout.write(`Codex example: ${guide.examples.codex}\n`);
  process.stdout.write(`Claude example: ${guide.examples.claude}\n`);
  process.stdout.write(`Reference example: ${guide.examples.reference}\n`);
  process.stdout.write(`Revision example: ${guide.examples.revision}\n\n`);
  process.stdout.write(`${guide.note}\n`);
}

async function runProcess(command, args, options = {}) {
  const {
    cwd,
    env = subscriptionEnvironment(),
    input = "",
    timeoutMs = DEFAULT_TIMEOUT_MS,
    verbose = false,
    inherit = false,
  } = options;

  if (inherit) {
    return await new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd, env, stdio: "inherit" });
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
      }, timeoutMs);
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", (code, signal) => {
        clearTimeout(timer);
        resolve({ code, signal, stdout: "", stderr: "" });
      });
    });
  }

  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let capturedBytes = 0;

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
    }, timeoutMs);

    const capture = (kind, chunk) => {
      const text = chunk.toString("utf8");
      capturedBytes += Buffer.byteLength(text);
      if (capturedBytes <= MAX_CAPTURE_BYTES) {
        if (kind === "stdout") stdout += text;
        else stderr += text;
      }
      if (verbose) process.stderr.write(sanitizeText(text));
    };

    child.stdout.on("data", (chunk) => capture("stdout", chunk));
    child.stderr.on("data", (chunk) => capture("stderr", chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
    child.stdin.end(input);
  });
}

async function runCodexProcess(args, options = {}) {
  const invocation = resolveCodexInvocation();
  if (!invocation) throw new CliError("Codex CLI is not installed.", 3);
  return await runProcess(invocation.command, [...invocation.prefix, ...args], options);
}

function tail(text, max = 4_000) {
  const sanitized = sanitizeText(text);
  return sanitized.length <= max ? sanitized : sanitized.slice(-max);
}

function repeatedValues(args, key) {
  const raw = args[key];
  const values = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  return values.map((value) => String(value).trim()).filter(Boolean);
}

function assertKnownImageOptions(args) {
  const allowed = new Set([
    "_",
    "reference",
    "reference-role",
    "preserve",
    "avoid",
    "exact-text",
    "prompt",
    "out",
    "cwd",
    "mode",
    "edit-target",
    "region",
    "quality",
    "size",
    "background",
    "timeout-seconds",
    "overwrite",
    "dry-run",
    "json",
    "verbose",
  ]);
  const unknown = Object.keys(args).filter((key) => !allowed.has(key));
  if (unknown.length) {
    throw new CliError(`Unknown image option(s): ${unknown.map((key) => `--${key}`).join(", ")}`, 2);
  }
  if (args._.length > 1) {
    throw new CliError(`Unexpected positional argument(s): ${args._.slice(1).join(" ")}`, 2);
  }
}

async function normalizeGenerateOptions(args) {
  assertKnownImageOptions(args);
  const prompt = String(args.prompt ?? "");
  if (!prompt.trim()) throw new CliError("--prompt is required.", 2);

  const workspace = await resolveWorkspace(args.cwd);
  const timeoutSeconds = Number(args["timeout-seconds"] || DEFAULT_TIMEOUT_MS / 1000);
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds < 30 || timeoutSeconds > 3600) {
    throw new CliError("--timeout-seconds must be between 30 and 3600.", 2);
  }

  const requestedMode = String(args.mode || "auto").toLowerCase();
  if (!IMAGE_MODES.has(requestedMode)) {
    throw new CliError("--mode must be auto, generate, edit, or variation.", 2);
  }
  const editTargetRaw = String(args["edit-target"] || "").trim();
  const mode = requestedMode === "auto" ? (editTargetRaw ? "edit" : "generate") : requestedMode;
  if (mode === "generate" && editTargetRaw) {
    throw new CliError("--edit-target cannot be used with --mode generate; use edit or variation.", 2);
  }
  if ((mode === "edit" || mode === "variation") && !editTargetRaw) {
    throw new CliError(`--edit-target is required for --mode ${mode}.`, 2);
  }

  const editTarget = editTargetRaw
    ? {
        ...(await inspectInputImage(editTargetRaw, workspace, "Edit target")),
        attachment_index: 1,
        role: "primary edit target",
      }
    : null;

  const referencePaths = repeatedValues(args, "reference");
  const referenceRoles = repeatedValues(args, "reference-role");
  if (referenceRoles.length > referencePaths.length) {
    throw new CliError(
      `Received ${referenceRoles.length} --reference-role values for ${referencePaths.length} references.`,
      2,
    );
  }
  const references = [];
  for (let index = 0; index < referencePaths.length; index += 1) {
    const inspected = await inspectInputImage(
      referencePaths[index],
      workspace,
      `Reference image ${index + 1}`,
    );
    if (editTarget && comparablePath(inspected.path) === comparablePath(editTarget.path)) {
      throw new CliError(
        "The edit target must not also be repeated as a supporting reference.",
        2,
      );
    }
    references.push({
      ...inspected,
      attachment_index: index + (editTarget ? 2 : 1),
      role: referenceRoles[index] || "reference provided by the user",
    });
  }

  const output = await chooseOutputPath(args.out, workspace, prompt, Boolean(args.overwrite));

  return {
    avoid: repeatedValues(args, "avoid"),
    background: String(args.background || "auto"),
    editTarget,
    exactText: repeatedValues(args, "exact-text"),
    mode,
    output,
    overwrite: Boolean(args.overwrite),
    preserve: repeatedValues(args, "preserve"),
    prompt,
    quality: String(args.quality || "auto"),
    references,
    region: String(args.region || "").trim() || null,
    requestedMode,
    size: String(args.size || "auto"),
    timeoutMs: timeoutSeconds * 1000,
    verbose: Boolean(args.verbose),
    workspace,
  };
}

function buildBridgePrompt(options) {
  const inputs = [];
  if (options.editTarget) {
    inputs.push(
      options.mode === "variation"
        ? `Image ${options.editTarget.attachment_index}: current variation source.`
        : `Image ${options.editTarget.attachment_index}: current edit target. This is the image to modify in this invocation.`,
    );
  }
  for (const reference of options.references) {
    inputs.push(`Image ${reference.attachment_index}: reference — ${reference.role}.`);
  }

  const modeInstruction = {
    generate: "Create a new image from the exact user request and any attached references.",
    edit: "Edit Image 1 according to the exact user request.",
    variation: "Create a variation of Image 1 according to the exact user request.",
  }[options.mode];

  const routing = [];
  if (inputs.length) {
    routing.push(
      "ATTACHED IMAGE ROUTING (operational metadata, not creative direction):",
      ...inputs,
      "Pass every numbered image into the image-generation call. Do not omit an image or replace it with a text description.",
      "This Codex turn is ephemeral; no image from another turn exists unless it is attached here.",
    );
  }
  if (options.region) routing.push(`User-supplied edit region: ${options.region}`);
  for (const value of options.preserve) routing.push(`User-supplied preserve constraint: ${value}`);
  for (const value of options.avoid) routing.push(`User-supplied avoid constraint: ${value}`);
  for (const value of options.exactText) routing.push(`User-supplied exact text: ${JSON.stringify(value)}`);
  if (options.size !== "auto") routing.push(`User-supplied size/aspect: ${options.size}`);
  if (options.quality !== "auto") routing.push(`User-supplied quality: ${options.quality}`);
  if (options.background !== "auto") routing.push(`User-supplied background: ${options.background}`);

  return `Use $imagegen exactly once through Codex's built-in image generation capability.

PROMPT FIDELITY CONTRACT (mandatory):
- The text between BEGIN USER PROMPT and END USER PROMPT is the authoritative image request.
- Pass that text through unchanged. Do not rewrite, expand, optimize, beautify, summarize, translate, or add creative details.
- Do not invent composition, lighting, style, colors, objects, materials, text, exclusions, or preservation rules.
- Use routing metadata only to attach the correct files and apply constraints the user explicitly supplied.

BEGIN USER PROMPT
${options.prompt}
END USER PROMPT

Operation: ${options.mode}. ${modeInstruction}
${routing.length ? `\n${routing.join("\n")}\n` : ""}
Use only the signed-in ChatGPT subscription path. Never use OPENAI_API_KEY, an Images API call, api.openai.com, or a separately billed fallback.
Save exactly one final PNG to this path:
${options.output}

Do not modify any other workspace file. Do not return a plan or prompt advice. Your final response must contain only the absolute saved path.`;
}

function attachmentPaths(options) {
  return [
    ...(options.editTarget ? [options.editTarget.path] : []),
    ...options.references.map((reference) => reference.path),
  ];
}

async function generateWithSubscription(options, auth) {
  if (!auth.codex.available) {
    throw new CliError(
      "Codex CLI is not installed. Run install-codex --yes, then complete ChatGPT login.",
      3,
    );
  }
  if (auth.verified !== true) {
    const reason = auth.verified === false ? "non-ChatGPT authentication detected" : "ChatGPT authentication could not be verified";
    throw new CliError(
      `${reason}. Generation is blocked to prevent API billing. Run the interactive login command and require CHATGPT_SUBSCRIPTION_LOGIN=true before retrying. Evidence: ${auth.evidence}`,
      3,
    );
  }

  await mkdir(path.dirname(options.output), { recursive: true });
  const temporary = await mkdtemp(path.join(os.tmpdir(), `${SKILL_NAME}-`));
  const finalMessage = path.join(temporary, "final-message.txt");
  const prompt = buildBridgePrompt(options);

  const codexArgs = [
    "exec",
    "--ignore-user-config",
    "--skip-git-repo-check",
    "--ephemeral",
    "--json",
    "--color",
    "never",
    "--sandbox",
    "workspace-write",
    "-c",
    'approval_policy="never"',
    "-C",
    options.workspace,
    "-o",
    finalMessage,
  ];
  for (const input of attachmentPaths(options)) codexArgs.push("-i", input);
  codexArgs.push("-");

  try {
    const result = await runCodexProcess(codexArgs, {
      cwd: options.workspace,
      input: prompt,
      timeoutMs: options.timeoutMs,
      verbose: options.verbose,
    });
    if (result.signal) {
      throw new CliError(
        `Codex image generation was terminated by ${result.signal}; timeout is ${Math.round(options.timeoutMs / 1000)} seconds.`,
      );
    }
    if (result.code !== 0) {
      throw new CliError(
        `Codex subscription image generation failed with exit code ${result.code}.\n${tail(`${result.stderr}\n${result.stdout}`)}`,
      );
    }
    if (!(await exists(options.output))) {
      const finalText = await readFile(finalMessage, "utf8").catch(() => "");
      throw new CliError(
        `Codex completed but did not write the requested image: ${options.output}\n${tail(finalText || result.stdout)}`,
      );
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function safeTargetState(target) {
  const info = await lstat(target).catch(() => null);
  if (!info) return { state: "missing" };
  if (!info.isSymbolicLink()) return { state: "occupied" };
  const raw = await readlink(target);
  const resolved = path.resolve(path.dirname(target), raw);
  const sourceResolved = await realpath(SKILL_ROOT).catch(() => SKILL_ROOT);
  const targetResolved = await realpath(resolved).catch(() => resolved);
  return comparablePath(targetResolved) === comparablePath(sourceResolved)
    ? { state: "installed" }
    : { state: "occupied" };
}

function comparablePath(value) {
  let normalized = path.resolve(value).replace(/^\\\\\?\\/, "");
  if (process.platform === "win32") normalized = normalized.toLowerCase();
  return normalized;
}

async function legacyTargetState(target) {
  const info = await lstat(target).catch(() => null);
  if (!info) return { state: "missing" };
  if (!info.isSymbolicLink()) return { state: "occupied" };
  const raw = await readlink(target);
  const resolved = path.resolve(path.dirname(target), raw);
  const ownedSources = new Set([
    comparablePath(LEGACY_SKILL_ROOT),
    comparablePath(SKILL_ROOT),
  ]);
  return ownedSources.has(comparablePath(resolved))
    ? { state: "owned-legacy-link", source: resolved }
    : { state: "occupied", source: resolved };
}

async function installOne(target, dryRun) {
  const state = await safeTargetState(target);
  if (state.state === "installed") return { target, status: "already-installed" };
  if (state.state === "occupied") {
    throw new CliError(`Refusing to replace an existing skill path: ${target}`);
  }
  if (dryRun) return { target, status: "would-install" };
  await mkdir(path.dirname(target), { recursive: true });
  await symlink(SKILL_ROOT, target, process.platform === "win32" ? "junction" : "dir");
  return { target, status: "installed" };
}

function selectedTargetLocations(rawTarget, skillName = SKILL_NAME) {
  const target = String(rawTarget || "all").toLowerCase();
  if (!new Set(["all", "codex", "claude"]).has(target)) {
    throw new CliError("--target must be all, codex, or claude.", 2);
  }
  const locations = [];
  if (target === "all" || target === "codex") {
    locations.push(path.join(os.homedir(), ".agents", "skills", skillName));
  }
  if (target === "all" || target === "claude") {
    locations.push(path.join(os.homedir(), ".claude", "skills", skillName));
  }
  return locations;
}

async function migrateLegacyOne(target, dryRun) {
  const state = await legacyTargetState(target);
  if (state.state === "missing") return { target, status: "absent" };
  if (state.state === "occupied") {
    return { target, status: "preserved-unrelated" };
  }
  if (dryRun) return { target, status: "would-remove-owned-legacy-link" };
  await rm(target, { force: true });
  return { target, status: "removed-owned-legacy-link" };
}

async function installTargets(rawTarget, dryRun) {
  const locations = selectedTargetLocations(rawTarget);
  const installations = [];
  for (const location of locations) {
    installations.push(await installOne(location, dryRun));
  }

  // Migrate only links owned by this repository, and only after every new target is safe.
  const legacyMigrations = [];
  for (const location of selectedTargetLocations(rawTarget, LEGACY_SKILL_NAME)) {
    legacyMigrations.push(await migrateLegacyOne(location, dryRun));
  }
  return { ok: true, source: SKILL_ROOT, installations, legacy_migrations: legacyMigrations };
}

async function runInstall(args) {
  const result = await installTargets(args.target, Boolean(args["dry-run"]));
  if (args.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else {
    process.stdout.write(`SOURCE=${SKILL_ROOT}\n`);
    for (const item of result.installations) {
      process.stdout.write(`INSTALL=${item.status}:${item.target}\n`);
    }
    for (const item of result.legacy_migrations) {
      process.stdout.write(`LEGACY=${item.status}:${item.target}\n`);
    }
  }
}

async function fetchOfficialInstaller(platform) {
  const installerUrl = CODEX_INSTALLER_URLS[platform];
  if (!installerUrl) throw new CliError(`No official Codex installer is configured for ${platform}.`, 3);
  const windows = platform === "win32";
  const response = await fetch(installerUrl, { redirect: "follow" });
  if (!response.ok) {
    throw new CliError(`Official Codex installer download failed with HTTP ${response.status}`);
  }
  const finalInstallerUrl = new URL(response.url);
  if (
    finalInstallerUrl.protocol !== "https:" ||
    !ALLOWED_INSTALLER_HOSTS.has(finalInstallerUrl.hostname)
  ) {
    throw new CliError(`Official installer redirected to an unapproved host: ${finalInstallerUrl.hostname}`);
  }
  const installer = await response.text();
  const looksValid =
    installer.length >= 100 &&
    !/<html[\s>]/i.test(installer) &&
    (windows ? /codex/i.test(installer) : installer.includes("#!/"));
  if (!looksValid) {
    throw new CliError(`Downloaded Codex installer did not look like a valid ${windows ? "PowerShell" : "shell"} script.`);
  }
  return {
    bytes: Buffer.byteLength(installer),
    finalUrl: finalInstallerUrl.toString(),
    installer,
    requestedUrl: installerUrl,
    sha256: createHash("sha256").update(installer).digest("hex"),
  };
}

async function runVerifyInstallers(args) {
  const unix = await fetchOfficialInstaller("linux");
  const windows = await fetchOfficialInstaller("win32");
  const result = {
    ok: true,
    allowed_redirect_hosts: [...ALLOWED_INSTALLER_HOSTS],
    installers: {
      macos_linux_wsl2: {
        bytes: unix.bytes,
        final_url: unix.finalUrl,
        requested_url: unix.requestedUrl,
        sha256: unix.sha256,
      },
      windows: {
        bytes: windows.bytes,
        final_url: windows.finalUrl,
        requested_url: windows.requestedUrl,
        sha256: windows.sha256,
      },
    },
  };
  if (args.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else {
    process.stdout.write("INSTALLER_VERIFICATION=pass\n");
    process.stdout.write(`UNIX_INSTALLER_SHA256=${unix.sha256}\n`);
    process.stdout.write(`WINDOWS_INSTALLER_SHA256=${windows.sha256}\n`);
  }
}

async function installCodex(authorized) {
  const current = probeCodex();
  if (current.available) {
    return { ok: true, status: "already-installed", codex_version: current.version };
  }
  if (!authorized) {
    const installer = CODEX_INSTALLER_URLS[process.platform] || "current official Codex docs";
    throw new CliError(
      `Codex CLI installation changes the user environment. Rerun with --yes after authorization. Installer: ${installer}`,
      2,
    );
  }
  const platform = platformRuntime();
  if (!platform.supported) {
    const reason = platform.wslVersion === 1 ? "WSL1 is not supported by current Codex" : "unsupported platform";
    throw new CliError(`Cannot install Codex automatically: ${reason}.`, 3);
  }

  const temporary = await mkdtemp(path.join(os.tmpdir(), `${SKILL_NAME}-installer-`));
  const windows = process.platform === "win32";
  const installerPath = path.join(temporary, windows ? "install-codex.ps1" : "install-codex.sh");
  try {
    const downloaded = await fetchOfficialInstaller(process.platform);
    await writeFile(installerPath, downloaded.installer, { mode: 0o700 });
    if (!windows) await chmod(installerPath, 0o700);
    let command = "/bin/sh";
    let commandArgs = [installerPath];
    if (windows) {
      const powershell = ["pwsh.exe", "powershell.exe"].find((candidate) => {
        const probe = runSyncCapture(candidate, ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"]);
        return !probe.error && probe.code === 0;
      });
      if (!powershell) throw new CliError("PowerShell was not found on this Windows machine.", 3);
      command = powershell;
      commandArgs = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", installerPath];
    }
    const result = await runProcess(command, commandArgs, {
      cwd: process.cwd(),
      inherit: true,
      timeoutMs: 15 * 60 * 1000,
    });
    if (result.code !== 0) {
      throw new CliError(`Official Codex installer exited with code ${result.code}.`);
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }

  return {
    ok: true,
    status: "installed",
    next: "Open a new shell if needed, then run the login command.",
  };
}

async function runInstallCodex(args) {
  const result = await installCodex(Boolean(args.yes));
  printResult(result, Boolean(args.json));
}

async function loginWithChatGPT() {
  const codex = probeCodex();
  if (!codex.available) {
    throw new CliError("Codex CLI is not installed. Run install-codex --yes first.", 3);
  }
  process.stderr.write("Starting Codex device login. Complete Sign in with ChatGPT yourself.\n");
  const result = await runCodexProcess(["login", "--device-auth"], {
    cwd: process.cwd(),
    inherit: true,
    timeoutMs: 20 * 60 * 1000,
  });
  if (result.code !== 0) {
    throw new CliError(`Codex ChatGPT login exited with code ${result.code}.`);
  }
  const auth = inspectSubscriptionAuth();
  if (auth.verified !== true) {
    throw new CliError(
      `Login finished, but ChatGPT subscription auth was not verified. Evidence: ${auth.evidence}`,
      3,
    );
  }
  return { ok: true, chatgpt_subscription_login: true, auth_evidence: auth.evidence };
}

async function runLogin(args) {
  const result = await loginWithChatGPT();
  printResult(result, Boolean(args.json));
}

async function buildDoctorReport() {
  const auth = inspectSubscriptionAuth(true);
  const node = nodeRuntime();
  const platform = platformRuntime();
  const codexSkill = await safeTargetState(path.join(os.homedir(), ".agents", "skills", SKILL_NAME));
  const claudeSkill = await safeTargetState(path.join(os.homedir(), ".claude", "skills", SKILL_NAME));
  const legacyCodexSkill = await legacyTargetState(
    path.join(os.homedir(), ".agents", "skills", LEGACY_SKILL_NAME),
  );
  const legacyClaudeSkill = await legacyTargetState(
    path.join(os.homedir(), ".claude", "skills", LEGACY_SKILL_NAME),
  );
  const installer = CODEX_INSTALLER_URLS[process.platform] || null;
  let nextAction = "Ready for subscription-backed image generation.";
  if (!platform.supported) {
    nextAction = platform.wslVersion === 1
      ? "Migrate this environment to WSL2, then reinstall Node, Codex, and the skill inside WSL2."
      : "Use macOS, Linux, Windows native, or WSL2.";
  } else if (!node.supported) {
    nextAction = `Install a supported Node.js LTS (${MIN_NODE_MAJOR}+), open a new shell, and rerun doctor.`;
  } else if (!auth.codex.available) {
    nextAction = "After user approval, run install-codex --yes, open a new shell if needed, then rerun doctor.";
  } else if (auth.verified !== true) {
    nextAction = "Run login and complete Sign in with ChatGPT, then rerun doctor.";
  } else if (codexSkill.state !== "installed" || claudeSkill.state !== "installed") {
    nextAction = codexSkill.state === "occupied" || claudeSkill.state === "occupied"
      ? "Inspect the occupied host skill path. Do not replace it automatically."
      : "Run install --target all.";
  } else if (
    legacyCodexSkill.state === "owned-legacy-link" ||
    legacyClaudeSkill.state === "owned-legacy-link"
  ) {
    nextAction = "Run install --target all once to remove only repository-owned legacy links.";
  }
  const checks = {
    platform_supported: platform.supported,
    node_supported: node.supported,
    codex_available: auth.codex.available,
    chatgpt_subscription_login: auth.verified === true,
    api_environment_forwarded: false,
    codex_skill_installed: codexSkill.state === "installed",
    claude_skill_installed: claudeSkill.state === "installed",
    repository_owned_legacy_links_absent:
      legacyCodexSkill.state !== "owned-legacy-link" &&
      legacyClaudeSkill.state !== "owned-legacy-link",
  };
  const bestPracticePass = Object.entries(checks).every(([key, value]) =>
    key === "api_environment_forwarded" ? value === false : value === true,
  );
  const runtimeReady = platform.supported && node.supported && auth.codex.available && auth.verified === true;
  const result = {
    ok: runtimeReady,
    ready: runtimeReady,
    platform: platform.platform,
    arch: platform.arch,
    environment: platform.environment,
    platform_supported: platform.supported,
    wsl_version: platform.wslVersion,
    node: node.version,
    node_major: node.major,
    node_minimum: MIN_NODE_MAJOR,
    node_supported: node.supported,
    codex_available: auth.codex.available,
    codex_version: auth.codex.version,
    codex_launcher: auth.codex.source,
    chatgpt_subscription_login: auth.verified,
    auth_state: auth.authState,
    auth_evidence: auth.evidence,
    config_status: auth.configStatus,
    api_environment_forwarded: false,
    codex_installer: installer,
    codex_skill_status: codexSkill.state,
    claude_skill_status: claudeSkill.state,
    legacy_codex_skill_status: legacyCodexSkill.state,
    legacy_claude_skill_status: legacyClaudeSkill.state,
    best_practice_pass: bestPracticePass,
    best_practice_checks: checks,
    next_action: nextAction,
  };
  return result;
}

async function runDoctor(args) {
  const result = await buildDoctorReport();
  printResult(result, Boolean(args.json));
  if (!result.ok) process.exitCode = 3;
}

async function runBootstrap(args) {
  if (!args.yes) {
    throw new CliError(
      "bootstrap creates user skill links, may install Codex CLI, and may start ChatGPT device login. Rerun with --yes only after the user authorizes those changes.",
      2,
    );
  }

  const actions = [];
  const installation = await installTargets(args.target, false);
  actions.push("skill-links-checked");

  let auth = inspectSubscriptionAuth();
  let codexInstallation = null;
  if (!auth.codex.available) {
    process.stderr.write("Codex CLI is missing; running the official platform installer.\n");
    codexInstallation = await installCodex(true);
    actions.push(`codex-${codexInstallation.status}`);
    auth = inspectSubscriptionAuth();
  }

  if (auth.codex.available && auth.verified === false) {
    throw new CliError(
      `Existing non-ChatGPT Codex authentication was detected and was not replaced. Explicitly authorize an auth change, run codex logout yourself, then rerun bootstrap. Evidence: ${auth.evidence}`,
      3,
    );
  }

  let login = null;
  if (auth.codex.available && auth.verified !== true) {
    if (auth.authState !== "signed-out") {
      throw new CliError(
        `Codex authentication state is ambiguous, so bootstrap will not replace it automatically. Inspect codex login status and authorize any authentication change explicitly. Evidence: ${auth.evidence}`,
        3,
      );
    }
    login = await loginWithChatGPT();
    actions.push("chatgpt-device-login-completed");
  }

  const doctor = await buildDoctorReport();
  const ok = Boolean(doctor.ready && doctor.best_practice_pass);
  if (ok) actions.push("subscription-route-ready");
  const guide = ok ? gettingStartedGuide() : null;
  const result = {
    ok,
    status: ok ? "ready" : "needs-attention",
    friendly_status: ok
      ? "Setup is complete and ChatGPT sign-in is ready. No image was generated during setup."
      : "Setup needs attention before image generation is ready.",
    skill: SKILL_NAME,
    source: SKILL_ROOT,
    actions,
    installation,
    codex_installation: codexInstallation,
    login,
    doctor,
    getting_started: guide,
    next_action: ok ? "Start a new agent session if needed, then invoke $gpt-image or /gpt-image." : doctor.next_action,
  };
  printResult(result, Boolean(args.json));
  if (ok && !args.json) {
    process.stdout.write("\n");
    printGettingStartedGuide(guide, false);
  }
  if (!ok) process.exitCode = 3;
}

async function runGuide(args) {
  printGettingStartedGuide(gettingStartedGuide(), Boolean(args.json));
}

function capabilityReport() {
  return {
    ok: true,
    skill: SKILL_NAME,
    contract_version: CONTRACT_VERSION,
    billing: {
      route: "ChatGPT subscription through Codex built-in image_gen",
      images_api: false,
      api_key: false,
    },
    modes: {
      generate: "Create a new image with zero, one, or multiple visual references.",
      edit: "Change one primary edit target with explicit regions and preservation invariants.",
      variation: "Derive a new variant from one primary target while preserving named invariants.",
    },
    input_images: {
      formats: ["png", "jpeg", "webp"],
      primary_edit_target: true,
      single_reference: true,
      multiple_references: true,
      per_reference_roles: true,
      deterministic_attachment_order: "edit target first, then supporting references",
      stable_local_paths_required: true,
      signature_validation: true,
    },
    workflows: [
      "text-to-image",
      "reference-guided generation",
      "precise object or region edit",
      "background replacement or extraction",
      "style transfer",
      "multi-image compositing",
      "iterative revision",
      "visual variations",
      "transparent PNG request",
      "exact in-image text request",
      "infographic or dense-layout draft",
    ],
    controls: [
      "prompt",
      "verbatim prompt forwarding",
      "mode",
      "reference roles",
      "localized region",
      "preserve invariants",
      "avoid constraints",
      "exact text",
      "size or aspect guidance",
      "quality guidance",
      "background guidance",
    ],
    output: {
      format: "png",
      workspace_contained: true,
      non_destructive_by_default: true,
      validation: ["PNG signature", "dimensions", "alpha status", "byte size"],
      inline_markdown: true,
      multiple_assets_or_variants: "one native call or bridge invocation per final asset",
    },
    host_only_features: {
      canvas_area_selection: "Use the ChatGPT Canvas UI when available; the CLI bridge uses --region text.",
      conversation_multi_select: "Use the host UI when available; the CLI bridge accepts ordered local files.",
      claude_pasted_image: "Resolve it to a stable local path before starting the bridge; never silently omit it.",
    },
    unsupported_by_design: [
      "OpenAI Images API",
      "OPENAI_API_KEY",
      "API-key Codex login",
      "separately billed fallback",
    ],
  };
}

async function runCapabilities(args) {
  printResult(capabilityReport(), Boolean(args.json));
}

async function runInspect(args) {
  const allowed = new Set([
    "_",
    "reference",
    "reference-role",
    "preserve",
    "avoid",
    "exact-text",
    "input",
    "cwd",
    "require-transparency",
    "json",
  ]);
  const unknown = Object.keys(args).filter((key) => !allowed.has(key));
  if (unknown.length) {
    throw new CliError(`Unknown inspect option(s): ${unknown.map((key) => `--${key}`).join(", ")}`, 2);
  }
  const rawInput = String(args.input || "").trim();
  if (!rawInput) throw new CliError("inspect requires --input PATH.", 2);
  if (args._.length > 1) {
    throw new CliError(`Unexpected positional argument(s): ${args._.slice(1).join(" ")}`, 2);
  }
  const workspace = await resolveWorkspace(args.cwd);
  const input = await resolveInputPath(rawInput, workspace, "Image");
  if (!isWithin(workspace, input)) {
    throw new CliError(`Inspected output must stay inside the active workspace: ${input}`, 2);
  }
  const validation = await validateImage(input, {
    requireTransparency: Boolean(args["require-transparency"]),
  });
  printResult(
    {
      ok: true,
      path: input,
      workspace,
      ...validation,
      transparency_required: Boolean(args["require-transparency"]),
      markdown: markdownFor(input),
    },
    Boolean(args.json),
  );
}

function imageRouteReceipt(options) {
  return {
    ok: true,
    contract_version: CONTRACT_VERSION,
    backend: "Codex built-in image_gen",
    billing_path: "ChatGPT subscription; Images API disabled",
    workspace: options.workspace,
    path: options.output,
    operation_mode: options.mode,
    requested_mode: options.requestedMode,
    prompt: options.prompt,
    edit_target: options.editTarget,
    references: options.references,
    attachment_order: attachmentPaths(options),
    region: options.region,
    preserve: options.preserve,
    avoid: options.avoid,
    exact_text: options.exactText,
    requested_size: options.size,
    requested_quality: options.quality,
    requested_background: options.background,
  };
}

async function runPlan(args) {
  const options = await normalizeGenerateOptions(args);
  const result = {
    ...imageRouteReceipt(options),
    plan_only: true,
    authentication_checked: false,
    generation_started: false,
    bridge_prompt: buildBridgePrompt(options),
    markdown: markdownFor(options.output),
  };
  printResult(result, Boolean(args.json));
}

async function runGenerate(args) {
  const options = await normalizeGenerateOptions(args);
  const auth = inspectSubscriptionAuth();
  if (!auth.codex.available || auth.verified !== true) {
    const reason = !auth.codex.available
      ? "Codex CLI is not installed"
      : "ChatGPT subscription authentication is not verified";
    throw new CliError(`${reason}. Evidence: ${auth.evidence}`, 3);
  }

  const route = {
    ...imageRouteReceipt(options),
    auth_evidence: auth.evidence,
    dry_run: Boolean(args["dry-run"]),
  };
  if (args["dry-run"]) {
    printResult({ ...route, markdown: markdownFor(options.output) }, Boolean(args.json));
    return;
  }

  await generateWithSubscription(options, auth);
  const validation = await validateImage(options.output, {
    requireTransparency: /transparent|alpha/i.test(options.background),
  });
  const result = {
    ...route,
    bytes: validation.bytes,
    format: validation.format,
    width: validation.width,
    height: validation.height,
    has_transparency: validation.has_transparency,
    markdown: markdownFor(options.output),
  };
  if (args.json) {
    printResult(result, true);
  } else {
    process.stdout.write(`PATH=${options.output}\n`);
    process.stdout.write(`MARKDOWN=${result.markdown}\n`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || "help";
  if (command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(usage());
    return;
  }
  if (command !== "doctor" && !nodeRuntime().supported) {
    throw new CliError(
      `Node.js ${MIN_NODE_MAJOR}+ is required. Install the latest supported LTS, open a new shell, and rerun doctor. Current: ${process.version}`,
      3,
    );
  }
  if (
    new Set(["bootstrap", "install-codex", "login", "generate"]).has(command) &&
    !platformRuntime().supported
  ) {
    const platform = platformRuntime();
    const reason = platform.wslVersion === 1
      ? "WSL1 is unsupported; migrate the toolchain and repository to WSL2"
      : `unsupported platform: ${platform.platform}`;
    throw new CliError(`Cannot run the Codex bridge in this environment: ${reason}.`, 3);
  }
  if (command === "bootstrap") return await runBootstrap(args);
  if (command === "install") return await runInstall(args);
  if (command === "verify-installers") return await runVerifyInstallers(args);
  if (command === "install-codex") return await runInstallCodex(args);
  if (command === "login") return await runLogin(args);
  if (command === "doctor") return await runDoctor(args);
  if (command === "guide") return await runGuide(args);
  if (command === "capabilities") return await runCapabilities(args);
  if (command === "inspect") return await runInspect(args);
  if (command === "plan") return await runPlan(args);
  if (command === "generate") return await runGenerate(args);
  throw new CliError(`Unknown command: ${command}\n\n${usage()}`, 2);
}

main().catch((error) => {
  const exitCode = error instanceof CliError ? error.exitCode : 1;
  process.stderr.write(`ERROR=${sanitizeText(error?.message || error)}\n`);
  process.exitCode = exitCode;
});
