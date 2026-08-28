# ChatGPT subscription runtime

Read this reference only for installation, authentication, backend diagnosis, or architecture questions.

## The one supported route

```text
Agent Skill
  -> subscription-native OpenAI/Codex image_gen when available, otherwise installed Codex CLI
  -> Sign in with ChatGPT
  -> codex exec (runtime-selected Codex model, Low reasoning by default)
  -> built-in $imagegen / image_gen (underlying renderer unpinned)
  -> workspace PNG
  -> absolute Markdown preview
```

This skill has no Images API route. It removes `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_ORG_ID`, `OPENAI_PROJECT_ID`, and `CODEX_ACCESS_TOKEN` from the child environment before every Codex diagnostic, login, and generation command.

Google Antigravity exposes its own provider-native `generate_image` tool, but this skill does not use that route. In Antigravity it always invokes the Codex CLI bridge so the image is generated through the user's ChatGPT/Codex included usage rather than silently changing providers.

## Why Codex CLI is the bridge

- OpenAI currently documents Codex's built-in image generation as using `gpt-image-2`, and it can count against general Codex usage limits when the user is signed in with ChatGPT. The runner calls the capability without pinning that renderer name so future service updates remain compatible.
- `codex exec` provides a bounded non-interactive agent turn and supports one or more initial reference images with repeated `--image`. The bridge attaches a primary edit target first, then ordered supporting references. Each invocation is ephemeral, so a revision must reattach the current output and any still-needed references.
- The runner can start several ready `codex exec` turns through `batch`. Jobs may share the same read-only edit target or reference, so same-design variations can run beside independent concepts. It checks ChatGPT auth once, then uses bounded concurrency (2 by default, 4 maximum). An output-dependent revision waits for the stage that creates its input. This is local CLI orchestration, not an atomic OpenAI batch-image feature.
- The Codex SDK controls coding-focused Codex threads. It is useful when an application needs thread lifecycle APIs, but it does not remove the need for the Codex runtime.
- Codex App Server is the JSON-RPC interface for rich clients needing conversation history, approvals, authentication state, and streamed events. It is unnecessary overhead for one generated workspace asset.

## Orchestrator model selection

The Codex model running `codex exec` is an **orchestrator**. It reads the deterministic bridge instruction, attaches the supplied files, and calls `$imagegen`. The built-in image-generation service renders the pixels. The outer model can affect tool routing and instruction following, but selecting a larger orchestrator does not replace the built-in renderer; the bridge reduces routing risk by forwarding a finalized prompt unchanged and making attachment order explicit.

Model names and account availability change over time, so the runner embeds no Codex model catalog and pins no default model ID. The default `--orchestrator-model auto` policy:

1. Omits `codex exec -m`, allowing Codex to select a current model available to the signed-in ChatGPT account.
2. Adds `model_reasoning_effort="low"` because OpenAI describes Low in the CLI (Light in the app) as suitable for quick, well-scoped tasks.
3. Starts the image task immediately, with no model-list query, discovery turn, fallback turn, or automatic retry.

`--orchestrator-model account-default` omits both model and reasoning overrides. An advanced caller may pass any current Codex model ID plus `--orchestrator-effort <current-level>`; the CLI, not this repository, validates current availability. Explicit model IDs are never invented by the skill and are used only when the user requests one.

The image renderer follows the same future-proofing rule. Although current official documentation names `gpt-image-2`, the bridge calls built-in `$imagegen` rather than pinning an underlying renderer model in its runtime contract.

Codex is included in ChatGPT Free, but the current official pricing documentation separately states that **image generation is not available on the Free plan**. Low reasoning can make an eligible bridge turn lighter; it cannot grant image entitlement. This skill reports that boundary and never switches to an API-key route.

Official references:

- Codex image generation: https://learn.chatgpt.com/docs/image-generation
- Codex image inputs: https://learn.chatgpt.com/docs/image-inputs
- Codex models and reasoning levels: https://learn.chatgpt.com/docs/models
- Codex plans and image-generation availability: https://learn.chatgpt.com/docs/pricing
- Codex CLI: https://learn.chatgpt.com/docs/codex/cli
- Codex SDK: https://learn.chatgpt.com/docs/codex-sdk
- Codex App Server: https://learn.chatgpt.com/docs/app-server
- Google Antigravity skills: https://antigravity.google/docs/skills/
- Google Antigravity SDK tools and `skills_paths`: https://antigravity.google/docs/sdk/tools/

## Installation

The bridge runner requires Node.js 22 or newer; the latest supported Node.js LTS is recommended. When Node, Git, PATH, Windows/WSL selection, or Codex is missing, use [platform-setup.md](platform-setup.md).

The runner's `install-codex --yes` command downloads the current official installer from exactly one platform URL:

```text
macOS/Linux/WSL2: https://chatgpt.com/codex/install.sh
Windows:          https://chatgpt.com/codex/install.ps1
```

It saves the installer to an OS temporary directory, rejects an HTML or malformed response, runs it with `/bin/sh` or PowerShell, and removes the temporary file. It supports macOS, native Linux, native Windows, and WSL2. WSL1 is unsupported by current Codex.

## Authentication

Use only ChatGPT sign-in. The runner starts:

```bash
codex login --device-auth
```

The user completes the browser/device step. Never use `codex login --with-api-key`.

Normal generation checks redacted `codex login status` once. It calls `codex doctor --json` only for an explicit Doctor run or when login status is ambiguous. A positive result requires explicit ChatGPT-auth evidence such as `Logged in using ChatGPT` or a Doctor field whose reachability mode is `ChatGPT auth`. Unrelated Doctor failures, such as a malformed `config.toml`, do not negate a positive redacted ChatGPT-auth field because generation itself runs with `--ignore-user-config`.

If an API-key login is detected, block generation. Do not automatically log out because that replaces authentication state. Ask the user whether they want to replace it with ChatGPT sign-in.

## Host discovery

- Codex discovers the skill at `~/.agents/skills/gpt-image` and invokes it as `$gpt-image`.
- Claude Code discovers the skill at `~/.claude/skills/gpt-image` and invokes it as `/gpt-image`.
- Google Antigravity discovers the global skill at `~/.gemini/config/skills/gpt-image`. Mention `gpt-image` in the request; Antigravity loads relevant skills automatically. An Antigravity SDK configuration may instead include the repository's `gpt-image` directory in `skills_paths`.
- On native Windows, `~` means the Windows user profile and the installer creates directory junctions. On WSL2, `~` is the Linux home and the links must stay inside WSL2.
- Restart or start a new session after first installation if the host does not refresh its skill list.

## Usage implications

Image generation is unavailable on the Free plan and is not free of limits on supported plans: it consumes the user's included Codex/ChatGPT allowance, and official documentation says image generations use included limits 3–5 times faster on average than similar turns without image generation, depending on quality and size. Every parallel job counts separately. It does not create a separately billed Images API request because this skill never calls that API and strips API-key environment variables from the Codex child process.

The subscription bridge exposes built-in generation and editing through natural-language image instructions, not Images API parameters. It forwards each finalized image prompt unchanged and uses separate routing metadata only to attach requested local files and carry explicit options. A direct request remains the user's prompt; when the user delegates several different concepts, the calling agent develops the distinct per-output prompts before invoking the bridge. Its runner supports new images, a primary edit target, single or multiple ordered references, spatial edits, explicit preservation and avoid lists, variations, transparent-background requests, exact text, and one final PNG per invocation. For `--background transparent`, it passes the user-supplied setting as an operational constraint and then rejects a PNG with no alpha channel or transparency chunk. `batch` coordinates every invocation whose inputs already exist, including jobs that share a read-only anchor; dependent revisions stay sequential. ChatGPT Canvas area selection and conversation multi-select remain host UI features; CLI sessions express those intents with `--region` and ordered local inputs only when the user asks for them.
