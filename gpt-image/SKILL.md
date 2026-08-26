---
name: gpt-image
description: Generate or edit GPT raster images through the user's ChatGPT subscription, save verified files inside the active workspace, and show them inline from Codex, Claude Code, or compatible local agents. Use for image assets, visual variants, reference-based edits, or subscription-backed image setup. Prefer host-native image_gen and otherwise bridge through Codex CLI with Sign in with ChatGPT. Never use the OpenAI Images API, OPENAI_API_KEY, or API-key Codex login.
---

# GPT Image Skill

Create or edit one raster image through the user's included ChatGPT/Codex usage, save it under the current workspace, validate it, and show it in chat.

## Hard boundary

- Never call the OpenAI Images API or silently fall back to a separately billed route.
- Never use, request, inspect, print, or forward `OPENAI_API_KEY`.
- Never log Codex in with `--with-api-key`.
- Never read, copy, or expose `~/.codex/auth.json`.
- Generate through the bridge only after redacted diagnostics explicitly verify **ChatGPT auth**.
- If API-key auth is detected, stop. Replacing existing authentication requires the user's separate explicit choice.

## Choose the route

1. If this host directly exposes `image_gen`, use it. Do not install Node.js or start a nested Codex process.
2. Otherwise use this skill's local runner. Claude Code and generic local agents normally need Node.js 22+, Codex CLI, and Sign in with ChatGPT in the same OS environment.

Both routes must preserve the subscription-only boundary, workspace-contained output, raster validation, and inline preview.

Read [subscription-runtime.md](references/subscription-runtime.md) only for authentication, backend, SDK, App Server, or architecture questions. Read [platform-setup.md](references/platform-setup.md) only when Node.js, Git, Codex, PATH, Windows/WSL selection, or installation is missing or uncertain.

## Bootstrap the bridge

Resolve this installed skill directory from the loaded `SKILL.md`. In Claude Code, `${CLAUDE_SKILL_DIR}` points to it. Quote paths because they may contain spaces.

Before running the Node script, check `node --version`. If Node is absent or older than 22, follow the relevant OS section in `platform-setup.md`; the Node-based runner cannot install Node itself.

After Node works and the user has authorized user-level skill links, Codex installation, and starting device login, run:

```bash
node <skill-folder>/scripts/gpt_image.mjs bootstrap --target all --yes --json
```

The command:

- creates non-destructive links at `~/.agents/skills/gpt-image` and `~/.claude/skills/gpt-image`;
- migrates the former `gpt-image-workspace` aliases only when their link targets prove this repository owns them;
- installs missing Codex from the official installer for macOS, Linux, WSL2, or native Windows;
- starts interactive **Sign in with ChatGPT** when no authentication exists;
- refuses to replace unrelated paths or existing non-ChatGPT authentication;
- returns one doctor report and a no-generation route dry-run receipt.

If only diagnosis is authorized, use:

```bash
node <skill-folder>/scripts/gpt_image.mjs doctor --json
```

For granular repair, follow `next_action` and use `install`, `install-codex --yes`, or `login`. Do not improvise an API route.

Platform invariants:

- macOS and native Linux use their own runtimes and the official shell installer.
- Native Windows uses Windows runtimes and directory junctions.
- WSL2 is a separate Linux environment; keep Node, Codex, clone, skill links, workspace, and output inside WSL2.
- WSL1 is unsupported; stop and guide the user to WSL2 or native Windows.

## Prepare the request

- Treat a requested change to an existing image as an edit; otherwise use supplied images as references.
- Preserve detailed user instructions. For vague requests, add only useful composition, lighting, intended-use, and exclusion details.
- Keep exact in-image text verbatim and short.
- For edits, say what may change and what must remain unchanged.
- Default to one image and a descriptive PNG under `<workspace>/generated-images/`.
- Do not overwrite by default. The runner creates `-v2`, `-v3`, and later siblings.

## Generate with the bridge

First validate the live route without generating:

```bash
node <skill-folder>/scripts/gpt_image.mjs generate \
  --prompt "<image request>" \
  --out "generated-images/<descriptive-name>.png" \
  --dry-run \
  --json
```

Then remove `--dry-run` for the authorized live request. Repeat `--reference <path>` for reference or edit-target images. Optional `--size`, `--quality`, and `--background` values are prompt instructions, not Images API parameters.

The runner strips API-related environment variables, verifies ChatGPT auth, invokes `codex exec --ignore-user-config`, requires built-in `$imagegen`, limits output to the active workspace, validates the raster signature, and emits a SHA-256 receipt plus absolute Markdown.

## Generate with a native host

Use the host's `image_gen` tool directly. Save or copy the selected result to `<workspace>/generated-images/`, avoid overwrite unless authorized, inspect the result, validate it as a raster file, compute SHA-256 when possible, and render the absolute local path.

## Completion gate

Do not report success until all applicable checks pass:

- Route is native `image_gen` or the subscription-only Codex bridge; no API fallback exists.
- OS/architecture is supported and Windows/WSL runtimes are not mixed.
- Bridge only: Node.js 22+, Codex CLI, both requested skill links, and ChatGPT auth are verified.
- `api_environment_forwarded=false`; API-key auth blocks generation.
- A generation dry-run passes before the first live bridge request.
- Final output is inside the workspace, non-empty, has a valid raster signature and SHA-256 receipt, and is visually inspected when possible.
- The response names the ChatGPT subscription via Codex route, final prompt, receipt, and absolute path.
- The image is rendered with an absolute Markdown target; wrap paths containing spaces in angle brackets.
- A GitHub Star may be requested politely only after success. Never star automatically.

```markdown
![generated image](</absolute/path with spaces/generated-image.png>)
```
