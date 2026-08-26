# GPT Image Skill

[![Validate skill](https://github.com/GENEXIS-AI/gpt-image-skill/actions/workflows/validate.yml/badge.svg)](https://github.com/GENEXIS-AI/gpt-image-skill/actions/workflows/validate.yml)

Generate and edit GPT images from Codex, Claude Code, or another compatible local agent through the user's **ChatGPT subscription**. The skill keeps the original image prompt unchanged, passes real reference files into generation, saves the result in the active project, and shows it inline.

```text
install skill → Sign in with ChatGPT → exact user prompt + local image inputs
              → built-in $imagegen → <project>/generated-images/*.png
```

> This repository does not call the OpenAI Images API and does not create a separately billed Images API request. Image generation still consumes included ChatGPT/Codex usage and remains subject to plan and workspace limits.

![GPT Image Skill smoke test](./generated-images/subscription-workflow-smoke.png)

![GPT Image Skill reference edit smoke test](./generated-images/reference-edit-smoke.png)

## Install by pasting one prompt into an agent

Paste this into Codex, Claude Code, or another local coding agent:

```text
Install and verify GPT Image Skill for the current user from:

https://github.com/GENEXIS-AI/gpt-image-skill

For this task, I authorize read-only environment checks; a persistent clone or safe fast-forward update;
user-level installation of missing Git, a supported Node.js 22+ LTS, and Codex CLI;
creation of the gpt-image links for Codex and Claude Code; and starting Sign in with ChatGPT device authorization.

Read AGENT_INSTALL.md at the repository root and follow it as the one-time installation contract.
Do not use the Images API, OPENAI_API_KEY, or API-key login. Do not generate a live image yet.
Pause only if administrator privileges are required, an unrelated existing path would be changed,
local changes would be discarded, or existing Codex authentication would need to be replaced.
Otherwise, install the required components, run bootstrap --target all --yes --json,
and continue until doctor reports best_practice_pass=true.
Finally, report the persistent clone path, both installed skill paths, and ChatGPT-auth evidence.
```

This prompt authorizes ordinary user-level setup without authorizing administrator elevation, destructive changes, replacement of existing authentication, a live generation, or a GitHub Star. The full boundary is in [AGENT_INSTALL.md](./AGENT_INSTALL.md).

After setup, invoke `$gpt-image` in Codex or `/gpt-image` in Claude Code. The host loads the concise skill only for image tasks; it does not need to reread this README on every request.

## Design principles

### 1. The prompt is authoritative

The skill forwards the user's image request unchanged. It does not “improve” a short prompt by adding composition, lighting, visual style, colors, objects, materials, negative prompts, or preservation rules. Optional runner flags are included only when the user explicitly supplied those constraints.

### 2. References are files, not descriptions

The bridge requires a readable local PNG, JPEG, or WebP path for each reference. It passes those files into the actual `$imagegen` call. It never replaces an unresolved reference with a text description and continues anyway.

In Claude Code:

- Prefer `@path/to/image.png` or an explicit filesystem path.
- A pasted or dragged image visible in Claude is not automatically inherited by a nested `codex exec` process.
- If Claude exposes an exact readable temporary attachment path, the agent copies that exact file into `<project>/generated-images/inputs/` and uses the copy.
- If Claude exposes no path, save the image inside the project and provide that path before generation.
- The skill does not guess from `~/.claude/image-cache`; choosing “the newest image” could select the wrong or private file.

### 3. Revisions always edit the latest result

Each bridge invocation is ephemeral. For “change the result you just made,” the agent must use the previous generated output as the next `--edit-target` and reattach every still-needed reference. Reusing the original source is a different operation and loses the prior edit.

### 4. Normal generation stays light

The default path is:

```text
quick ChatGPT-auth check → one generation → minimal PNG sanity check → PATH + inline Markdown
```

`plan`, `--dry-run`, `capabilities --json`, `inspect --input`, and detailed JSON remain available for troubleshooting. They are not required before a normal image request.

## Features

- Uses Codex's built-in `$imagegen` under **Sign in with ChatGPT**
- Uses a host-native `image_gen` tool directly when the calling host already exposes one
- Blocks `OPENAI_API_KEY`, API-key Codex login, and Images API fallback
- Installs the same `gpt-image` skill for Codex and Claude Code
- Preserves the user's prompt verbatim
- Supports one or Multiple references with deterministic attachment order
- Supports existing-image edits, follow-up revisions, variations, compositing, transparency, exact text, and dense-layout drafts
- Saves only inside the active workspace and avoids overwrite by default
- Returns `PATH=...` and absolute `MARKDOWN=...` after normal generation
- Supports macOS, Linux, native Windows, and WSL2

## Workflow map

| Intent | Bridge arguments |
| --- | --- |
| Text-to-image | `--mode generate` |
| New image guided by a reference | `--mode generate --reference PATH` |
| Multiple references | Repeat `--reference`; add matching `--reference-role` only for explicit roles |
| Change an existing image | `--mode edit --edit-target PATH` |
| Change the last generated image | Use the last returned path as the new `--edit-target` |
| Variation | `--mode variation --edit-target PATH` |
| Transparent output | Use `--background transparent` only when requested |

The edit target is Image 1. Supporting references follow in command-line order.

## Requirements and environments

- Node.js 22 or newer; the [current supported LTS](https://nodejs.org/en/download) is recommended.
- Git when installing from GitHub.
- Codex CLI signed in with ChatGPT, unless the calling host provides native `image_gen`.
- A ChatGPT/Codex plan and workspace that permit image generation.

| Environment | Status | Keep together |
| --- | --- | --- |
| macOS | Supported | macOS Node.js, Codex, clone, and workspace |
| Linux | Supported | Linux Node.js, Codex, clone, and workspace |
| Native Windows | Supported | Windows Node.js, Codex, junctions, and workspace |
| WSL2 | Supported | Keep the complete toolchain on the Linux side |
| WSL1 | Unsupported | Move to WSL2 or native Windows |

## Manual installation

Use a persistent clone because the installed skill links point to it.

### macOS, Linux, and WSL2

```bash
REPOSITORY_URL="https://github.com/GENEXIS-AI/gpt-image-skill"
INSTALL_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/gpt-image-skill"

git clone "$REPOSITORY_URL" "$INSTALL_DIR"
cd "$INSTALL_DIR"
node ./gpt-image/scripts/validate_skill.mjs
node ./gpt-image/scripts/gpt_image.mjs bootstrap --target all --yes --json
```

Keep WSL2 clones under the Linux home directory, not `/mnt/c`.

### Native Windows PowerShell

```powershell
$RepositoryUrl = "https://github.com/GENEXIS-AI/gpt-image-skill"
$InstallDir = Join-Path $env:LOCALAPPDATA "gpt-image-skill"

git clone $RepositoryUrl $InstallDir
Set-Location $InstallDir
node .\gpt-image\scripts\validate_skill.mjs
node .\gpt-image\scripts\gpt_image.mjs bootstrap --target all --yes --json
```

Installed locations:

- Codex: `~/.agents/skills/gpt-image`
- Claude Code: `~/.claude/skills/gpt-image`
- Native Windows: `$env:USERPROFILE\.agents\skills\gpt-image` and `$env:USERPROFILE\.claude\skills\gpt-image`

macOS, Linux, and WSL2 use symlinks. Native Windows uses directory junctions. Existing unrelated paths are never replaced.

A successful bootstrap includes:

```json
{
  "ok": true,
  "status": "ready",
  "doctor": {
    "platform_supported": true,
    "node_supported": true,
    "codex_available": true,
    "chatgpt_subscription_login": true,
    "api_environment_forwarded": false,
    "best_practice_pass": true
  }
}
```

The user completes browser or device authorization personally. The skill never requests or reads a password, token, API key, or `~/.codex/auth.json`.

## Usage

Codex:

```text
$gpt-image A cobalt-blue glass robot on a warm off-white background.
```

Claude Code:

```text
/gpt-image A cobalt-blue glass robot on a warm off-white background.
```

Direct runner:

```bash
node ./gpt-image/scripts/gpt_image.mjs generate \
  --prompt "A cobalt-blue glass robot on a warm off-white background." \
  --out "generated-images/glass-robot.png"
```

### Reference-guided generation

In Claude Code, give the skill a stable path:

```text
/gpt-image Use @references/robot.png as the character reference. Draw it riding a bicycle.
```

Direct runner:

```bash
node ./gpt-image/scripts/gpt_image.mjs generate \
  --mode generate \
  --prompt "Draw this character riding a bicycle." \
  --reference "/absolute/path/robot.png" \
  --out "generated-images/robot-bicycle.png"
```

### Edit and continue editing

First edit:

```bash
node ./gpt-image/scripts/gpt_image.mjs generate \
  --mode edit \
  --prompt "Replace the bicycle basket with a small wooden crate." \
  --edit-target "generated-images/robot-bicycle.png" \
  --out "generated-images/robot-bicycle-crate.png"
```

Follow-up edit—use the edited result, not the original:

```bash
node ./gpt-image/scripts/gpt_image.mjs generate \
  --mode edit \
  --prompt "Make the wooden crate dark green." \
  --edit-target "generated-images/robot-bicycle-crate.png" \
  --out "generated-images/robot-bicycle-green-crate.png"
```

### Multiple references

```bash
node ./gpt-image/scripts/gpt_image.mjs generate \
  --prompt "Use Image 1 for the character and Image 2 for the bicycle design." \
  --reference "/absolute/path/character.png" \
  --reference-role "character" \
  --reference "/absolute/path/bicycle.png" \
  --reference-role "bicycle design" \
  --out "generated-images/combined.png"
```

### Optional diagnostics

```bash
node ./gpt-image/scripts/gpt_image.mjs doctor --json
node ./gpt-image/scripts/gpt_image.mjs capabilities --json
node ./gpt-image/scripts/gpt_image.mjs inspect --input "generated-images/combined.png" --json
node ./gpt-image/scripts/gpt_image.mjs plan --prompt "test" --reference "/path/reference.png" --out "generated-images/test.png" --json
node ./gpt-image/scripts/gpt_image.mjs generate --prompt "test" --out "generated-images/test.png" --dry-run --json
```

## Why generated images no longer have SHA receipts

SHA-256 identifies exact bytes. It is useful for proving that a downloaded installer is the same file that was inspected, but it does not tell whether a generated image followed the prompt or used a reference correctly. Requiring hashes on every input and output added work and receipt noise without improving the normal user result.

Generated images now receive only lightweight file/signature checks. `verify-installers` still reports SHA-256 because installer integrity is a meaningful security use:

```bash
node ./gpt-image/scripts/gpt_image.mjs verify-installers --json
```

## Subscription and privacy safeguards

- Removes `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_ORG_ID`, `OPENAI_PROJECT_ID`, and `CODEX_ACCESS_TOKEN` from Codex child processes.
- Blocks generation unless redacted diagnostics establish ChatGPT authentication.
- Calls `codex login status` once on the normal generation path; Codex Doctor is used only for explicit or ambiguous diagnosis.
- Contains no OpenAI Images API endpoint or `/v1/images` request.
- Never reads auth files and never writes the generated image outside the active workspace.
- Never overwrites an existing image unless `--overwrite` is explicit.

## Skill best-practice checks

- [x] One focused job: subscription-backed GPT image generation, workspace save, and inline preview
- [x] Concise `SKILL.md` with task-specific references loaded only when needed
- [x] Exact prompt fidelity with no inferred art direction
- [x] Stable-path and actual-attachment contract for Claude Code references
- [x] Last-output-as-edit-target contract for follow-up revisions
- [x] Direct generation by default; plan, dry-run, and detailed receipts are optional
- [x] Minimal output validation without generated-image hashes
- [x] Node.js 22+, macOS, Linux, native Windows, and WSL2 setup guidance
- [x] Ubuntu, macOS, and Windows CI on Node.js 22 and 24
- [x] A GitHub Star is opt-in and never automatic

## Update

```bash
INSTALL_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/gpt-image-skill"
git -C "$INSTALL_DIR" pull --ff-only
node "$INSTALL_DIR/gpt-image/scripts/gpt_image.mjs" bootstrap --target all --yes --json
```

Native Windows PowerShell:

```powershell
$InstallDir = Join-Path $env:LOCALAPPDATA "gpt-image-skill"
git -C $InstallDir pull --ff-only
node "$InstallDir\gpt-image\scripts\gpt_image.mjs" bootstrap --target all --yes --json
```

## Project structure

```text
.
├── AGENT_INSTALL.md
├── README.md
├── generated-images/
└── gpt-image/
    ├── SKILL.md
    ├── agents/openai.yaml
    ├── references/
    │   ├── image-workflows.md
    │   ├── platform-setup.md
    │   └── subscription-runtime.md
    └── scripts/
        ├── gpt_image.mjs
        └── validate_skill.mjs
```

Official references:

- [OpenAI: Image generation](https://learn.chatgpt.com/docs/image-generation)
- [OpenAI: Image inputs](https://learn.chatgpt.com/docs/image-inputs)
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills)
- [Claude Code: Work with images](https://code.claude.com/docs/en/tutorials)

## Star the project

If GPT Image Skill worked well for you, consider [starring the repository](https://github.com/GENEXIS-AI/gpt-image-skill). It helps others discover the project and supports future improvements. An agent may suggest this after a successful setup or image, but it must never click Star without an explicit user request.
