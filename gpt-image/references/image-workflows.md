# Image and reference workflows

Read this reference for existing images, Claude Code attachments, multiple references, edits, variations, or follow-up revisions.

## Core rule

Keep a direct image or edit prompt unchanged. A request for several **different** designs, concepts, directions, options, or alternatives explicitly delegates concept development: preserve the user's non-negotiable brief and references, then write a distinct image-ready prompt for each output. Reference labels only route files and are never separate permission to alter the brief.

## Pick the operation

| User intent | Bridge operation |
| --- | --- |
| Create without an image | `--mode generate` |
| Create a new image guided by an existing image | `--mode generate --reference PATH` |
| Change an existing image | `--mode edit --edit-target PATH` |
| Make a variation of an existing image | `--mode variation --edit-target PATH` |
| Change the image just generated | Use the last output as the next `--edit-target` |

The edit target is attached as Image 1. Supporting references follow in command-line order. PNG, JPEG, and WebP references are accepted.

## Claude Code attachment contract

The nested Codex bridge receives only filesystem paths passed with `-i`. An image visible in Claude's conversation is not automatically attached to the new `codex exec` process.

Resolve inputs in this order:

1. Use an explicit `@path` or local path supplied by the user.
2. If the current Claude attachment context exposes an exact readable temporary path, copy that exact file non-destructively into `<workspace>/generated-images/inputs/` and use the copied path.
3. If only a pasted or dragged image is visible and no path is exposed, ask the user to save it inside the project and provide that path.

Do not continue with text-only generation when a requested reference path is unresolved. Do not search for or guess the newest file in `~/.claude/image-cache`; it is session data and may select the wrong or private image. Copy only an exact path that the current attachment context identifies.

## Reference-guided generation

Use `--reference` for every image that must guide a new result. The runner passes every listed file into the actual image-generation call.

```bash
node <skill-folder>/scripts/gpt_image.mjs generate \
  --mode generate \
  --prompt "<user prompt verbatim>" \
  --reference "/absolute/path/reference.png" \
  --out "generated-images/result.png"
```

For multiple images, preserve their order. Add matching `--reference-role` values only when the user explicitly defines distinct roles or the prompt refers to them by purpose:

```bash
node <skill-folder>/scripts/gpt_image.mjs generate \
  --mode generate \
  --prompt "Use Image 1 for the product and Image 2 for the color treatment." \
  --reference "/absolute/path/product.png" \
  --reference-role "product" \
  --reference "/absolute/path/color.png" \
  --reference-role "color treatment" \
  --out "generated-images/product-result.png"
```

Never convert an image into a prose description and pass only the prose. A visual reference is successful only when its file is attached to the native image tool or the bridge call.

## Edit and follow-up revision

For the first edit, use the exact image the user wants changed:

```bash
node <skill-folder>/scripts/gpt_image.mjs generate \
  --mode edit \
  --prompt "<user edit request verbatim>" \
  --edit-target "/absolute/path/current-image.png" \
  --out "generated-images/edited.png"
```

For the next request, such as “make the edited result slightly warmer,” use `edited.png`, not `current-image.png`:

```bash
node <skill-folder>/scripts/gpt_image.mjs generate \
  --mode edit \
  --prompt "make the edited result slightly warmer" \
  --edit-target "generated-images/edited.png" \
  --out "generated-images/edited-warmer.png"
```

Every bridge invocation uses an ephemeral Codex turn. Reattach the current edit target and any references still required for identity, style, layout, or compositing. Do not rely on the previous nested turn remembering an image.

Return and retain the absolute output path after every call. That path is the revision handle for the next turn.

## Explicit controls only

Use these flags only when the user actually supplied the corresponding requirement:

- `--region`
- repeated `--preserve`
- repeated `--avoid`
- repeated `--exact-text`
- `--size`, `--quality`, or `--background`

Do not manufacture values for these flags. A phrase such as “change only the icon” may be passed verbatim without expanding it into a long inferred preservation list.

For transparent output, `--background transparent` enables a minimal alpha check after generation. Exact text and dense layouts may still need user review, but they do not require an automatic quality gate.

## Multi-image workflows

When the user requests two or more outputs, parallelize every job whose inputs already exist. This includes several jobs that read the same reference or edit target. Only an output-to-input dependency requires another stage.

Choose the relationship from the request itself; do not run `plan` first:

| Request | Structure |
| --- | --- |
| Same design or composition in several styles | Shared edit target → parallel `variation` jobs |
| Same character, product, or identity in different scenes/layouts | Shared first reference → parallel `generate` jobs |
| Different designs, concepts, options, or directions | Agent develops distinct prompts → independent `generate` jobs |
| Several renders with no requested differences | Repeat the same image prompt in independent jobs |
| A base image followed by variants | Generate the requested base → batch the variants |
| Mixed dependencies | Batch all ready jobs → resolve outputs → batch the next ready jobs |

Words such as “different,” “alternatives,” “concepts,” “directions,” “options,” or “explore” authorize the agent to make creative choices needed to distinguish the requested outputs. A bare count does not: “make five” repeats the same visual request unless the surrounding message delegates differences.

### Shared-anchor variations

When a design image already exists, every variant can run in parallel from that one anchor:

- Use `mode: "variation"` and the same `edit_target` when composition and design should remain recognizable while style changes.
- Use `mode: "generate"` with the same anchor as `references[0]` when identity should carry into a different scene, pose, framing, or layout.
- Put a job-specific style reference after the shared anchor. Do not attach every style reference to every job; that causes roles to bleed together.
- Name image roles by order: the edit target is Image 1; otherwise the shared design reference is Image 1. A job-specific style reference follows as Image 2.

Example with an existing design anchor:

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

When no anchor exists, generate the first requested output in the user's stated order. That returned image becomes the shared anchor for the remaining outputs, which can then run together. Do not spend an additional generation on a hidden neutral anchor unless the user explicitly requested or approved it.

### Independent design concepts

For delegated concepts, first extract the shared non-negotiable brief: subject or product, provided references, brand requirements, exact copy, audience, ratio, quality, and explicit exclusions. Then create the requested number of standalone image prompts in one internal pass.

- Make each concept materially different in composition and art direction, not merely a synonym swap.
- Keep the same product or identity reference on every job when it is the advertised subject.
- Put only one image's creative direction in each prompt. Remove batch orchestration such as “make five images.”
- Never append “this job is the first of five,” “option 2,” “2번째 시안,” or similar metadata. Use `id` and `out` for identity and ordering.
- If the user supplied named directions, use those directions. If the user explicitly requested the exact same prompt, repeat it instead of developing concepts.

For example, “Create five attention-grabbing coffee posters, each with a different design” calls for five complete concepts—such as a bold typographic layout, a cinematic product macro, a minimal gallery composition, a neon night campaign, and a warm editorial scene—while every job keeps the coffee-product reference. Those concepts are image prompts, not labels added after the original batch request.

```json
{
  "version": 1,
  "jobs": [
    {
      "id": "circular-kiosk",
      "prompt": "Create a circular glass kiosk with a central service counter.",
      "out": "generated-images/circular-kiosk.png"
    },
    {
      "id": "modular-kiosk",
      "prompt": "Create a modular timber kiosk with movable display walls.",
      "out": "generated-images/modular-kiosk.png"
    }
  ]
}
```

For one user message that already contains named output directions, preserve each named direction and the shared constraints. For a delegated but unnamed exploration, the agent supplies the distinct directions. In both cases, each `prompt` must stand on its own as the instruction for one image.

### Run a ready batch

The CLI parses the manifest and resolves paths once, checks ChatGPT authentication once for the live batch, then starts separate ephemeral `codex exec` image jobs with bounded concurrency:

```bash
node <skill-folder>/scripts/gpt_image.mjs batch \
  --manifest "image-jobs.json" \
  --concurrency 2
```

Concurrency defaults to 2 and is capped at 4. Every job is a separate built-in image generation and consumes included Codex usage. Successful jobs return their own `PATH[id]` and `MARKDOWN[id]`; one failed job does not erase other results, and the CLI does not retry it automatically or switch to an API route.

Each job requires `prompt` and `out`. It may also use `mode`, `edit_target`, `references`, `reference_roles`, `region`, `preserve`, `avoid`, `exact_text`, `quality`, `size`, `background`, `timeout_seconds`, `overwrite`, or `verbose`. Field names use JSON underscores.

Output paths must be unique. A batch output cannot be another job's input because that would create a race. Shared read-only inputs are allowed; output dependencies run in stages:

```text
generate requested anchor → receive path → parallel variations from that path
```

To check only manifest structure, inputs, output paths, and scheduling without checking sign-in or generating images, use `--check-only`. In user-facing language, call this “checking the batch without creating images.” It is optional, not a required gate.

## Optional diagnostics

Normal generation does not require planning or a no-image setup check. Use them only to debug paths, attachment order, sign-in, or bridge behavior. When speaking to the user, describe `--dry-run` as “a setup check that does not create an image”:

```bash
node <skill-folder>/scripts/gpt_image.mjs plan --prompt "test" --reference "/path/ref.png" --out "generated-images/test.png" --json
node <skill-folder>/scripts/gpt_image.mjs generate --prompt "test" --out "generated-images/test.png" --dry-run --json
```

The normal successful non-JSON response is intentionally small: `PATH=...` and `MARKDOWN=...`.
