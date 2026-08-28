# GPT Image Skill

[![Validate skill](https://github.com/GENEXIS-AI/gpt-image-skill/actions/workflows/validate.yml/badge.svg)](https://github.com/GENEXIS-AI/gpt-image-skill/actions/workflows/validate.yml)

Generate and edit GPT images from Codex, Claude Code, Google Antigravity, or another compatible local agent through the user's **ChatGPT subscription**. Direct prompts stay unchanged; when the user delegates several different designs, the agent develops a distinct image-ready prompt for each concept. Real reference files pass into generation, bridge-produced transparent PNGs are checked for alpha/transparency support, results stay in the active project, and ready outputs run with bounded parallelism.

```text
install skill → Sign in with ChatGPT → direct prompt or delegated concept prompts + local image inputs
              → single generate or bounded parallel batch
              → built-in $imagegen → <project>/generated-images/*.png
```

> This repository does not call the OpenAI Images API and does not create a separately billed Images API request. Built-in image generation still consumes included ChatGPT/Codex usage and remains subject to plan and workspace limits. OpenAI currently states that Codex image generation is **not available on the Free plan** and that supported-plan image generations use included limits 3–5× faster on average than similar non-image turns, depending on quality and size. This skill does not bypass that boundary.

![GPT Image Skill smoke test](./generated-images/subscription-workflow-smoke.png)

![GPT Image Skill reference edit smoke test](./generated-images/reference-edit-smoke.png)

## Install by pasting one prompt into an agent

Paste this into Codex, Claude Code, Google Antigravity, or another local coding agent:

```text
Install and verify GPT Image Skill for the current user from:

https://github.com/GENEXIS-AI/gpt-image-skill

For this task, I authorize read-only environment checks; a persistent clone or safe fast-forward update;
user-level installation of missing Git, a supported Node.js 22+ LTS, and Codex CLI;
creation of the gpt-image links for Codex, Claude Code, and Google Antigravity; and starting Sign in with ChatGPT device authorization.

Read AGENT_INSTALL.md at the repository root and follow it as the one-time installation contract.
Do not use the Images API, OPENAI_API_KEY, or API-key login. Do not generate a live image yet.
Pause only if administrator privileges are required, an unrelated existing path would be changed,
local changes would be discarded, or existing Codex authentication would need to be replaced.
Otherwise, install the required components, run bootstrap --target all --yes --json,
and continue until bootstrap's consolidated readiness report shows best_practice_pass=true.
Do not add a separate doctor, plan, inspect, or no-image generation check when bootstrap passes.
Finally, report the persistent clone path, all three installed skill paths, and ChatGPT-auth evidence.
Then give me the brief getting_started guide in my language: common aspect ratios,
quality phrases, one creation example, one reference or revision example, and one transparent-background example.
Do not use unexplained jargon such as "dry-run"; call it a setup check that does not create an image.
```

This prompt authorizes ordinary user-level setup without authorizing administrator elevation, destructive changes, replacement of existing authentication, a live generation, or a GitHub Star. The full boundary is in [AGENT_INSTALL.md](./AGENT_INSTALL.md).

After setup, invoke `$gpt-image` in Codex, `/gpt-image` in Claude Code, or mention `gpt-image` in an Antigravity request. Antigravity discovers the global skill automatically from its official skill directory. The host loads the concise skill only for image tasks; it does not need to reread this README on every request.

## What the agent shows after installation

The installing agent should end with a small guide like this, translated into the user's language:

```text
GPT Image Skill is ready. No image was generated during setup.

Common aspect-ratio requests: 1:1, 16:9, 9:16, 4:3, 3:4
Quality phrases: draft, high quality, high detail / final quality

Try:
$gpt-image Create a cozy reading room at sunset, 16:9, high quality.
/gpt-image Use @references/character.png as the character reference and place it in a rainy city, 9:16, high quality.
Use the gpt-image skill to create a flat blue robot app icon with a transparent background, 1:1, high quality.

CLI model policy: no model ID is pinned; Codex selects a current account-available model at Low reasoning.
Plan note: setup verifies sign-in, not image entitlement. Current Codex pricing excludes image generation from Free.
```

These are common natural-language requests, not a fixed API size list. Other framing or dimension requests can be written normally, and exact pixel dimensions may vary with built-in image generation. The guide appears once after installation rather than after every image.

## Design principles

### 1. The prompt is authoritative—and so is delegated creative intent

For one direct image or edit, the skill forwards the user's image request unchanged. It does not “improve” a short prompt with unsolicited details. A request such as “make five different poster designs” is different: it explicitly asks the agent to develop five creative concepts. The agent preserves the shared subject, references, brand, text, ratio, and other constraints, then sends one complete, meaningfully different image prompt per output. Job numbers remain in IDs and filenames, never in image prompts.

### 2. References are files, not descriptions

The bridge requires a readable local PNG, JPEG, or WebP path for each reference. It passes those files into the actual `$imagegen` call. It never replaces an unresolved reference with a text description and continues anyway.

In Claude Code or Antigravity:

- Prefer `@path/to/image.png` or an explicit filesystem path.
- A pasted or dragged image visible in the conversation is not automatically inherited by a nested `codex exec` process.
- If the host exposes an exact readable temporary attachment path, the agent copies that exact file into `<project>/generated-images/inputs/` and uses the copy.
- If the host exposes no path, save the image inside the project and provide that path before generation.
- The skill does not guess from `~/.claude/image-cache`; choosing “the newest image” could select the wrong or private file.

### 3. Revisions always edit the latest result

Each bridge invocation is ephemeral. For “change the result you just made,” the agent must use the previous generated output as the next `--edit-target` and reattach every still-needed reference. Reusing the original source is a different operation and loses the prior edit.

### 4. Normal generation stays light

The default path is:

```text
quick ChatGPT-auth check → current account-available Codex model at Low reasoning
                         → built-in image generation → minimal PNG sanity check
                         → PATH + inline Markdown
```

Planning, the setup check that does not create an image (`--dry-run`), `capabilities --json`, `inspect --input`, and detailed JSON remain available for troubleshooting. They are not required before a normal image request.

### 5. The model stays current; reasoning stays light

Codex model names and availability change over time. The default CLI bridge therefore does **not** pin Luna, Sol, Terra, or any other model ID and does not embed a model catalog. Codex selects a current model available to the signed-in account, while the runner requests **Low** reasoning—the CLI name for **Light** in the ChatGPT app. The selected Codex model receives a finalized, tightly scoped instruction and calls `$imagegen`.

The image renderer is not pinned either. OpenAI currently documents Codex's built-in renderer as `gpt-image-2`, but this repository invokes the built-in image-generation capability by name so OpenAI can update the underlying renderer without a skill release. The outer Codex model can affect tool routing and instruction following, but it does not replace the built-in renderer or directly set its visual rendering quality.

The default `auto` policy is intentionally small:

1. Let Codex select a current model available to the signed-in account.
2. Request Low reasoning for the deterministic bridge task.
3. Run no model-discovery preflight, fallback turn, or automatic image-generation retry.

`--orchestrator-model account-default` removes even the Low override and leaves both model and reasoning to Codex. A current model ID can still be pinned as an advanced, explicit user choice; the runner accepts the ID without maintaining its own allowlist.

This policy lowers bridge overhead on supported plans, but it cannot make image generation available on ChatGPT Free. Codex itself is included in Free, while the official pricing page separately says image generation is unavailable there. See [Codex models](https://learn.chatgpt.com/docs/models), [Codex image generation](https://learn.chatgpt.com/docs/image-generation), and [Codex pricing](https://learn.chatgpt.com/docs/pricing).

### 6. Parallelism is explicit and bounded

`generate` remains the one-image happy path. For two or more outputs, the skill automatically batches every job whose inputs already exist. Different design concepts run independently; same-design variants may run together while reading one shared edit target or design reference. Only an output-to-input dependency creates another stage. The batch checks ChatGPT auth once and uses default concurrency 2, maximum 4, with no Doctor, planning, inspection, model-discovery preflight, fallback turn, or image-generation retry per job.

## Features

- Uses Codex's built-in `$imagegen` under **Sign in with ChatGPT**
- Uses a host-native OpenAI/Codex `image_gen` tool directly only when it is backed by included ChatGPT/Codex usage
- Blocks `OPENAI_API_KEY`, API-key Codex login, and Images API fallback
- Leaves the default Codex model unpinned and requests Low reasoning for the deterministic CLI bridge
- Installs the same `gpt-image` skill for Codex, Claude Code, and Google Antigravity
- Preserves direct prompts verbatim and honors delegated multi-concept design work
- Supports one or multiple references with deterministic attachment order
- Supports existing-image edits, follow-up revisions, variations, compositing, transparency, exact text, and dense-layout drafts
- Supports bounded parallel generation for independent concepts and shared-anchor variations
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
| Same design, different styles | Repeat `--mode variation --edit-target SAME_PATH` in a batch |
| Same identity, different scenes | Repeat `--mode generate --reference SAME_PATH` in a batch |
| Different designs in parallel | Give each batch job its own prompt and references |
| CLI model routing | Default `auto` = current account-available Codex model at Low reasoning |

The edit target is Image 1. Supporting references follow in command-line order.

## Requirements and environments

- Node.js 22 or newer; the [current supported LTS](https://nodejs.org/en/download) is recommended.
- Git when installing from GitHub.
- Codex CLI signed in with ChatGPT, unless the calling host provides subscription-native OpenAI/Codex `image_gen`.
- A ChatGPT/Codex plan and workspace that permit image generation. The current official pricing page excludes image generation from the Free plan.

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
- Google Antigravity: `~/.gemini/config/skills/gpt-image`
- Native Windows: `$env:USERPROFILE\.agents\skills\gpt-image`, `$env:USERPROFILE\.claude\skills\gpt-image`, and `$env:USERPROFILE\.gemini\config\skills\gpt-image`

macOS, Linux, and WSL2 use symlinks. Native Windows uses directory junctions. Existing unrelated paths are never replaced.

The Antigravity target is the current global skill location documented for the Antigravity app. For the Antigravity SDK, `skills_paths` may instead point directly to the repository's `gpt-image` directory. Image generation still runs through the ChatGPT-authenticated Codex bridge; the skill deliberately does not substitute Antigravity's provider-native `generate_image` tool.

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
    "codex_skill_installed": true,
    "claude_skill_installed": true,
    "antigravity_skill_installed": true,
    "best_practice_pass": true
  },
  "getting_started": {
    "present_in_user_language": true,
    "common_aspect_ratios": [
      { "ratio": "1:1" },
      { "ratio": "16:9" },
      { "ratio": "9:16" },
      { "ratio": "4:3" },
      { "ratio": "3:4" }
    ]
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

Google Antigravity:

```text
Use the gpt-image skill to create a cobalt-blue glass robot on a warm off-white background.
```

Direct runner:

```bash
node ./gpt-image/scripts/gpt_image.mjs generate \
  --prompt "A cobalt-blue glass robot on a warm off-white background." \
  --out "generated-images/glass-robot.png"
```

The command above uses the default `auto` policy: Codex selects a current model available to the signed-in account, while the runner requests Low reasoning. No model catalog, model discovery, fallback, or extra diagnostic turn is involved. To leave both the model and reasoning effort entirely at Codex defaults:

```bash
node ./gpt-image/scripts/gpt_image.mjs generate \
  --prompt "A cobalt-blue glass robot on a warm off-white background." \
  --orchestrator-model account-default \
  --out "generated-images/glass-robot.png"
```

An advanced caller can explicitly pin any current Codex orchestrator and reasoning effort. The runner deliberately has no model-ID allowlist because the catalog changes. This changes the agent that routes `$imagegen`, not the built-in renderer:

```bash
node ./gpt-image/scripts/gpt_image.mjs generate \
  --prompt "A cobalt-blue glass robot on a warm off-white background." \
  --orchestrator-model "<current-codex-model-id>" \
  --orchestrator-effort medium \
  --out "generated-images/glass-robot.png"
```

### Transparent background

Ask for transparency naturally in any supported host:

```text
Use the gpt-image skill to create a flat cobalt-blue robot app icon with a transparent background, 1:1, high quality.
```

The agent keeps the creative prompt authoritative and routes transparency separately. With the bridge, the explicit runner form is:

```bash
node ./gpt-image/scripts/gpt_image.mjs generate \
  --prompt "Create a flat cobalt-blue robot app icon, 1:1, high quality." \
  --background transparent \
  --out "generated-images/robot-icon-transparent.png"
```

Transparent output must be a PNG with an alpha channel or PNG transparency chunk. When `--background transparent` is requested, the runner rejects a PNG that has neither; this verifies transparency support without pretending to be a visual-quality review. A checkerboard pattern, white canvas, or solid-color background is not a valid substitute for transparency. If a subscription-native host tool has no real background control, the skill uses the bridge when available instead of claiming transparency it cannot verify.

### Reference-guided generation

In Claude Code, give the skill a stable path:

```text
/gpt-image Use @references/robot.png as the character reference. Draw it riding a bicycle.
```

In Antigravity, use an explicit readable workspace path:

```text
Use the gpt-image skill with references/robot.png as the character reference. Draw it riding a bicycle.
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

### Parallel multiple images

The skill chooses one of three structures without asking the user to know the CLI:

- **Shared-anchor variations:** every job reads the same existing design. Use `variation` for the same composition in different styles, or use the design as the first reference when identity moves into different scenes or layouts.
- **Delegated concepts:** “different designs,” “concepts,” “directions,” “options,” or “alternatives” asks the agent to develop one complete creative prompt per output while preserving shared constraints and references.
- **Repeated renders:** a count without requested differences—or an explicit request to use the same prompt—reuses the exact image prompt.

For shared-anchor style variations, create a workspace-local manifest such as `image-jobs.json`:

```json
{
  "version": 1,
  "jobs": [
    {
      "id": "watercolor",
      "mode": "variation",
      "prompt": "Keep the same design and render it in watercolor style.",
      "edit_target": "references/base-design.png",
      "references": ["references/watercolor-style.png"],
      "reference_roles": ["style reference for this output"],
      "out": "generated-images/design-watercolor.png"
    },
    {
      "id": "clay",
      "mode": "variation",
      "prompt": "Keep the same design and render it in clay style.",
      "edit_target": "references/base-design.png",
      "references": ["references/clay-style.png"],
      "reference_roles": ["style reference for this output"],
      "out": "generated-images/design-clay.png"
    }
  ]
}
```

Then run:

```bash
node ./gpt-image/scripts/gpt_image.mjs batch \
  --manifest "image-jobs.json" \
  --concurrency 2
```

Several jobs may read the same anchor safely. Attach only the style reference relevant to that output after the shared design anchor; do not attach every style reference to every job. For different design concepts, omit the shared `edit_target` and give each job its own standalone creative prompt and relevant references. Do not append “this is the Nth option”; `id` and `out` already carry that metadata.

If no common design image exists, generate the first requested output and use its returned path as the anchor for the remaining parallel variants. The skill does not generate an extra hidden anchor that consumes additional subscription usage. A batch output cannot feed another job in that same batch; mixed workflows run ready jobs in stages.

Each job returns its own `PATH[id]` and `MARKDOWN[id]`. The runner does not retry a failed image generation, run a model fallback, or switch to the Images API when a subscription limit is reached. See [Image and reference workflows](./gpt-image/references/image-workflows.md#multi-image-workflows) for independent-concept and mixed-dependency examples.

### Optional troubleshooting

```bash
node ./gpt-image/scripts/gpt_image.mjs doctor --json
node ./gpt-image/scripts/gpt_image.mjs guide
node ./gpt-image/scripts/gpt_image.mjs capabilities --json
node ./gpt-image/scripts/gpt_image.mjs inspect --input "generated-images/combined.png" --json
node ./gpt-image/scripts/gpt_image.mjs plan --prompt "test" --reference "/path/reference.png" --out "generated-images/test.png" --json
# Check sign-in and paths without creating an image:
node ./gpt-image/scripts/gpt_image.mjs generate --prompt "test" --out "generated-images/test.png" --dry-run --json
# Check a batch manifest and scheduling without sign-in or image generation:
node ./gpt-image/scripts/gpt_image.mjs batch --manifest "image-jobs.json" --check-only --json
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
- Leaves the Codex model and built-in renderer unpinned; default `auto` requests only CLI Low reasoning from the current account-available model.
- Checks authentication once for a live batch, not once per job; no diagnostic command runs per job.
- Contains no OpenAI Images API endpoint or `/v1/images` request.
- Never reads auth files and never writes the generated image outside the active workspace.
- Never overwrites an existing image unless `--overwrite` is explicit.

## Skill best-practice checks

- [x] One focused job: subscription-backed GPT image generation, workspace save, and inline preview
- [x] Concise `SKILL.md` with task-specific references loaded only when needed
- [x] Exact prompt fidelity with no inferred art direction
- [x] Stable-path and actual-attachment contract for Claude Code references
- [x] Google Antigravity global discovery with the ChatGPT-authenticated Codex bridge, not provider substitution
- [x] Transparent-background routing plus PNG alpha/transparency validation on the bridge path
- [x] Last-output-as-edit-target contract for follow-up revisions
- [x] Direct generation by default; planning, no-image setup checks, and detailed receipts are optional
- [x] Unpinned, runtime-selected Codex model with Low bridge reasoning, no embedded model catalog, and no Free-plan bypass
- [x] Shared-anchor variations and independent concepts use bounded parallel batches; one auth check and zero diagnostic gates per job
- [x] One-time, user-language getting-started guide with ratio and quality examples
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
- [Google Antigravity: Agent Skills](https://antigravity.google/docs/skills/)
- [Google Antigravity SDK: Tools and skills](https://antigravity.google/docs/sdk/tools/)

## Star the project

If GPT Image Skill worked well for you, consider [starring the repository](https://github.com/GENEXIS-AI/gpt-image-skill). It helps others discover the project and supports future improvements. An agent may suggest this after a successful setup or image, but it must never click Star without an explicit user request.
