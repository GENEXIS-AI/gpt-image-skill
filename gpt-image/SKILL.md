---
name: gpt-image
description: Generate or edit raster images through the user's ChatGPT subscription and save or preview workspace PNGs. Use for text-to-image, local-reference generation, edits, follow-up revisions, transparent PNGs, variants, multi-image batches, or subscription-backed setup in Codex, Claude Code, Google Antigravity, and compatible local agents. Preserve direct prompts verbatim; develop distinct per-output prompts when the user delegates multiple concepts. Attach actual reference files. Use subscription-native OpenAI image_gen when available; otherwise use Codex CLI with ChatGPT sign-in. Never use the Images API, OPENAI_API_KEY, API-key login, or a different provider's image generator.
---

# GPT Image Skill

Generate or edit one or more raster images, save results under the current workspace, and show them in chat.

## Keep the subscription boundary

- Never call the OpenAI Images API or fall back to a separately billed route.
- Never use, request, inspect, print, or forward `OPENAI_API_KEY`.
- Never use `codex login --with-api-key` or read `~/.codex/auth.json`.
- Require explicit **ChatGPT auth** before the bridge generates an image.
- Stop when API-key auth is detected. Replace authentication only after a separate explicit user choice.

## Choose the route

1. Use a host-native OpenAI/Codex `image_gen` tool directly only when it is backed by the user's included ChatGPT/Codex usage. Do not install Node.js or start nested Codex in that case.
2. Otherwise use `scripts/gpt_image.mjs`. Claude Code, Google Antigravity, and generic local agents need Node.js 22+, Codex CLI, and Sign in with ChatGPT in the same OS environment.
3. In Antigravity, do not substitute its built-in `generate_image` tool. That is a different provider route and does not satisfy this skill's GPT Image through ChatGPT-subscription contract. Run the Codex CLI bridge instead.

Read [image-workflows.md](references/image-workflows.md) for references, conversation attachments, edits, follow-up revisions, or multiple images. Read [subscription-runtime.md](references/subscription-runtime.md) for authentication or architecture. Read [platform-setup.md](references/platform-setup.md) only when setup is missing or uncertain.

## Preserve the user's request

- For a direct image or edit request, treat the user's image prompt as authoritative and pass it through unchanged. Do not rewrite, expand, optimize, translate, beautify, or add creative guidance.
- Distinguish repeated renders from delegated concept development. “Make five images with this exact prompt” means repeat the same prompt. “Make five different designs/concepts/options” means the user has asked the agent to develop five distinct creative directions.
- For delegated concepts, preserve every explicit subject, product, reference, brand, text, ratio, quality, and exclusion constraint, then write one standalone image-ready prompt per output. Make the concepts meaningfully different in composition and art direction; do not merely number the same prompt.
- Never append ordinal or orchestration metadata such as “this is the first of five,” “1st option,” or “1번째 시안” to an image prompt. The job `id` and output path carry ordering.
- When the user names the individual directions, follow those directions instead of replacing them. When the user does not delegate creative differences, do not invent them.
- Outside creative choices the user delegated, add a constraint only when the user explicitly supplied it through the prompt or a runner flag.
- Ask one concise question only when missing information makes the requested operation impossible. Otherwise generate without prompt coaching.

## Resolve references before generation

- Require a real, readable local path for every bridge reference and edit target.
- In Claude Code, prefer an explicit `@path` or filesystem path. In Antigravity, prefer an explicit workspace path. If the current attachment context exposes an exact readable temporary path, copy that exact file non-destructively into `<workspace>/generated-images/inputs/` and use the copy. If the host can see the image but exposes no path, stop before generation and ask the user to save it in the workspace and provide that path.
- Never silently omit an unresolved image, replace it with a text description, or guess a file from a host cache such as `~/.claude/image-cache`.
- Use `--reference` when an image guides a new image. Use `--edit-target` when that exact image must be changed.
- For a follow-up such as “change the last result,” use the previously returned output as the new `--edit-target`. Do not reuse the original source by mistake.
- Treat every bridge call as ephemeral. Reattach the current edit target and every still-needed reference on every revision.
- Keep the final absolute output path in the response so the next turn can reuse it.

## Bootstrap the bridge

Resolve this installed skill directory from the loaded `SKILL.md`; `${CLAUDE_SKILL_DIR}` points to it in Claude Code. Quote paths containing spaces.

Check `node --version` first. If Node.js is absent or older than 22, follow [platform-setup.md](references/platform-setup.md). After the user authorizes user-level skill links, Codex installation, and device login, run:

```bash
node <skill-folder>/scripts/gpt_image.mjs bootstrap --target all --yes --json
```

The command installs non-destructive Codex, Claude Code, and Antigravity skill links, installs a missing Codex CLI from the official platform installer, starts Sign in with ChatGPT when signed out, and returns one consolidated readiness report plus `getting_started`. It reuses the auth result already obtained during setup rather than running a second diagnostic pass. It does not generate an image or require a no-image setup check.

After successful installation, present `getting_started` once in the user's language. Keep it brief: say setup is ready, list common ratio requests (`1:1`, `16:9`, `9:16`, `4:3`, `3:4`), mention natural-language quality phrases (`draft`, `high quality`, `high detail, final quality`), and show one creation example, one reference or revision example, and one transparent-background example. Explain that exact pixel dimensions may vary. Do not repeat this guide after ordinary image requests.

Do not say “dry-run” without explanation. When troubleshooting requires the literal `--dry-run` flag, describe it to the user as **a setup check that does not create an image**.

Use `doctor --json` for diagnosis. Follow its `next_action`; never improvise an API route. Keep Windows runtimes on native Windows and Linux runtimes inside WSL2. WSL1 is unsupported.

## Generate with the bridge

Run the requested generation directly. Do not run `doctor`, `plan`, `inspect`, `capabilities`, or the no-image setup check (`--dry-run`) first unless the user asks or a real error needs diagnosis.

The runner's default `auto` policy does not pin a Codex model name or embed a model list. It lets Codex select a current model available to the signed-in account and requests CLI `low` reasoning (Light in the app) for the already-finalized `$imagegen` routing task. The built-in image renderer is also unpinned so service updates do not require a skill edit. Do not pin or raise the orchestrator model merely to improve visual rendering quality. The runner must not run model discovery, a fallback turn, an image-generation retry, or a retry for usage-limit or plan restrictions. Never promise that lower reasoning unlocks a restricted plan; check current official Codex pricing when eligibility matters, and never route around a restriction with an API.

```bash
node <skill-folder>/scripts/gpt_image.mjs generate \
  --prompt "<user prompt verbatim>" \
  --out "generated-images/<descriptive-name>.png"
```

Use the default model policy unless the user explicitly asks otherwise. `--orchestrator-model account-default` leaves both model and reasoning at Codex defaults. An explicit current model ID may be paired with `--orchestrator-effort <current-level>`; do not maintain or infer a model allowlist inside the skill.

For reference-guided generation, repeat `--reference`. Add `--reference-role` only when the user states a relationship that is not already clear in the prompt.

```bash
node <skill-folder>/scripts/gpt_image.mjs generate \
  --mode generate \
  --prompt "<user prompt verbatim>" \
  --reference "<stable local path>" \
  --out "generated-images/<name>.png"
```

For an edit or follow-up revision, attach the current image as the primary target:

```bash
node <skill-folder>/scripts/gpt_image.mjs generate \
  --mode edit \
  --prompt "<user's exact revision request>" \
  --edit-target "<previous output path>" \
  --out "generated-images/<revised-name>.png"
```

### Transparent background

Treat an explicit transparent-background request, including the literal option `background="transparent"`, as an image-generation output option rather than extra creative prompt text.

- With a host-native `image_gen` tool, keep the user's prompt unchanged and pass `background="transparent"` through the tool's actual background parameter when that parameter is available. Use a PNG-capable output so alpha transparency can be preserved.
- With the CLI bridge, translate the same request to `--background transparent`. The bridge sends it as an explicit operational constraint to the built-in `$imagegen` turn and rejects the result if the saved PNG contains no alpha channel or transparency chunk.
- Do not fake transparency with a checkerboard pattern, white background, solid color, or background-removal description.
- If the active native image tool exposes no background option, do not claim that transparency is guaranteed. Prefer the bridge when available; otherwise report that actual alpha transparency cannot be verified.

```bash
node <skill-folder>/scripts/gpt_image.mjs generate \
  --prompt "<user prompt verbatim>" \
  --background transparent \
  --out "generated-images/<transparent-name>.png"
```

Use `--region`, `--preserve`, `--avoid`, `--exact-text`, `--size`, `--quality`, or `--background` only when the user explicitly supplied those details. The runner attaches the edit target first, then references in command-line order; strips API-related environment variables; verifies ChatGPT auth once; invokes built-in `$imagegen`; and saves a new PNG without overwriting by default.

## Generate multiple images

When the user requests two or more outputs, use parallel calls for every job whose image inputs already exist. With the CLI bridge, read the multi-image section of [image-workflows.md](references/image-workflows.md), write one workspace-local manifest, and run `batch --manifest <path>`. Do not make the user ask for `batch` explicitly.

Classify the request once without running a planning command:

- **Same design, different styles:** reuse one shared design anchor. For the same composition with style changes, run parallel `variation` jobs with the same `edit_target`. For the same character or product in new scenes or layouts, run parallel `generate` jobs with the same first reference. Use user-named styles, or choose distinct style concepts when the user delegated that choice. Attach only that job's style reference after the shared anchor.
- **Different design concepts:** when the user asks for different designs, concepts, directions, options, or alternatives, develop one complete creative concept and image-ready prompt per output, keep the shared brief and references, then run them together. Do this internally in one pass; do not run a separate planning command or ask for concept approval unless the user requested it.
- **Repeated renders:** when the user requests several images but does not ask for different concepts—or explicitly says to use the same prompt—reuse the exact image prompt for each independent job.
- **No anchor yet:** generate the first requested output normally, then use that returned image as the shared anchor for the remaining parallel jobs. Do not generate an extra hidden anchor that the user did not request.

Never put an output-dependent revision in the same batch as its source. In a mixed request, batch all currently ready jobs, resolve the dependency, then batch the newly ready jobs. The default concurrency is 2 and the maximum is 4. A batch checks ChatGPT auth once and does not run Doctor, planning, inspection, model discovery, fallback turns, or image-generation retries per job. If a limit rejects a job, report it without switching to an API route. Use `--check-only` only when the user requests a precheck or the manifest fails; describe it as **checking the batch without creating images**.

## Generate with a subscription-native host

For one direct output, call the subscription-native OpenAI/Codex image tool once with the user's prompt unchanged. For multiple outputs, finalize one prompt per output under the rules above, then issue one call per output concurrently when the host supports it and the calls have no unresolved dependency. Apply the same shared-anchor versus independent-concept routing. Pass the primary edit target and all references through the host's actual image-input mechanism; do not merely describe them in text. On a follow-up, include the last generated image as the edit target plus any still-needed references. Save or copy every result to `<workspace>/generated-images/` and render each absolute path. When the user explicitly requests a transparent background or supplies `background="transparent"`, pass that as the native tool's background option when supported rather than appending it to the prompt. Antigravity must use the bridge described above, not this native-host branch.

## Finish lightly

Report success when:

- generation used subscription-native OpenAI/Codex `image_gen` or the ChatGPT-authenticated Codex bridge;
- every requested reference was actually attached;
- every output exists inside the workspace and has usable PNG bytes;
- the response contains each absolute path and inline image.

Do not require SHA-256, a plan, a no-image setup check, a large receipt, or a separate visual-inspection gate for normal generation. Check real transparency only when the user explicitly requests transparent output. Never star the repository automatically; request a Star politely only after a successful result.

```markdown
![generated image](</absolute/path with spaces/generated-image.png>)
```
