# GPT Image Skill

[![Validate skill](https://github.com/GENEXIS-AI/gpt-image-skill/actions/workflows/validate.yml/badge.svg)](https://github.com/GENEXIS-AI/gpt-image-skill/actions/workflows/validate.yml)

Generate or edit GPT images from Codex, Claude Code, or another compatible local agent using the user's **ChatGPT subscription**—without calling the OpenAI Images API. The skill saves the result inside the active project, validates it, and returns an absolute Markdown path so supported chat clients can display it inline.

```text
install skill → inspect environment → Sign in with ChatGPT → $imagegen
              → <active project>/generated-images/*.png → inline preview
```

> This project does not create separately billed Images API requests. Image generation still consumes the user's included ChatGPT/Codex usage and is subject to plan and workspace limits.

![GPT Image Skill smoke test](./generated-images/subscription-workflow-smoke.png)

The reference-edit smoke test below used the first image as the primary edit target, changed only its center symbol, and preserved the surrounding aperture, background, dimensions, and crop through the subscription-backed Codex CLI bridge.

![GPT Image Skill reference edit smoke test](./generated-images/reference-edit-smoke.png)

## Install by pasting one prompt into an agent

Copy the block below into Codex, Claude Code, or another local coding agent exactly as written:

```text
Install and fully verify GPT Image Skill for the current user from this GitHub repository:

https://github.com/GENEXIS-AI/gpt-image-skill

For this task, I authorize read-only environment checks; a persistent clone or safe fast-forward update;
user-level installation of missing Git, a supported Node.js 22+ LTS, and Codex CLI;
creation of the gpt-image links for Codex and Claude Code; and starting Sign in with ChatGPT device authorization.

First read AGENT_INSTALL.md at the repository root as the one-time installation contract and follow it.
Do not use the Images API, OPENAI_API_KEY, or API-key login. Do not generate a live image yet.
Pause only if administrator privileges are required, an unrelated existing path would be changed,
local changes would be discarded, or existing Codex authentication would need to be replaced.
Otherwise, inspect and install the required components, run bootstrap --yes,
and continue until doctor reports best_practice_pass=true and the generation dry-run succeeds.
Finally, report the persistent clone path, both installed skill paths,
the ChatGPT-subscription authentication evidence, and the dry-run result.
```

This prompt is deliberately scoped authorization. An agent does not need to ask again merely because Node.js or Codex CLI is missing. It must still stop before:

- requesting administrator elevation or using an unsupported installer;
- replacing an unrelated file, directory, or link;
- discarding local repository changes;
- logging out or replacing existing API-key authentication;
- generating a live image, starring the repository, or performing another external action.

The authoritative one-time bootstrap contract is [AGENT_INSTALL.md](./AGENT_INSTALL.md).

## Why the agent does not reread the whole repository

Agent Skills use progressive disclosure:

1. The host normally sees only the short skill name and description.
2. It loads `SKILL.md` only when an image request selects `gpt-image`.
3. It reads a task-specific workflow, platform, or runtime reference only when that issue occurs.

The README and `AGENT_INSTALL.md` are therefore needed for initial installation, not for every image request. After setup, invoke `$gpt-image` in Codex or `/gpt-image` in Claude Code. This follows [OpenAI's skill progressive-disclosure model](https://learn.chatgpt.com/docs/build-skills).

## Features

- Uses Codex's built-in `$imagegen` under **Sign in with ChatGPT**
- Blocks `OPENAI_API_KEY`, API-key login, and OpenAI Images API fallback
- Installs the same `gpt-image` skill for Codex and Claude Code
- Saves generated assets only inside the invoking agent's active workspace
- Separates one primary edit target from ordered, role-labeled supporting references
- Supports single and multiple reference images, localized edits, variations, compositing, iterative refinement, transparency, exact text, and dense-layout drafts
- Provides an auth-free `plan` command and a machine-readable `capabilities` report
- Validates every input image's PNG/JPEG/WebP signature, byte size, and SHA-256 before attachment
- Validates final PNG signature, dimensions, alpha status, byte size, and SHA-256
- Returns absolute Markdown paths for inline previews
- Avoids overwriting by default and creates `-v2`, `-v3`, and later versions
- Diagnoses macOS, Linux, native Windows, and WSL2
- Connects skill links, Codex installation, login, doctor, and route dry-run through one `bootstrap` command

## Supported image workflows

| Workflow | Native host | Codex subscription bridge |
| --- | --- | --- |
| Text-to-image | Built-in `image_gen` | `--mode generate` |
| One visual reference | Attach and name its role | `--reference` + `--reference-role` |
| Multiple references | Number content/style/layout inputs | Repeat both reference flags in matching order |
| Existing-image edit | Mark one primary target and list invariants | `--mode edit --edit-target` |
| Localized change | Describe the spatial area and preserved surroundings | `--region` + repeated `--preserve` |
| Style transfer / compositing | Assign a role to every input | Edit target first, then ordered role-labeled references |
| Variation | Reuse the selected source and preserve identity/layout | `--mode variation --edit-target` |
| Iterative revision | Make one targeted change and reuse the selected output | Use the previous output as the next edit target |
| Transparent cutout | Request actual alpha and inspect it | `--background transparent` |
| Exact text / infographic | Quote short text and inspect every word | Repeat `--exact-text`; put layout and typography in the prompt |
| Several assets or variants | One native call per final image | One bridge invocation and output path per final image |

This covers the practical generation and editing workflows exposed by Codex's built-in image generator while keeping the subscription-only boundary. Interactive Canvas area selection and conversation multi-select are host UI gestures; a CLI-only session expresses the same intent with a spatial `--region`, numbered files, and explicit preservation rules. API-only parameters and separately billed Images API fallbacks are intentionally not part of this project.

## How it works

```text
Codex / Claude Code / compatible local agent
        │
        ├─ use native image_gen when the host exposes it
        │
        └─ otherwise use the gpt-image bridge
              ├─ inspect OS / Node.js / Codex CLI
              ├─ verify Sign in with ChatGPT
              ├─ validate and role-label local image inputs
              └─ remove API-related environment variables
                        │
                        ▼
             codex exec --ignore-user-config
                        │
                        ▼
               built-in $imagegen
                        │
                        ▼
       <workspace>/generated-images/*.png
                        │
                        └─ raster validation + SHA-256 + Markdown
```

The Codex SDK and App Server can manage richer Codex threads, but one bounded `codex exec` turn is the smallest useful bridge for producing a single workspace asset.

## Supported environments

| Environment | Status | Installation boundary |
| --- | --- | --- |
| macOS, Apple Silicon or Intel | Supported | macOS Node.js + official Codex `install.sh` |
| Linux, x64 or arm64 | Supported | Linux Node.js + official Codex `install.sh` |
| Native Windows | Supported | Windows Node.js + official Codex `install.ps1` + directory junctions |
| WSL2 | Supported | Keep Node, Codex, clone, skill, workspace, and output inside WSL2 |
| WSL1 | Unsupported | Migrate to WSL2 or use native Windows |

The bridge requires:

- Node.js 22 or newer; the [current supported Node.js LTS](https://nodejs.org/en/download) is recommended.
- Git when installing from the GitHub URL.
- A ChatGPT/Codex plan and workspace that permit image generation through **Sign in with ChatGPT**.
- A separately usable Claude Code session if Claude Code is the calling host.

When the current Codex or ChatGPT host exposes `image_gen` directly, the skill uses that native route and does not install a nested Codex CLI.

## Manual installation

Use a persistent user-owned clone. The installed links continue to point to that clone.

### macOS, Linux, and WSL2

```bash
REPOSITORY_URL="https://github.com/GENEXIS-AI/gpt-image-skill"
INSTALL_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/gpt-image-skill"

git clone "$REPOSITORY_URL" "$INSTALL_DIR"
cd "$INSTALL_DIR"
node ./gpt-image/scripts/validate_skill.mjs
node ./gpt-image/scripts/gpt_image.mjs bootstrap --target all --yes --json
```

On WSL2, keep the clone under the Linux home directory rather than `/mnt/c`, and do not mix Windows Node/Codex with the WSL toolchain.

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

macOS, Linux, and WSL2 use symlinks. Native Windows uses directory junctions. The installer removes a former `gpt-image-workspace` alias only when its target proves that this repository owns it; ordinary directories and unrelated links are preserved.

### Granular setup commands

```bash
node ./gpt-image/scripts/gpt_image.mjs install --target all --dry-run --json
node ./gpt-image/scripts/gpt_image.mjs install --target all --json
node ./gpt-image/scripts/gpt_image.mjs verify-installers --json
node ./gpt-image/scripts/gpt_image.mjs install-codex --yes
node ./gpt-image/scripts/gpt_image.mjs login
node ./gpt-image/scripts/gpt_image.mjs doctor --json
```

`install-codex` uses `https://chatgpt.com/codex/install.sh` on macOS, Linux, and WSL2, and `https://chatgpt.com/codex/install.ps1` on native Windows. `verify-installers` checks the allowed HTTPS redirect, byte count, and SHA-256 without executing either installer.

The user completes browser or device authorization personally. The installer and agent must not request or read a password, token, API key, or `~/.codex/auth.json`.

A successful bootstrap receipt includes:

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
  },
  "generation_dry_run": {
    "ok": true,
    "dry_run": true
  }
}
```

## Usage

Codex:

```text
$gpt-image Create a small cobalt-blue glass robot on a warm off-white background. Save it in the current project and show it inline.
```

Claude Code:

```text
/gpt-image Create a small cobalt-blue glass robot on a warm off-white background. Save it in the current project and show it inline.
```

Direct runner:

```bash
node ./gpt-image/scripts/gpt_image.mjs generate \
  --prompt "A cobalt-blue camera aperture symbol centered on a warm off-white background. No text or watermark." \
  --out "generated-images/camera-aperture.png" \
  --size "square" \
  --quality "final" \
  --background "opaque" \
  --json
```

Validate authentication, routing, and output paths without generating:

```bash
node ./gpt-image/scripts/gpt_image.mjs generate \
  --prompt "smoke test" \
  --out "generated-images/smoke-test.png" \
  --dry-run \
  --json
```

Inspect the full capability contract:

```bash
node ./gpt-image/scripts/gpt_image.mjs capabilities --json
```

Inspect a workspace PNG produced by a native host or the bridge:

```bash
node ./gpt-image/scripts/gpt_image.mjs inspect \
  --input "generated-images/product-hero.png" \
  --json
```

Add `--require-transparency` for a transparent asset; validation fails when the PNG has no alpha channel or transparency chunk.

Validate a reference or edit plan without authentication or image-generation usage:

```bash
node ./gpt-image/scripts/gpt_image.mjs plan \
  --mode edit \
  --prompt "Replace only the mug with a small potted plant." \
  --edit-target "/absolute/path/product-photo.png" \
  --region "the mug on the left side of the desk" \
  --preserve "person, desk layout, lighting, colors, crop, and every other detail" \
  --avoid "text, logos, and watermarks" \
  --out "generated-images/plant-edit.png" \
  --json
```

Edit one primary image:

```bash
node ./gpt-image/scripts/gpt_image.mjs generate \
  --mode edit \
  --prompt "Keep the person and composition unchanged; replace only the background with a warm sunset." \
  --edit-target "/absolute/path/reference.png" \
  --preserve "person, pose, composition, crop, lighting direction, and foreground" \
  --out "generated-images/sunset-edit.png" \
  --json
```

Generate from multiple role-labeled references:

```bash
node ./gpt-image/scripts/gpt_image.mjs generate \
  --mode generate \
  --prompt "Create a landing-page hero. Use Image 1 for the product and Image 2 only for line work, palette, and shadows. Leave the upper-right clear for copy." \
  --reference "/absolute/path/product.png" \
  --reference-role "product identity and camera-angle reference" \
  --reference "/absolute/path/style.png" \
  --reference-role "line work, palette, and shadow reference" \
  --avoid "logos, text, and watermarks" \
  --out "generated-images/product-hero.png" \
  --json
```

Create a variation, then use its output as the next edit target for another targeted revision:

```bash
node ./gpt-image/scripts/gpt_image.mjs generate \
  --mode variation \
  --prompt "Create a warmer evening variation with softer shadows." \
  --edit-target "generated-images/product-hero.png" \
  --preserve "product identity, camera angle, layout, and crop" \
  --out "generated-images/product-hero-evening.png" \
  --json
```

The runner attaches the edit target as Image 1, then supporting references in command-line order. Every JSON receipt records each input's attachment index, role, detected format, byte size, and SHA-256.

## Subscription-only safeguards

- Removes `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_ORG_ID`, `OPENAI_PROJECT_ID`, and `CODEX_ACCESS_TOKEN` from every Codex child process.
- Checks redacted `codex login status` and `codex doctor --json` output for explicit ChatGPT-auth evidence.
- Stops before generation when API-key authentication is detected or ChatGPT authentication cannot be verified.
- Contains no OpenAI Images API endpoint or `/v1/images` request.
- Never reads authentication files and constrains output to the active workspace.
- Never replaces an existing output without `--overwrite`.

## Security and privacy

- No credential, token, personal filesystem path, or private email address is required in this repository.
- Authentication stays in the user's local Codex installation; the skill never reads `~/.codex/auth.json`.
- Diagnostic and bridge output is sanitized before it can be returned.
- Official installer redirects are restricted to `chatgpt.com` and `releases.openai.com`.
- GitHub Actions uses read-only repository permissions and pinned action commit SHAs.

Before publishing a fork, scan the full Git history rather than only the working tree. Never commit Codex authentication files, shell profiles, `.env` files, API keys, or generated diagnostics containing account data.

## Skill best-practice checks

- [x] One focused job: subscription-backed GPT image generation, workspace save, and inline preview
- [x] Only name and description are always discoverable; body and references load on demand
- [x] Scripts are limited to deterministic installation, authentication, request planning, path, and file-validation behavior
- [x] Node.js 22+, native Windows/WSL2 boundaries, persistent clone, and non-destructive host links
- [x] Machine-readable `best_practice_pass` and `next_action` fields from `doctor --json`
- [x] Generation dry-run before the first live bridge request
- [x] Auth-free plan validation for generate, edit, variation, and ordered multi-reference requests
- [x] Explicit input roles plus PNG/JPEG/WebP signature, byte-size, and SHA-256 validation
- [x] One inspected output per call for safer iterative edits and variants
- [x] Ubuntu, macOS, and Windows CI on Node.js 22 and 24
- [x] A GitHub Star is an opt-in request after success and is never automatic

Release validation:

```bash
node --check ./gpt-image/scripts/gpt_image.mjs
node ./gpt-image/scripts/validate_skill.mjs
node ./gpt-image/scripts/gpt_image.mjs capabilities --json
node ./gpt-image/scripts/gpt_image.mjs inspect --input "generated-images/subscription-workflow-smoke.png" --json
node ./gpt-image/scripts/gpt_image.mjs install --target all --dry-run --json
node ./gpt-image/scripts/gpt_image.mjs doctor --json
node ./gpt-image/scripts/gpt_image.mjs plan --mode edit --prompt "release reference check" --edit-target "generated-images/subscription-workflow-smoke.png" --preserve "all unspecified details" --out "generated-images/release-edit-check.png" --json
node ./gpt-image/scripts/gpt_image.mjs generate --prompt "release route check" --out "generated-images/release-check.png" --dry-run --json
```

GitHub Actions validates syntax, the repository validator, and real host-link installation on Ubuntu, macOS, and Windows with Node.js 22 and 24. CI has no user authentication, so it does not log in or generate a live image.

## Troubleshooting

- `node_supported=false`: follow the OS-specific Node.js 22+ instructions in [Cross-platform setup](./gpt-image/references/platform-setup.md), then open a new shell.
- `codex_available=false`: run `codex --version` in the same shell; restart the terminal or agent after a new installation.
- WSL failure: WSL1 is unsupported. Keep all runtimes and the clone on the Linux side of WSL2.
- `chatgpt_subscription_login=false`: run `node ./gpt-image/scripts/gpt_image.mjs login`, then rerun doctor.
- API-key auth detected: the runner will not log out automatically. The user must separately decide whether to replace that authentication.
- Skill not visible: start a new Codex or Claude Code session.

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
├── .github/workflows/validate.yml
├── generated-images/reference-edit-smoke.png
├── generated-images/subscription-workflow-smoke.png
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

Related documentation:

- [One-time agent installation contract](./AGENT_INSTALL.md)
- [Skill execution contract](./gpt-image/SKILL.md)
- [Subscription runtime and authentication boundary](./gpt-image/references/subscription-runtime.md)
- [Reference images, edits, variations, and iterative workflows](./gpt-image/references/image-workflows.md)
- [macOS, Linux, Windows, and WSL2 setup](./gpt-image/references/platform-setup.md)
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills)
- [Codex image generation](https://learn.chatgpt.com/docs/image-generation)
- [Codex CLI](https://learn.chatgpt.com/docs/codex/cli)
- [Codex authentication](https://learn.chatgpt.com/docs/auth)
- [Claude Code skills](https://code.claude.com/docs/en/slash-commands)

---

If the installation or your first image works well, please consider leaving the repository a ⭐ Star. Real user feedback and Stars help guide maintenance and future improvements.
